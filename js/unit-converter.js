/**
 * Baking Calculator Pro — Unit Converter (window.BCP.units)
 * Mendukung gram, kg, mg, ml, liter, sdt, sdm, cup, pcs, butir.
 * Berat<->Volume selalu menggunakan densitas bahan (tidak pernah mengasumsikan 1g = 1ml secara membabi buta).
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  // Curated baking densities in g/ml (derived from culinary standards: g per 15ml sdm / 15)
  const DENSITIES = {
    'Air': { gPerMl: 1.00, note: '1 sdm ≈ 15 g' },
    'Susu cair': { gPerMl: 1.03, note: '1 sdm ≈ 15.5 g' },
    'Santan kental': { gPerMl: 1.01, note: '1 sdm ≈ 15 g' },
    'Minyak goreng': { gPerMl: 0.92, note: '1 sdm ≈ 13.8 g' },
    'Madu': { gPerMl: 1.42, note: '1 sdm ≈ 21.3 g' },
    'Susu kental manis': { gPerMl: 1.30, note: '1 sdm ≈ 19.5 g' },
    'Tepung terigu': { gPerMl: 0.53, note: '1 sdm ≈ 8 g · 1 cup ≈ 127 g' },
    'Tepung maizena': { gPerMl: 0.54, note: '1 sdm ≈ 8 g' },
    'Tepung beras': { gPerMl: 0.65, note: '1 sdm ≈ 9.8 g' },
    'Tepung tapioka': { gPerMl: 0.56, note: '1 sdm ≈ 8.4 g' },
    'Tepung almond': { gPerMl: 0.42, note: '1 sdm ≈ 6.3 g' },
    'Gula pasir': { gPerMl: 0.84, note: '1 sdm ≈ 12.6 g · 1 cup ≈ 200 g' },
    'Gula halus': { gPerMl: 0.52, note: '1 sdm ≈ 7.8 g · 1 cup ≈ 125 g' },
    'Gula palem / brown sugar': { gPerMl: 0.78, note: '1 sdm ≈ 11.7 g' },
    'Cokelat bubuk': { gPerMl: 0.36, note: '1 sdm ≈ 5.4 g' },
    'Susu bubuk': { gPerMl: 0.48, note: '1 sdm ≈ 7.2 g' },
    'Mentega / Butter': { gPerMl: 0.95, note: '1 sdm ≈ 14.2 g' },
    'Margarin': { gPerMl: 0.94, note: '1 sdm ≈ 14.1 g' },
    'Cream cheese': { gPerMl: 0.98, note: '1 sdm ≈ 14.7 g' },
    'Whipping cream cair': { gPerMl: 1.00, note: '1 sdm ≈ 15 g' },
    'Garam halus': { gPerMl: 1.20, note: '1 sdt ≈ 6 g · 1 sdm ≈ 18 g' },
    'Baking powder': { gPerMl: 0.80, note: '1 sdt ≈ 4 g' },
    'Baking soda': { gPerMl: 0.92, note: '1 sdt ≈ 4.6 g' },
    'Ragi instan': { gPerMl: 0.62, note: '1 sdt ≈ 3.1 g' }
  };

  const UNIT_OPTIONS = ['gram', 'kg', 'mg', 'ml', 'liter', 'sdt', 'sdm', 'cup', 'pcs', 'butir'];
  let lastResult = null;

  function init() {
    populateUnitSelects();
    populateIngredientSelect();

    U.$('unitRecipeSelect')?.addEventListener('change', onRecipePicked);
    U.$('unitRecipeItemSelect')?.addEventListener('change', onRecipeIngredientPicked);
    ['unitIngredient', 'unitValue', 'unitFrom', 'unitTo', 'unitCustomDensity', 'unitCustomPieceWeight'].forEach((id) => {
      U.$(id)?.addEventListener('input', convert);
      U.$(id)?.addEventListener('change', convert);
    });

    U.$('btnUnitSwap')?.addEventListener('click', () => {
      const f = U.$('unitFrom');
      const t = U.$('unitTo');
      if (!f || !t) return;
      const tmp = f.value;
      f.value = t.value;
      t.value = tmp;
      convert();
    });

    U.$('btnUnitSaveHistory')?.addEventListener('click', saveToHistory);

    S.subscribe(refreshRecipePicker);
    refreshRecipePicker();
    convert();
  }

  function populateUnitSelects() {
    const opts = UNIT_OPTIONS.map((u) => `<option value="${u}">${u}</option>`).join('');
    if (U.$('unitFrom')) {
      U.$('unitFrom').innerHTML = opts;
      U.$('unitFrom').value = 'gram';
    }
    if (U.$('unitTo')) {
      U.$('unitTo').innerHTML = opts;
      U.$('unitTo').value = 'sdm';
    }
  }

  function populateIngredientSelect() {
    const sel = U.$('unitIngredient');
    if (!sel) return;
    sel.innerHTML = Object.keys(DENSITIES).map((k) => `<option value="${U.esc(k)}">${U.esc(k)}</option>`).join('') +
      `<option value="__custom">Bahan lain / Masukkan densitas manual…</option>`;
    sel.value = 'Tepung terigu';
  }

  function refreshRecipePicker() {
    window.BCP.recipes?.populateRecipeSelect(U.$('unitRecipeSelect'), 'Pilih resep (opsional)…');
  }

  function findBestDensityKey(ingredientName) {
    const norm = U.normalizeIngredientName(ingredientName);
    if (!norm) return null;
    const keys = Object.keys(DENSITIES);
    // Exact match
    let hit = keys.find((k) => k.toLowerCase() === norm);
    if (hit) return hit;
    // Substring match (e.g. "tepung terigu protein tinggi" -> "Tepung terigu")
    hit = keys.find((k) => norm.includes(k.toLowerCase()) || k.toLowerCase().split('/').some((part) => norm.includes(part.trim())));
    if (hit) return hit;
    if (norm.includes('terigu')) return 'Tepung terigu';
    if (norm.includes('butter') || norm.includes('mentega')) return 'Mentega / Butter';
    if (norm.includes('minyak')) return 'Minyak goreng';
    if (norm.includes('susu cair')) return 'Susu cair';
    if (norm.includes('garam')) return 'Garam halus';
    if (norm.includes('ragi')) return 'Ragi instan';
    return null;
  }

  function loadRecipe(recipeId) {
    if (U.$('unitRecipeSelect')) {
      U.$('unitRecipeSelect').value = recipeId || '';
    }
    onRecipePicked();
  }

  function onRecipePicked() {
    const rId = U.$('unitRecipeSelect')?.value;
    const itemWrap = U.$('unitRecipeItemWrap');
    const itemSel = U.$('unitRecipeItemSelect');
    if (!rId) {
      if (itemWrap) itemWrap.style.display = 'none';
      return;
    }
    const r = S.getState().recipes.find((x) => x.id === rId);
    if (!r || !r.items.length) {
      if (itemWrap) itemWrap.style.display = 'none';
      return;
    }
    S.setLastOpenedRecipe(r.id);
    if (itemWrap) itemWrap.style.display = 'block';
    if (itemSel) {
      itemSel.innerHTML = `<option value="">Pilih bahan dari "${U.esc(r.name)}"…</option>` +
        r.items.map((it, idx) => `<option value="${idx}">${U.esc(it.name)} (${it.qty !== null ? U.fmt(it.qty) + ' ' : ''}${U.esc(it.unit)})</option>`).join('');
    }
  }

  function onRecipeIngredientPicked() {
    const rId = U.$('unitRecipeSelect')?.value;
    const idxStr = U.$('unitRecipeItemSelect')?.value;
    if (!rId || idxStr === '') return;
    const r = S.getState().recipes.find((x) => x.id === rId);
    const item = r?.items?.[Number(idxStr)];
    if (!item) return;

    if (item.qty !== null) U.$('unitValue').value = item.qty;
    if (UNIT_OPTIONS.includes(item.unit)) {
      U.$('unitFrom').value = item.unit;
      // Pick a helpful default target unit
      if (U.getUnitDimension(item.unit) === 'volume') U.$('unitTo').value = 'gram';
      else if (U.getUnitDimension(item.unit) === 'weight') U.$('unitTo').value = 'sdm';
    }

    const densityKey = findBestDensityKey(item.name);
    if (densityKey) {
      U.$('unitIngredient').value = densityKey;
      U.toast(`Bahan "${item.name}" dicocokkan dengan densitas "${densityKey}".`, 'info');
    } else {
      U.$('unitIngredient').value = '__custom';
      U.toast(`Densitas "${item.name}" belum tersedia. Masukkan densitas manual jika mengonversi berat ↔ volume.`, 'warning', 4500);
    }
    convert();
  }

  function convert() {
    const valRaw = U.$('unitValue')?.value;
    const val = U.parseQtyValue(valRaw);
    const from = U.$('unitFrom')?.value || 'gram';
    const to = U.$('unitTo')?.value || 'sdm';
    const ingKey = U.$('unitIngredient')?.value || 'Tepung terigu';

    const fromDim = U.getUnitDimension(from);
    const toDim = U.getUnitDimension(to);
    const needsDensity = (fromDim === 'weight' && toDim === 'volume') || (fromDim === 'volume' && toDim === 'weight');
    const needsPieceWeight = (fromDim === 'count' && toDim !== 'count') || (toDim === 'count' && fromDim !== 'count');

    const densityBox = U.$('unitDensitySection');
    const customDensityWrap = U.$('unitCustomDensityWrap');
    const pieceWeightWrap = U.$('unitPieceWeightWrap');
    const resultBox = U.$('unitResultBox');

    if (densityBox) densityBox.style.display = needsDensity ? 'block' : 'none';
    if (customDensityWrap) customDensityWrap.style.display = needsDensity && ingKey === '__custom' ? 'block' : 'none';
    if (pieceWeightWrap) pieceWeightWrap.style.display = needsPieceWeight ? 'block' : 'none';

    if (!Number.isFinite(val) || val < 0) {
      resultBox.innerHTML = `<div class="alert alert-warning">Masukkan nilai angka atau pecahan positif (contoh: 100, 1.5, atau 1/2).</div>`;
      lastResult = null;
      return;
    }

    // Case 1: Same dimension (weight<->weight, volume<->volume, or identical count unit)
    const direct = U.convertSameDimension(val, from, to);
    if (direct !== null) {
      lastResult = {
        ingredient: fromDim === 'weight' ? 'Konversi Berat Langsung' : fromDim === 'volume' ? 'Konversi Volume Langsung' : 'Konversi Satuan',
        val, from, to, out: direct, note: 'Konversi eksak dalam kategori satuan yang sama.'
      };
      resultBox.innerHTML = `
        <div class="unit-result-main">
          <span class="unit-eq">${U.fmt(val)} ${U.esc(from)} =</span>
          <strong class="unit-out">${U.fmt(direct, 4)} ${U.esc(to)}</strong>
        </div>
        <p class="field-hint">Konversi eksak (${fromDim === 'weight' ? 'berat ↔ berat' : fromDim === 'volume' ? 'volume ↔ volume' : 'satuan sama'}). Standar dapur: 1 sdt = 5 ml, 1 sdm = 15 ml, 1 cup = 240 ml.</p>
      `;
      return;
    }

    // Case 2: Count (pcs/butir) <-> Count (pcs vs butir)
    if (fromDim === 'count' && toDim === 'count') {
      lastResult = { ingredient: 'Satuan hitung', val, from, to, out: val, note: '1 pcs = 1 butir (satuan hitung).' };
      resultBox.innerHTML = `
        <div class="unit-result-main">
          <span class="unit-eq">${U.fmt(val)} ${U.esc(from)} =</span>
          <strong class="unit-out">${U.fmt(val, 4)} ${U.esc(to)}</strong>
        </div>
        <p class="field-hint">Keduanya merupakan satuan hitung (1 butir = 1 pcs).</p>
      `;
      return;
    }

    // Case 3: Count (pcs/butir) <-> Weight or Volume — requires weight per 1 piece!
    if (needsPieceWeight) {
      const pieceGrams = U.parseQtyValue(U.$('unitCustomPieceWeight')?.value);
      if (!Number.isFinite(pieceGrams) || pieceGrams <= 0) {
        resultBox.innerHTML = `<div class="alert alert-info">
          Konversi antara <strong>${U.esc(from)}</strong> dan <strong>${U.esc(to)}</strong> memerlukan berat rata-rata per 1 ${fromDim === 'count' ? U.esc(from) : U.esc(to)} (misalnya 1 butir telur utuh ≈ 50–55 gram). Masukkan berat per satuan di atas.
        </div>`;
        lastResult = null;
        return;
      }
      if (toDim === 'weight' || fromDim === 'weight') {
        let out;
        if (fromDim === 'count') {
          const grams = val * pieceGrams;
          out = U.convertSameDimension(grams, 'gram', to);
        } else {
          const grams = U.convertSameDimension(val, from, 'gram');
          out = U.cleanNumber(grams / pieceGrams);
        }
        lastResult = { ingredient: `Satuan hitung (${U.fmt(pieceGrams)} g/unit)`, val, from, to, out, note: `Berdasarkan asumsi ${U.fmt(pieceGrams)} gram per 1 ${fromDim === 'count' ? from : to}.` };
        resultBox.innerHTML = `
          <div class="unit-result-main">
            <span class="unit-eq">${U.fmt(val)} ${U.esc(from)} ≈</span>
            <strong class="unit-out">${U.fmt(out, 4)} ${U.esc(to)}</strong>
          </div>
          <p class="field-hint">Perkiraan berdasarkan ${U.fmt(pieceGrams)} gram per 1 ${fromDim === 'count' ? U.esc(from) : U.esc(to)}.</p>
        `;
        return;
      }
      resultBox.innerHTML = `<div class="alert alert-info">Konversi langsung satuan hitung (<strong>${U.esc(from)}</strong>) ke volume (<strong>${U.esc(to)}</strong>) tidak presisi. Konversikan ke gram terlebih dahulu.</div>`;
      lastResult = null;
      return;
    }

    // Case 4: Weight <-> Volume — MUST use density (never assume 1g = 1ml blindly!)
    let density = null;
    let ingLabel = ingKey;
    let densityNote = '';
    if (ingKey === '__custom') {
      const customD = U.parseQtyValue(U.$('unitCustomDensity')?.value);
      if (!Number.isFinite(customD) || customD <= 0) {
        resultBox.innerHTML = `<div class="alert alert-warning">
          <strong>Densitas bahan diperlukan.</strong> Konversi berat ↔ volume tidak dapat menganggap 1 gram = 1 ml untuk semua bahan. Masukkan densitas bahan (dalam gram/ml, misal tepung ≈ 0.53, gula ≈ 0.84, madu ≈ 1.42) pada kolom di atas.
        </div>`;
        lastResult = null;
        return;
      }
      density = customD;
      ingLabel = 'Bahan Kustom';
      densityNote = `Densitas kustom ${U.fmt(density, 3)} g/ml`;
    } else {
      const entry = DENSITIES[ingKey];
      if (!entry) {
        lastResult = null;
        return;
      }
      density = entry.gPerMl;
      densityNote = `Estimasi densitas ${U.fmt(density, 2)} g/ml (${entry.note})`;
    }

    let out;
    if (fromDim === 'weight') {
      const grams = U.convertSameDimension(val, from, 'gram');
      const ml = grams / density;
      out = U.convertSameDimension(ml, 'ml', to);
    } else {
      const ml = U.convertSameDimension(val, from, 'ml');
      const grams = ml * density;
      out = U.convertSameDimension(grams, 'gram', to);
    }

    lastResult = {
      ingredient: ingLabel,
      val,
      from,
      to,
      out: U.cleanNumber(out),
      density,
      note: densityNote
    };

    resultBox.innerHTML = `
      <div class="unit-result-main">
        <span class="unit-eq">${U.fmt(val)} ${U.esc(from)} ${U.esc(ingLabel)} ≈</span>
        <strong class="unit-out">${U.fmt(out, 4)} ${U.esc(to)}</strong>
      </div>
      <p class="field-hint">${U.esc(densityNote)} · 1 sdt = 5 ml, 1 sdm = 15 ml, 1 cup = 240 ml. Untuk akurasi tinggi, gunakan timbangan digital.</p>
    `;
  }

  function saveToHistory() {
    if (!lastResult) {
      U.toast('Lakukan konversi yang valid terlebih dahulu sebelum menyimpan ke riwayat.', 'warning');
      return;
    }
    const { ingredient, val, from, to, out, note } = lastResult;
    const saved = S.addHistoryEntry({
      type: 'Konversi Satuan',
      name: ingredient,
      summary: `${U.fmt(val)} ${from} → ${U.fmt(out, 4)} ${to}`,
      total: null,
      inputs: { ingredient, value: val, from, to },
      results: { output: out, to, note }
    });
    if (saved) U.toast('Hasil konversi satuan disimpan ke Riwayat.', 'success');
  }

  window.BCP.units = {
    init,
    loadRecipe,
    convert,
    DENSITIES
  };
})();
