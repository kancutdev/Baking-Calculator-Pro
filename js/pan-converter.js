/**
 * Baking Calculator Pro — Cake Pan Conversion (window.BCP.pan)
 * Khusus untuk bolu, sponge cake, dan kue berbasis ukuran loyang.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let currentRecipeId = '';
  let lastComputed = null;

  function init() {
    U.$('panRecipeSelect')?.addEventListener('change', (e) => {
      loadRecipe(e.target.value);
    });

    ['panFromShape', 'panToShape'].forEach((id) => {
      U.$(id)?.addEventListener('change', () => {
        updateShapeFields();
        calculate();
      });
    });

    ['panFromA', 'panFromB', 'panToA', 'panToB'].forEach((id) => {
      U.$(id)?.addEventListener('input', calculate);
    });

    U.$('btnPanSaveNewRecipe')?.addEventListener('click', saveAsNewRecipe);
    U.$('btnPanSendHpp')?.addEventListener('click', sendToHpp);
    U.$('btnPanSaveHistory')?.addEventListener('click', saveToHistory);

    updateShapeFields();
    S.subscribe(refreshPickerAndView);
    refreshPickerAndView();
  }

  function refreshPickerAndView() {
    const sel = U.$('panRecipeSelect');
    window.BCP.recipes?.populateRecipeSelect(sel, 'Pilih resep kue/bolu (opsional)…');
    if (currentRecipeId && S.getState().recipes.some((r) => r.id === currentRecipeId)) {
      if (sel) sel.value = currentRecipeId;
    } else {
      currentRecipeId = '';
    }
    calculate();
  }

  function updateShapeFields() {
    const fromShape = U.$('panFromShape')?.value || 'round';
    const toShape = U.$('panToShape')?.value || 'round';

    const fromBWrap = U.$('panFromBWrap');
    const fromALabel = U.$('panFromALabel');
    if (fromShape === 'round') {
      if (fromALabel) fromALabel.textContent = 'Diameter asal (cm)';
      if (fromBWrap) fromBWrap.style.display = 'none';
    } else {
      if (fromALabel) fromALabel.textContent = 'Panjang asal (cm)';
      if (fromBWrap) fromBWrap.style.display = 'block';
    }

    const toBWrap = U.$('panToBWrap');
    const toALabel = U.$('panToALabel');
    if (toShape === 'round') {
      if (toALabel) toALabel.textContent = 'Diameter tujuan (cm)';
      if (toBWrap) toBWrap.style.display = 'none';
    } else {
      if (toALabel) toALabel.textContent = 'Panjang tujuan (cm)';
      if (toBWrap) toBWrap.style.display = 'block';
    }
  }

  function loadRecipe(recipeId) {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === recipeId);
    const sel = U.$('panRecipeSelect');
    if (!r) {
      currentRecipeId = '';
      if (sel) sel.value = '';
      calculate();
      return;
    }
    currentRecipeId = r.id;
    S.setLastOpenedRecipe(r.id);
    if (sel) sel.value = r.id;

    // Pre-fill original pan dimensions if saved on the recipe
    if (r.panShape === 'round' && r.panSizeA) {
      U.$('panFromShape').value = 'round';
      U.$('panFromA').value = r.panSizeA;
      updateShapeFields();
    } else if (r.panShape === 'square' && r.panSizeA && r.panSizeB) {
      U.$('panFromShape').value = 'square';
      U.$('panFromA').value = r.panSizeA;
      U.$('panFromB').value = r.panSizeB;
      updateShapeFields();
    }
    calculate();
  }

  function panArea(shape, a, b) {
    return shape === 'round' ? Math.PI * Math.pow(a / 2, 2) : a * b;
  }

  function describePan(shape, a, b) {
    return shape === 'round'
      ? `Bulat Ø ${U.fmt(a)} cm`
      : `Persegi/Kotak ${U.fmt(a)}×${U.fmt(b)} cm`;
  }

  function calculate() {
    const fromShape = U.$('panFromShape')?.value || 'round';
    const toShape = U.$('panToShape')?.value || 'round';
    const fa = U.parseQtyValue(U.$('panFromA')?.value);
    const fb = U.parseQtyValue(U.$('panFromB')?.value);
    const ta = U.parseQtyValue(U.$('panToA')?.value);
    const tb = U.parseQtyValue(U.$('panToB')?.value);

    const summaryEl = U.$('panSummaryCard');
    const tableBox = U.$('panResultTable');
    const actionsEl = U.$('panResultActions');

    const invalid =
      !Number.isFinite(fa) || fa <= 0 ||
      !Number.isFinite(ta) || ta <= 0 ||
      (fromShape === 'square' && (!Number.isFinite(fb) || fb <= 0)) ||
      (toShape === 'square' && (!Number.isFinite(tb) || tb <= 0));

    if (invalid) {
      if (summaryEl) summaryEl.style.display = 'none';
      if (actionsEl) actionsEl.style.display = 'none';
      if (tableBox) tableBox.innerHTML = `<div class="alert alert-warning">Masukkan ukuran loyang asal dan tujuan lebih besar dari 0 cm.</div>`;
      lastComputed = null;
      return;
    }

    const fromArea = panArea(fromShape, fa, fb);
    const toArea = panArea(toShape, ta, tb);
    // For round->round: (ta / fa)^2 === toArea / fromArea
    const factor = (fromShape === 'round' && toShape === 'round')
      ? Math.pow(ta / fa, 2)
      : (toArea / fromArea);

    const recipe = S.getState().recipes.find((r) => r.id === currentRecipeId) || null;
    const convertedItems = recipe
      ? recipe.items.map((item) => ({
        name: item.name,
        origQty: item.qty,
        newQty: item.qty !== null && Number.isFinite(item.qty) ? U.cleanNumber(item.qty * factor) : null,
        unit: item.unit,
        note: item.note || ''
      }))
      : [];

    lastComputed = {
      recipe,
      fromShape,
      fromA: fa,
      fromB: fromShape === 'square' ? fb : null,
      toShape,
      toA: ta,
      toB: toShape === 'square' ? tb : null,
      fromArea,
      toArea,
      fromLabel: describePan(fromShape, fa, fb),
      toLabel: describePan(toShape, ta, tb),
      factor,
      items: convertedItems
    };

    if (summaryEl) {
      summaryEl.style.display = 'grid';
      U.$('panFactorDisplay').textContent = `${U.fmt(factor, 4)}×`;
      U.$('panFromAreaDisplay').textContent = `${U.fmt(fromArea, 2)} cm²`;
      U.$('panToAreaDisplay').textContent = `${U.fmt(toArea, 2)} cm²`;
    }

    if (actionsEl) {
      actionsEl.style.display = 'flex';
      if (U.$('btnPanSaveNewRecipe')) U.$('btnPanSaveNewRecipe').style.display = recipe ? 'inline-flex' : 'none';
      if (U.$('btnPanSendHpp')) U.$('btnPanSendHpp').style.display = recipe ? 'inline-flex' : 'none';
    }

    if (!recipe) {
      tableBox.innerHTML = `<div class="alert alert-info">
        Faktor konversi dari <strong>${U.esc(lastComputed.fromLabel)}</strong> ke <strong>${U.esc(lastComputed.toLabel)}</strong> adalah <strong>${U.fmt(factor, 4)}×</strong>.
        Pilih resep kue/bolu di atas untuk melihat rincian takaran baru per bahan secara otomatis.
      </div>`;
      return;
    }

    const rowsHtml = convertedItems.map((it) => {
      const origText = it.origQty !== null ? `${U.fmt(it.origQty)} ${U.esc(it.unit)}` : U.esc(it.unit);
      const newText = it.newQty !== null ? `<strong>${U.fmt(it.newQty)} ${U.esc(it.unit)}</strong>` : U.esc(it.unit);
      return `<tr>
        <td data-label="Bahan">
          <div class="cell-main"><strong>${U.esc(it.name)}</strong>${it.note ? `<span class="muted small-note">${U.esc(it.note)}</span>` : ''}</div>
        </td>
        <td data-label="Loyang Awal">${origText}</td>
        <td data-label="Loyang Tujuan" class="cell-highlight">${newText}</td>
      </tr>`;
    }).join('');

    tableBox.innerHTML = `<div class="responsive-table-wrap">
      <table class="responsive-table">
        <thead>
          <tr>
            <th>Bahan</th>
            <th>${U.esc(lastComputed.fromLabel)}</th>
            <th>${U.esc(lastComputed.toLabel)} (${U.fmt(factor, 2)}×)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  }

  function saveAsNewRecipe() {
    if (!lastComputed || !lastComputed.recipe) return;
    const { recipe, fromLabel, toLabel, toShape, toA, toB, factor, items } = lastComputed;
    const created = window.BCP.recipes?.saveNewRecipeFromCalculator({
      name: `${recipe.name} (${toLabel})`,
      category: recipe.category,
      description: `Konversi loyang ${fromLabel} → ${toLabel} (faktor ${U.fmt(factor, 2)}×) dari "${recipe.name}".`,
      baseYield: recipe.baseYield,
      yieldUnit: recipe.yieldUnit,
      panShape: toShape,
      panSizeA: toA,
      panSizeB: toB,
      notes: [recipe.notes, 'Catatan konversi loyang: sesuaikan suhu dan waktu pemanggangan sesuai ketebalan adonan.'].filter(Boolean).join('\n'),
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
    if (!lastComputed || !lastComputed.recipe) return;
    const { recipe, toLabel, items } = lastComputed;
    window.BCP.hpp?.loadCustomItems({
      name: `${recipe.name} (${toLabel})`,
      yieldQty: recipe.baseYield,
      yieldUnit: recipe.yieldUnit,
      items: items.map((i) => ({
        name: i.name,
        qty: i.newQty,
        unit: i.unit,
        note: i.note
      }))
    });
    window.BCP.app?.showPage('hpp');
    U.toast('Hasil konversi loyang dimuat ke Kalkulator HPP.', 'info');
  }

  function saveToHistory() {
    if (!lastComputed) return;
    const { recipe, fromLabel, toLabel, factor, fromArea, toArea, items } = lastComputed;
    const saved = S.addHistoryEntry({
      type: 'Konversi Loyang',
      name: recipe ? `${recipe.name} (${toLabel})` : `${fromLabel} → ${toLabel}`,
      summary: `${fromLabel} → ${toLabel} (${U.fmt(factor, 3)}×)`,
      total: null,
      inputs: { recipeId: recipe?.id || null, fromLabel, toLabel, fromArea: U.cleanNumber(fromArea), toArea: U.cleanNumber(toArea) },
      results: { factor: U.cleanNumber(factor), items }
    });
    if (saved) U.toast('Perhitungan konversi loyang disimpan ke Riwayat.', 'success');
  }

  window.BCP.pan = {
    init,
    loadRecipe,
    calculate
  };
})();
