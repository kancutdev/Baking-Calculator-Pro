/**
 * Baking Calculator Pro — HPP Calculator (window.BCP.hpp)
 * Terintegrasi penuh dengan Buku Resep & Database Bahan Baku.
 * Menangani konversi satuan secara presisi dan menandai bahan tanpa harga.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let rows = [];
  let lastSummary = null;

  function init() {
    U.$('hppRecipeSelect')?.addEventListener('change', (e) => {
      if (e.target.value) loadRecipe(e.target.value);
    });

    U.$('btnHppAddRow')?.addEventListener('click', () => {
      rows.push(createEmptyRow());
      renderRows();
      calculate();
    });

    ['hppName', 'hppYield', 'hppYieldUnit', 'hppPackaging', 'hppUtilities', 'hppLabor', 'hppOverhead', 'hppMargin'].forEach((id) => {
      U.$(id)?.addEventListener('input', calculate);
    });

    document.querySelectorAll('[data-margin-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (U.$('hppMargin')) U.$('hppMargin').value = btn.getAttribute('data-margin-preset');
        calculate();
      });
    });

    U.$('btnHppSaveHistory')?.addEventListener('click', saveToHistory);
    U.$('btnHppPrint')?.addEventListener('click', () => window.print());

    // Start with 1 empty row
    if (!rows.length) rows.push(createEmptyRow());

    S.subscribe(onStateChange);
    onStateChange();
  }

  function createEmptyRow(partial = {}) {
    return {
      rowId: U.generateId(),
      materialId: partial.materialId || '',
      name: partial.name || '',
      qty: partial.qty !== undefined && partial.qty !== null ? String(partial.qty) : '',
      unit: U.normUnit(partial.unit || 'gram') || 'gram',
      manualUnitPrice: partial.manualUnitPrice !== undefined && partial.manualUnitPrice !== null ? String(partial.manualUnitPrice) : '',
      quickPackPrice: '',
      quickPackQty: '1000',
      note: partial.note || ''
    };
  }

  function onStateChange() {
    const sel = U.$('hppRecipeSelect');
    window.BCP.recipes?.populateRecipeSelect(sel, 'Muat bahan dari Buku Resep…');

    // Re-match any unlinked rows if user just added a material to DB!
    const s = S.getState();
    rows.forEach((row) => {
      if (row.materialId && row.materialId !== '__custom') {
        const exists = s.materials.some((m) => m.id === row.materialId);
        if (!exists) row.materialId = '__custom';
      } else if (row.name && row.materialId === '__custom' && row.manualUnitPrice === '') {
        const matched = window.BCP.materials?.findMatch(row.name);
        if (matched) row.materialId = matched.id;
      }
    });

    renderRows();
    calculate();
  }

  function loadRecipe(recipeId) {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === recipeId);
    if (!r) return;
    S.setLastOpenedRecipe(r.id);

    if (U.$('hppRecipeSelect')) U.$('hppRecipeSelect').value = r.id;
    loadCustomItems({
      name: r.name,
      yieldQty: r.baseYield,
      yieldUnit: r.yieldUnit,
      items: r.items
    });
    U.toast(`Resep "${r.name}" dimuat ke Kalkulator HPP.`, 'info');
  }

  /**
   * Load any ingredient list (from Recipe Book, Scaling, or Pan Converter) without mutating original recipe.
   */
  function loadCustomItems({ name = '', yieldQty = 1, yieldUnit = 'pcs', items = [] }) {
    if (U.$('hppName')) U.$('hppName').value = name;
    if (U.$('hppYield')) U.$('hppYield').value = yieldQty || 1;
    if (U.$('hppYieldUnit')) U.$('hppYieldUnit').value = yieldUnit || 'pcs';

    rows = (items || []).map((item) => {
      const matched = window.BCP.materials?.findMatch(item.name);
      // IMPORTANT: Preserve the recipe's original unit & qty! NEVER overwrite kg -> gram without converting!
      return createEmptyRow({
        materialId: matched ? matched.id : '__custom',
        name: item.name,
        qty: item.qty !== null && item.qty !== undefined ? item.qty : '',
        unit: item.unit || (matched ? matched.unit : 'gram'),
        note: item.note || ''
      });
    });

    if (!rows.length) rows.push(createEmptyRow());
    renderRows();
    calculate();
  }

  function evaluateRow(row) {
    const s = S.getState();
    const mat = row.materialId && row.materialId !== '__custom'
      ? s.materials.find((m) => m.id === row.materialId)
      : null;

    const name = mat ? mat.name : (row.name.trim() || '');
    const qtyNum = U.parseQtyValue(row.qty);
    const hasQty = Number.isFinite(qtyNum) && qtyNum > 0;
    const unit = U.normUnit(row.unit || 'gram') || 'gram';

    if (unit === 'secukupnya') {
      return {
        status: 'optional',
        name: name || 'Bahan secukupnya',
        qty: null,
        unit,
        unitPrice: null,
        unitPriceLabel: 'Secukupnya',
        cost: 0,
        issue: null,
        mat
      };
    }

    if (!name && !hasQty) {
      return {
        status: 'empty',
        name: '',
        qty: null,
        unit,
        unitPrice: null,
        unitPriceLabel: '—',
        cost: 0,
        issue: null,
        mat: null
      };
    }

    if (!hasQty) {
      return {
        status: 'invalid_qty',
        name: name || 'Bahan tanpa nama',
        qty: null,
        unit,
        unitPrice: null,
        unitPriceLabel: '—',
        cost: null,
        issue: `${name || 'Baris bahan'}: jumlah pemakaian belum valid.`,
        mat
      };
    }

    if (mat) {
      const unitPrice = S.getMaterialUnitPrice(mat);
      const convertedQty = U.convertSameDimension(qtyNum, unit, mat.unit);
      if (convertedQty === null) {
        return {
          status: 'unit_mismatch',
          name: mat.name,
          qty: qtyNum,
          unit,
          unitPrice,
          unitPriceLabel: `${U.moneyPrecise(unitPrice)} / ${mat.unit}`,
          cost: null,
          issue: `${mat.name}: satuan resep (${unit}) tidak dapat dikonversi langsung ke satuan database (${mat.unit}). Ubah ke ${mat.unit} atau gunakan Konversi Satuan.`,
          mat
        };
      }
      const itemCost = U.cleanNumber(unitPrice * convertedQty);
      return {
        status: 'ok',
        name: mat.name,
        qty: qtyNum,
        convertedQty,
        baseUnit: mat.unit,
        unit,
        unitPrice,
        unitPriceLabel: `${U.moneyPrecise(unitPrice)} / ${mat.unit}`,
        cost: itemCost,
        issue: null,
        mat
      };
    }

    // Custom / unlinked ingredient — NEVER silently treat blank price as Rp 0!
    const rawPrice = String(row.manualUnitPrice ?? '').trim();
    if (rawPrice === '') {
      return {
        status: 'missing_price',
        name: name || 'Bahan belum terdaftar',
        qty: qtyNum,
        unit,
        unitPrice: null,
        unitPriceLabel: 'Belum ada harga',
        cost: null,
        issue: `${name || 'Bahan belum terdaftar'}: belum memiliki harga di Database Bahan Baku.`,
        mat: null
      };
    }

    const manualPriceNum = Number(rawPrice);
    if (!Number.isFinite(manualPriceNum) || manualPriceNum < 0) {
      return {
        status: 'missing_price',
        name: name || 'Bahan manual',
        qty: qtyNum,
        unit,
        unitPrice: null,
        unitPriceLabel: 'Harga tidak valid',
        cost: null,
        issue: `${name || 'Bahan manual'}: harga satuan tidak valid.`,
        mat: null
      };
    }

    const itemCost = U.cleanNumber(manualPriceNum * qtyNum);
    return {
      status: 'ok_manual',
      name: name || 'Bahan manual',
      qty: qtyNum,
      baseUnit: unit,
      unit,
      unitPrice: manualPriceNum,
      unitPriceLabel: `${U.moneyPrecise(manualPriceNum)} / ${unit}`,
      cost: itemCost,
      issue: null,
      mat: null
    };
  }

  function renderRows() {
    const container = U.$('hppRowsContainer');
    if (!container) return;
    const s = S.getState();

    const matOptions = `<option value="">Pilih dari database…</option>` +
      s.materials.map((m) => `<option value="${U.esc(m.id)}">${U.esc(m.name)} (${U.moneyPrecise(S.getMaterialUnitPrice(m))}/${U.esc(m.unit)})</option>`).join('') +
      `<option value="__custom">+ Input manual / belum terdaftar</option>`;

    container.innerHTML = rows.map((row) => {
      const ev = evaluateRow(row);
      const isCustom = row.materialId === '__custom';
      const statusClass = ev.status === 'missing_price'
        ? 'hpp-row-warn'
        : ev.status === 'unit_mismatch' || ev.status === 'invalid_qty'
          ? 'hpp-row-error'
          : '';

      const unitList = U.STANDARD_UNITS.includes(row.unit)
        ? U.STANDARD_UNITS
        : [...U.STANDARD_UNITS, row.unit];

      let badgeHtml = '';
      if (ev.status === 'missing_price') {
        badgeHtml = `<span class="chip chip-warning">Belum ada harga</span>`;
      } else if (ev.status === 'unit_mismatch') {
        badgeHtml = `<span class="chip chip-danger">Satuan beda (${U.esc(row.unit)} ≠ ${U.esc(ev.mat?.unit || '')})</span>`;
      } else if (ev.status === 'ok') {
        badgeHtml = `<span class="chip chip-success">Terhubung DB</span>`;
      } else if (ev.status === 'ok_manual') {
        badgeHtml = `<span class="chip chip-soft">Harga manual</span>`;
      }

      const costDisplay = ev.cost !== null
        ? `<strong>${U.money(ev.cost)}</strong>`
        : `<span class="text-danger">Belum dihitung</span>`;

      const vis = window.BCP.visuals ? window.BCP.visuals.getMaterialVisual(`${ev.mat?.category || ''} ${ev.name || row.name}`) : null;

      return `<div class="hpp-row-card ${statusClass}" data-row-id="${U.esc(row.rowId)}">
        <div class="hpp-row-main">
          <div class="hpp-col hpp-col-mat">
            <label class="ing-mobile-label">Bahan Baku</label>
            <div class="hpp-mat-input-wrap">
              ${vis ? `<span class="cat-icon-tile cat-icon-sm ${vis.tone}" aria-hidden="true">${vis.svg}</span>` : ''}
              <select class="hpp-mat-select">${matOptions}</select>
            </div>
            ${isCustom ? `
              <div class="hpp-custom-fields">
                <input type="text" class="hpp-custom-name" placeholder="Nama bahan" value="${U.esc(row.name)}">
                <div class="hpp-quick-price-row">
                  <input type="number" min="0" step="any" class="hpp-manual-price" placeholder="Harga per 1 ${U.esc(row.unit)} (Rp)" value="${U.esc(row.manualUnitPrice)}">
                  <button type="button" class="btn btn-sm btn-soft hpp-save-db-btn" title="Simpan harga ini ke Database Bahan Baku">Simpan ke DB</button>
                </div>
                <p class="field-hint">Isi harga per 1 ${U.esc(row.unit)}, lalu klik <b>Simpan ke DB</b> agar tersimpan permanen di Database Bahan.</p>
              </div>
            ` : ''}
          </div>
          <div class="hpp-col hpp-col-qty">
            <label class="ing-mobile-label">Jumlah Pakai</label>
            <input type="text" inputmode="decimal" class="hpp-qty-input" placeholder="0" value="${U.esc(row.qty)}">
          </div>
          <div class="hpp-col hpp-col-unit">
            <label class="ing-mobile-label">Satuan</label>
            <select class="hpp-unit-select">
              ${unitList.map((u) => `<option value="${U.esc(u)}" ${u === row.unit ? 'selected' : ''}>${U.esc(u)}</option>`).join('')}
            </select>
          </div>
          <div class="hpp-col hpp-col-cost">
            <label class="ing-mobile-label">Harga Satuan & Biaya</label>
            <div class="hpp-cost-stack">
              <div class="hpp-cost-val">${costDisplay}</div>
              <div class="hpp-unit-price-sub">${U.esc(ev.unitPriceLabel)}</div>
              <div class="hpp-status-badge">${badgeHtml}</div>
            </div>
          </div>
          <div class="hpp-col hpp-col-del">
            <button type="button" class="btn btn-icon btn-danger-outline hpp-del-btn" aria-label="Hapus baris bahan">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Set select values and attach listeners
    container.querySelectorAll('.hpp-row-card').forEach((card) => {
      const rowId = card.getAttribute('data-row-id');
      const row = rows.find((r) => r.rowId === rowId);
      if (!row) return;

      const matSel = card.querySelector('.hpp-mat-select');
      matSel.value = row.materialId || '';

      matSel.addEventListener('change', (e) => {
        row.materialId = e.target.value;
        if (row.materialId && row.materialId !== '__custom') {
          const mat = S.getState().materials.find((m) => m.id === row.materialId);
          if (mat) {
            row.name = mat.name;
            // Only adopt material unit if current unit is empty or incompatible with existing blank qty
            if (!row.qty || U.convertSameDimension(1, row.unit, mat.unit) === null) {
              if (!row.qty) row.unit = mat.unit;
            }
          }
        }
        renderRows();
        calculate();
      });

      card.querySelector('.hpp-qty-input')?.addEventListener('input', (e) => {
        row.qty = e.target.value;
        updateSingleCardCost(card, row);
        calculate();
      });

      card.querySelector('.hpp-unit-select')?.addEventListener('change', (e) => {
        row.unit = e.target.value;
        renderRows();
        calculate();
      });

      card.querySelector('.hpp-custom-name')?.addEventListener('input', (e) => {
        row.name = e.target.value;
        calculate();
      });

      card.querySelector('.hpp-manual-price')?.addEventListener('input', (e) => {
        row.manualUnitPrice = e.target.value;
        updateSingleCardCost(card, row);
        calculate();
      });

      card.querySelector('.hpp-save-db-btn')?.addEventListener('click', () => {
        const priceNum = Number(row.manualUnitPrice);
        const cleanName = row.name.trim();
        if (!cleanName) {
          U.toast('Isi nama bahan terlebih dahulu sebelum menyimpan ke database.', 'warning');
          return;
        }
        if (row.manualUnitPrice.trim() === '' || !Number.isFinite(priceNum) || priceNum < 0) {
          U.toast(`Isi harga per 1 ${row.unit} terlebih dahulu.`, 'warning');
          return;
        }
        const savedMat = window.BCP.materials?.quickUpsertMaterial({
          name: cleanName,
          price: priceNum,
          qty: 1,
          purchaseUnit: row.unit,
          unit: row.unit
        });
        if (savedMat) {
          row.materialId = savedMat.id;
          U.toast(`"${savedMat.name}" (${U.moneyPrecise(priceNum)}/${savedMat.unit}) disimpan ke Database Bahan.`, 'success');
          renderRows();
          calculate();
        }
      });

      card.querySelector('.hpp-del-btn')?.addEventListener('click', () => {
        rows = rows.filter((r) => r.rowId !== rowId);
        if (!rows.length) rows.push(createEmptyRow());
        renderRows();
        calculate();
      });
    });
  }

  function updateSingleCardCost(card, row) {
    const ev = evaluateRow(row);
    card.classList.remove('hpp-row-warn', 'hpp-row-error');
    if (ev.status === 'missing_price') card.classList.add('hpp-row-warn');
    if (ev.status === 'unit_mismatch' || ev.status === 'invalid_qty') card.classList.add('hpp-row-error');
    const valEl = card.querySelector('.hpp-cost-val');
    const subEl = card.querySelector('.hpp-unit-price-sub');
    const badgeEl = card.querySelector('.hpp-status-badge');
    if (valEl) {
      valEl.innerHTML = ev.cost !== null ? `<strong>${U.money(ev.cost)}</strong>` : `<span class="text-danger">Belum dihitung</span>`;
    }
    if (subEl) subEl.textContent = ev.unitPriceLabel;
    if (badgeEl) {
      if (ev.status === 'missing_price') badgeEl.innerHTML = `<span class="chip chip-warning">Belum ada harga</span>`;
      else if (ev.status === 'unit_mismatch') badgeEl.innerHTML = `<span class="chip chip-danger">Satuan beda</span>`;
      else if (ev.status === 'ok') badgeEl.innerHTML = `<span class="chip chip-success">Terhubung DB</span>`;
      else if (ev.status === 'ok_manual') badgeEl.innerHTML = `<span class="chip chip-soft">Harga manual</span>`;
      else badgeEl.innerHTML = '';
    }
  }

  function calculate() {
    const evaluated = rows.map(evaluateRow);
    const activeItems = evaluated.filter((e) => e.status !== 'empty');
    const issues = activeItems.filter((e) => e.issue).map((e) => e.issue);
    const missingCount = activeItems.filter((e) => e.status === 'missing_price').length;
    const materialCost = U.cleanNumber(activeItems.reduce((sum, e) => sum + (e.cost || 0), 0));

    const packaging = Math.max(0, Number(U.$('hppPackaging')?.value) || 0);
    const utilities = Math.max(0, Number(U.$('hppUtilities')?.value) || 0);
    const labor = Math.max(0, Number(U.$('hppLabor')?.value) || 0);
    const overhead = Math.max(0, Number(U.$('hppOverhead')?.value) || 0);
    const extraCost = U.cleanNumber(packaging + utilities + labor + overhead);
    const totalHpp = U.cleanNumber(materialCost + extraCost);

    const yieldRaw = U.parseQtyValue(U.$('hppYield')?.value);
    const yieldQty = Number.isFinite(yieldRaw) && yieldRaw > 0 ? yieldRaw : 1;
    const yieldUnit = (U.$('hppYieldUnit')?.value || 'pcs').trim() || 'pcs';
    const margin = Math.min(95, Math.max(0, Number(U.$('hppMargin')?.value) || 0));

    const hppPerUnit = totalHpp / yieldQty;
    const sellBatch = margin >= 99.9 ? totalHpp : totalHpp / (1 - margin / 100);
    const sellPerUnit = sellBatch / yieldQty;
    const profitBatch = sellBatch - totalHpp;
    const profitPerUnit = profitBatch / yieldQty;

    const productName = (U.$('hppName')?.value || '').trim() || 'Produk Tanpa Nama';

    // Store accurate INDIVIDUAL item cost `e.cost` (fixes v1.2.1 cumulative cost bug!)
    const historyItems = activeItems.map((e) => ({
      name: e.name,
      qty: e.qty,
      unit: e.unit,
      unitPrice: e.unitPrice,
      baseUnit: e.baseUnit || e.unit,
      cost: e.cost
    }));

    lastSummary = {
      name: productName,
      yieldQty,
      yieldUnit,
      materialCost,
      extraCost,
      extraBreakdown: { packaging, utilities, labor, overhead },
      totalHpp,
      hppPerUnit: U.cleanNumber(hppPerUnit),
      margin,
      sellBatch: U.cleanNumber(sellBatch),
      sellPerUnit: U.cleanNumber(sellPerUnit),
      profitBatch: U.cleanNumber(profitBatch),
      profitPerUnit: U.cleanNumber(profitPerUnit),
      issues,
      missingCount,
      items: historyItems
    };

    const resultBox = U.$('hppResultBox');
    if (!resultBox) return;

    const warningHtml = issues.length
      ? `<div class="alert alert-warning" style="margin-bottom:14px">
          <strong>Perhatian — Perhitungan belum lengkap (${issues.length} masalah):</strong>
          <ul class="alert-list">${issues.map((i) => `<li>${U.esc(i)}</li>`).join('')}</ul>
          <p class="small-note" style="margin:6px 0 0">Bahan tanpa harga tidak dihitung sebagai Rp 0. Lengkapi harga di baris yang ditandai agar HPP akurat.</p>
        </div>`
      : '';

    resultBox.innerHTML = `
      ${warningHtml}
      <div class="kpi-grid kpi-grid-4">
        <div class="kpi-box">
          <span class="kpi-label">Total Biaya Bahan</span>
          <strong class="kpi-value">${U.money(materialCost)}</strong>
          <span class="kpi-sub">${activeItems.length} item${missingCount ? ` (${missingCount} belum berharga)` : ''}</span>
        </div>
        <div class="kpi-box">
          <span class="kpi-label">Total HPP (Modal)</span>
          <strong class="kpi-value">${U.money(totalHpp)}</strong>
          <span class="kpi-sub">Tambahan: ${U.money(extraCost)}</span>
        </div>
        <div class="kpi-box kpi-box-accent">
          <span class="kpi-label">HPP per ${U.esc(yieldUnit)}</span>
          <strong class="kpi-value">${U.money(hppPerUnit)}</strong>
          <span class="kpi-sub">Hasil: ${U.fmt(yieldQty)} ${U.esc(yieldUnit)}</span>
        </div>
        <div class="kpi-box kpi-box-success">
          <span class="kpi-label">Harga Jual (Margin ${U.fmt(margin, 1)}%)</span>
          <strong class="kpi-value">${U.money(sellPerUnit)} <small>/ ${U.esc(yieldUnit)}</small></strong>
          <span class="kpi-sub">Per batch: ${U.money(sellBatch)} · Laba: ${U.money(profitPerUnit)}/${U.esc(yieldUnit)}</span>
        </div>
      </div>
    `;
  }

  function saveToHistory() {
    calculate();
    if (!lastSummary || !lastSummary.items.length) {
      U.toast('Tambahkan minimal 1 bahan sebelum menyimpan riwayat HPP.', 'warning');
      return;
    }
    if (lastSummary.issues.length) {
      U.toast(`Lengkapi ${lastSummary.issues.length} bahan yang belum memiliki harga atau satuan belum cocok sebelum menyimpan.`, 'error', 5000);
      return;
    }
    const saved = S.addHistoryEntry({
      type: 'HPP',
      name: lastSummary.name,
      summary: `HPP ${U.money(lastSummary.totalHpp)} (${U.money(lastSummary.hppPerUnit)}/${lastSummary.yieldUnit}) · Jual ${U.money(lastSummary.sellPerUnit)}/${lastSummary.yieldUnit}`,
      total: lastSummary.totalHpp,
      inputs: {
        yieldQty: lastSummary.yieldQty,
        yieldUnit: lastSummary.yieldUnit,
        margin: lastSummary.margin,
        extraBreakdown: lastSummary.extraBreakdown
      },
      results: {
        materialCost: lastSummary.materialCost,
        extraCost: lastSummary.extraCost,
        totalHpp: lastSummary.totalHpp,
        hppPerUnit: lastSummary.hppPerUnit,
        sellBatch: lastSummary.sellBatch,
        sellPerUnit: lastSummary.sellPerUnit,
        profitBatch: lastSummary.profitBatch,
        items: lastSummary.items
      },
      details: lastSummary
    });
    if (saved) {
      U.toast(`Perhitungan HPP "${lastSummary.name}" disimpan ke Riwayat.`, 'success');
    }
  }

  window.BCP.hpp = {
    init,
    loadRecipe,
    loadCustomItems,
    calculate
  };
})();
