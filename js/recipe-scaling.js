/**
 * Baking Calculator Pro — Recipe Scaling (window.BCP.scaling)
 * Mengubah jumlah hasil resep tanpa mengubah resep asli di Buku Resep.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let currentRecipeId = '';
  let lastComputed = null;

  function init() {
    const sel = U.$('scaleRecipeSelect');
    if (sel) {
      sel.addEventListener('change', () => {
        loadRecipe(sel.value);
      });
    }

    U.$('scaleTargetYield')?.addEventListener('input', calculate);
    U.$('scaleBaseYield')?.addEventListener('input', calculate);

    document.querySelectorAll('[data-scale-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mult = Number(btn.getAttribute('data-scale-preset'));
        const base = U.parseQtyValue(U.$('scaleBaseYield')?.value);
        if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(mult)) return;
        U.$('scaleTargetYield').value = U.cleanNumber(base * mult);
        calculate();
      });
    });

    U.$('btnScaleSaveNewRecipe')?.addEventListener('click', saveAsNewRecipe);
    U.$('btnScaleSendHpp')?.addEventListener('click', sendToHpp);
    U.$('btnScaleSaveHistory')?.addEventListener('click', saveToHistory);

    S.subscribe(refreshPickerAndView);
    refreshPickerAndView();
  }

  function refreshPickerAndView() {
    const sel = U.$('scaleRecipeSelect');
    window.BCP.recipes?.populateRecipeSelect(sel, 'Pilih resep dari Buku Resep…');
    if (currentRecipeId && S.getState().recipes.some((r) => r.id === currentRecipeId)) {
      if (sel) sel.value = currentRecipeId;
      calculate();
    } else if (currentRecipeId) {
      currentRecipeId = '';
      lastComputed = null;
      renderEmpty();
    }
  }

  function loadRecipe(recipeId) {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === recipeId);
    const sel = U.$('scaleRecipeSelect');
    if (!r) {
      currentRecipeId = '';
      lastComputed = null;
      if (sel) sel.value = '';
      renderEmpty();
      return;
    }

    currentRecipeId = r.id;
    S.setLastOpenedRecipe(r.id);
    if (sel) sel.value = r.id;
    U.$('scaleBaseYield').value = r.baseYield;
    U.$('scaleTargetYield').value = U.cleanNumber(r.baseYield * 2);
    if (U.$('scaleBaseUnitBadge')) U.$('scaleBaseUnitBadge').textContent = r.yieldUnit;
    if (U.$('scaleTargetUnitBadge')) U.$('scaleTargetUnitBadge').textContent = r.yieldUnit;
    calculate();
  }

  function renderEmpty() {
    const summary = U.$('scaleSummaryCard');
    const tableBox = U.$('scaleResultTable');
    const actions = U.$('scaleResultActions');
    if (summary) summary.style.display = 'none';
    if (U.$('scaleVisualBox')) U.$('scaleVisualBox').style.display = 'none';
    if (actions) actions.style.display = 'none';
    if (tableBox) {
      tableBox.innerHTML = `<div class="empty-state">
        <p class="empty-title">Pilih resep dari Buku Resep</p>
        <p class="empty-sub">Pilih resep yang tersimpan di atas, lalu masukkan target hasil produksi untuk menghitung takaran bahan baru secara otomatis.</p>
      </div>`;
    }
  }

  function calculate() {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === currentRecipeId);
    if (!r) {
      renderEmpty();
      return;
    }

    const baseYield = U.parseQtyValue(U.$('scaleBaseYield')?.value);
    const targetYield = U.parseQtyValue(U.$('scaleTargetYield')?.value);
    const summary = U.$('scaleSummaryCard');
    const tableBox = U.$('scaleResultTable');
    const actions = U.$('scaleResultActions');

    if (!Number.isFinite(baseYield) || baseYield <= 0 || !Number.isFinite(targetYield) || targetYield <= 0) {
      if (summary) summary.style.display = 'none';
      if (actions) actions.style.display = 'none';
      if (tableBox) {
        tableBox.innerHTML = `<div class="alert alert-warning">Masukkan hasil resep awal dan target hasil lebih besar dari 0.</div>`;
      }
      lastComputed = null;
      return;
    }

    const factor = targetYield / baseYield;
    const scaledItems = r.items.map((item) => {
      const origQty = item.qty;
      const newQty = origQty !== null && Number.isFinite(origQty) ? U.cleanNumber(origQty * factor) : null;
      return {
        name: item.name,
        origQty,
        newQty,
        unit: item.unit,
        note: item.note || ''
      };
    });

    lastComputed = {
      recipe: r,
      baseYield,
      targetYield,
      yieldUnit: r.yieldUnit,
      factor,
      items: scaledItems
    };

    if (summary) {
      summary.style.display = 'grid';
      U.$('scaleFactorDisplay').textContent = `${U.fmt(factor, 4)}×`;
      U.$('scaleYieldDisplay').textContent = `${U.fmt(baseYield)} → ${U.fmt(targetYield)} ${r.yieldUnit}`;
      U.$('scaleItemCountDisplay').textContent = `${scaledItems.length} bahan`;
    }
    const visualBox = U.$('scaleVisualBox');
    if (visualBox && window.BCP.visuals) {
      visualBox.style.display = 'block';
      visualBox.innerHTML = window.BCP.visuals.renderScalingVisual({ baseYield, targetYield, yieldUnit: r.yieldUnit, factor });
    }
    if (actions) actions.style.display = 'flex';

    const rowsHtml = scaledItems.map((it) => {
      const origText = it.origQty !== null ? `${U.fmt(it.origQty)} ${U.esc(it.unit)}` : U.esc(it.unit);
      const newText = it.newQty !== null ? `<strong>${U.fmt(it.newQty)} ${U.esc(it.unit)}</strong>` : U.esc(it.unit);
      return `<tr>
        <td data-label="Bahan">
          <div class="cell-main"><strong>${U.esc(it.name)}</strong>${it.note ? `<span class="muted small-note">${U.esc(it.note)}</span>` : ''}</div>
        </td>
        <td data-label="Takaran Awal">${origText}</td>
        <td data-label="Takaran Baru" class="cell-highlight">${newText}</td>
      </tr>`;
    }).join('');

    tableBox.innerHTML = `<div class="responsive-table-wrap">
      <table class="responsive-table">
        <thead>
          <tr>
            <th>Bahan</th>
            <th>Takaran Awal (${U.fmt(baseYield)} ${U.esc(r.yieldUnit)})</th>
            <th>Takaran Baru (${U.fmt(targetYield)} ${U.esc(r.yieldUnit)})</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  }

  function saveAsNewRecipe() {
    if (!lastComputed) return;
    const { recipe, targetYield, yieldUnit, factor, items } = lastComputed;
    const newName = `${recipe.name} (${U.fmt(targetYield)} ${yieldUnit})`;
    const created = window.BCP.recipes?.saveNewRecipeFromCalculator({
      name: newName,
      category: recipe.category,
      description: `Hasil scaling ${U.fmt(factor, 2)}× dari "${recipe.name}".`,
      baseYield: targetYield,
      yieldUnit,
      panShape: recipe.panShape,
      panSizeA: recipe.panSizeA,
      panSizeB: recipe.panSizeB,
      notes: recipe.notes,
      source: 'manual',
      items: items.map((i) => ({
        name: i.name,
        qty: i.newQty,
        qtyRaw: i.newQty !== null ? String(i.newQty) : '',
        unit: i.unit,
        note: i.note
      }))
    });
    if (created) {
      U.toast(`Resep baru "${created.name}" disimpan ke Buku Resep. Resep asli tidak berubah.`, 'success');
    }
  }

  function sendToHpp() {
    if (!lastComputed) return;
    const { recipe, targetYield, yieldUnit, items } = lastComputed;
    window.BCP.hpp?.loadCustomItems({
      name: `${recipe.name} (${U.fmt(targetYield)} ${yieldUnit})`,
      yieldQty: targetYield,
      yieldUnit,
      items: items.map((i) => ({
        name: i.name,
        qty: i.newQty,
        unit: i.unit,
        note: i.note
      }))
    });
    window.BCP.app?.showPage('hpp');
    U.toast('Hasil scaling dimuat ke Kalkulator HPP.', 'info');
  }

  function saveToHistory() {
    if (!lastComputed) return;
    const { recipe, baseYield, targetYield, yieldUnit, factor, items } = lastComputed;
    const saved = S.addHistoryEntry({
      type: 'Scaling',
      name: recipe.name,
      summary: `${U.fmt(baseYield)} → ${U.fmt(targetYield)} ${yieldUnit} (${U.fmt(factor, 2)}×)`,
      total: null,
      inputs: { recipeId: recipe.id, baseYield, targetYield, yieldUnit },
      results: { factor: U.cleanNumber(factor), items }
    });
    if (saved) U.toast('Perhitungan scaling disimpan ke Riwayat.', 'success');
  }

  window.BCP.scaling = {
    init,
    loadRecipe,
    calculate
  };
})();
