/**
 * Baking Calculator Pro — Buku Resep & Unified Recipe Editor (window.BCP.recipes)
 * Pusat penyimpanan resep untuk input manual maupun hasil Smart Recipe Import/OCR.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let searchQuery = '';
  let selectedCategory = 'Semua';
  let currentUnrecognized = [];

  function init() {
    populateCategoryControls();
    populateYieldUnitSelect();

    U.$('btnAddRecipe')?.addEventListener('click', () => openFormForNew());
    U.$('btnAddRecipeEmpty')?.addEventListener('click', () => openFormForNew());
    U.$('btnCancelRecipeForm')?.addEventListener('click', closeForm);
    U.$('btnCloseRecipeFormTop')?.addEventListener('click', closeForm);
    U.$('btnAddIngredientRow')?.addEventListener('click', () => addIngredientRow());
    U.$('btnSaveRecipe')?.addEventListener('click', saveForm);

    U.$('rfYieldUnit')?.addEventListener('change', toggleCustomYieldUnit);
    U.$('rfPanShape')?.addEventListener('change', togglePanFields);

    U.$('bookSearch')?.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      render();
    });
    U.$('bookCategoryFilter')?.addEventListener('change', (e) => {
      selectedCategory = e.target.value;
      render();
    });

    U.$('btnReprocessFromForm')?.addEventListener('click', () => {
      const raw = U.$('rfImportRawText')?.value || '';
      if (window.BCP.importer) {
        const parsed = window.BCP.importer.parseRecipeText(raw, U.$('rfName')?.value || '');
        populateImportDataIntoOpenForm(parsed);
        U.toast(`Teks diproses ulang: ${parsed.ingredients.length} bahan dikenali.`, 'success');
      }
    });

    U.$('btnCloseRecipeDetailModal')?.addEventListener('click', closeDetailModal);
    U.$('recipeDetailModal')?.addEventListener('click', (e) => {
      if (e.target === U.$('recipeDetailModal')) closeDetailModal();
    });

    S.subscribe(render);
    render();
  }

  function populateCategoryControls() {
    const formCat = U.$('rfCategory');
    if (formCat) {
      formCat.innerHTML = U.RECIPE_CATEGORIES.map((c) => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join('');
    }
    const filterCat = U.$('bookCategoryFilter');
    if (filterCat) {
      filterCat.innerHTML = `<option value="Semua">Semua kategori</option>` +
        U.RECIPE_CATEGORIES.map((c) => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join('');
    }
  }

  function populateYieldUnitSelect() {
    const el = U.$('rfYieldUnit');
    if (!el) return;
    el.innerHTML = U.YIELD_UNITS.map((u) => `<option value="${U.esc(u)}">${U.esc(u)}</option>`).join('') +
      `<option value="__custom">Satuan khusus…</option>`;
    el.value = 'pcs';
  }

  function toggleCustomYieldUnit() {
    const sel = U.$('rfYieldUnit');
    const customBox = U.$('rfYieldUnitCustomWrap');
    if (!sel || !customBox) return;
    customBox.style.display = sel.value === '__custom' ? 'block' : 'none';
  }

  function togglePanFields() {
    const shape = U.$('rfPanShape')?.value || '';
    const box = U.$('rfPanSizeWrap');
    const fieldB = U.$('rfPanSizeBWrap');
    const labelA = U.$('rfPanSizeALabel');
    if (!box) return;
    if (!shape) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'grid';
    if (shape === 'round') {
      if (labelA) labelA.textContent = 'Diameter loyang (cm)';
      if (fieldB) fieldB.style.display = 'none';
    } else {
      if (labelA) labelA.textContent = 'Panjang loyang (cm)';
      if (fieldB) fieldB.style.display = 'block';
    }
  }

  function clearFormError() {
    const el = U.$('rfError');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function showFormError(msg) {
    const el = U.$('rfError');
    if (el) {
      el.innerHTML = msg;
      el.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      U.toast(msg, 'error');
    }
  }

  function addIngredientRow(item = {}) {
    const container = U.$('rfIngredientsList');
    if (!container) return null;

    const unitNorm = U.normUnit(item.unit || 'gram') || 'gram';
    const isStandard = U.STANDARD_UNITS.includes(unitNorm);
    const selectVal = isStandard ? unitNorm : '__custom';
    const customVal = isStandard ? '' : unitNorm;
    const qtyDisplay = item.qtyRaw !== undefined && item.qtyRaw !== null && String(item.qtyRaw).trim() !== ''
      ? String(item.qtyRaw).trim()
      : (item.qty !== null && item.qty !== undefined && Number.isFinite(Number(item.qty)) ? String(item.qty) : '');

    const row = document.createElement('div');
    row.className = 'ingredient-row-card';
    row.innerHTML = `
      <div class="ing-col ing-col-name">
        <label class="ing-mobile-label">Nama bahan</label>
        <input type="text" class="rf-ing-name" placeholder="Contoh: Tepung terigu" value="${U.esc(item.name || '')}">
      </div>
      <div class="ing-col ing-col-qty">
        <label class="ing-mobile-label">Jumlah (desimal / pecahan)</label>
        <input type="text" inputmode="decimal" class="rf-ing-qty" placeholder="250 atau 1/2" value="${U.esc(qtyDisplay)}">
      </div>
      <div class="ing-col ing-col-unit">
        <label class="ing-mobile-label">Satuan</label>
        <select class="rf-ing-unit">
          ${U.STANDARD_UNITS.map((u) => `<option value="${U.esc(u)}" ${u === selectVal ? 'selected' : ''}>${U.esc(u)}</option>`).join('')}
          <option value="__custom" ${selectVal === '__custom' ? 'selected' : ''}>Satuan khusus…</option>
        </select>
        <input type="text" class="rf-ing-unit-custom" placeholder="Ketik satuan" value="${U.esc(customVal)}" style="display:${selectVal === '__custom' ? 'block' : 'none'};margin-top:6px">
      </div>
      <div class="ing-col ing-col-note">
        <label class="ing-mobile-label">Catatan (opsional)</label>
        <input type="text" class="rf-ing-note" placeholder="ayak / suhu ruang" value="${U.esc(item.note || '')}">
      </div>
      <div class="ing-col ing-col-del">
        <button type="button" class="btn btn-icon btn-danger-outline rf-ing-remove" aria-label="Hapus bahan" title="Hapus bahan">✕</button>
      </div>
    `;

    const unitSel = row.querySelector('.rf-ing-unit');
    const customInput = row.querySelector('.rf-ing-unit-custom');
    unitSel.addEventListener('change', () => {
      customInput.style.display = unitSel.value === '__custom' ? 'block' : 'none';
      if (unitSel.value === '__custom') customInput.focus();
    });

    row.querySelector('.rf-ing-remove').addEventListener('click', () => {
      row.remove();
      updateIngredientCountBadge();
    });

    container.appendChild(row);
    updateIngredientCountBadge();
    return row;
  }

  function updateIngredientCountBadge() {
    const count = U.$('rfIngredientsList')?.children.length || 0;
    const badge = U.$('rfIngredientCount');
    if (badge) badge.textContent = `${count} bahan`;
  }

  function renderUnrecognizedPanel(lines) {
    currentUnrecognized = Array.isArray(lines) ? [...lines] : [];
    const wrap = U.$('rfUnrecognizedWrap');
    const list = U.$('rfUnrecognizedList');
    if (!wrap || !list) return;

    if (!currentUnrecognized.length) {
      wrap.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    wrap.style.display = 'block';
    list.innerHTML = currentUnrecognized.map((line, idx) => `
      <div class="unrec-item">
        <span class="unrec-text">${U.esc(line)}</span>
        <div class="unrec-actions">
          <button type="button" class="btn btn-sm btn-soft" data-unrec-add="${idx}">+ Masukkan ke Bahan</button>
          <button type="button" class="btn btn-sm btn-ghost" data-unrec-skip="${idx}" aria-label="Abaikan baris">Abaikan</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-unrec-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-unrec-add'));
        const text = currentUnrecognized[i];
        if (text) {
          // Insert with blank qty (NEVER 0!) so user fills qty accurately
          const row = addIngredientRow({ name: text, qtyRaw: '', unit: 'gram', note: 'Periksa jumlah & satuan' });
          currentUnrecognized.splice(i, 1);
          renderUnrecognizedPanel(currentUnrecognized);
          row?.querySelector('.rf-ing-qty')?.focus();
        }
      });
    });

    list.querySelectorAll('[data-unrec-skip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-unrec-skip'));
        currentUnrecognized.splice(i, 1);
        renderUnrecognizedPanel(currentUnrecognized);
      });
    });
  }

  function resetFormFields() {
    clearFormError();
    U.$('rfId').value = '';
    U.$('rfSource').value = 'manual';
    U.$('rfName').value = '';
    U.$('rfCategory').value = U.RECIPE_CATEGORIES[0];
    U.$('rfDescription').value = '';
    U.$('rfYield').value = '1';
    U.$('rfYieldUnit').value = 'pcs';
    U.$('rfYieldUnitCustom').value = '';
    toggleCustomYieldUnit();
    U.$('rfPanShape').value = '';
    U.$('rfPanSizeA').value = '';
    U.$('rfPanSizeB').value = '';
    togglePanFields();
    U.$('rfNotes').value = '';
    U.$('rfIngredientsList').innerHTML = '';
    const rawWrap = U.$('rfImportRawWrap');
    if (rawWrap) rawWrap.style.display = 'none';
    if (U.$('rfImportRawText')) U.$('rfImportRawText').value = '';
    renderUnrecognizedPanel([]);
  }

  function showEditorView(titleText, subtitleText) {
    if (U.$('rfFormTitle')) U.$('rfFormTitle').textContent = titleText;
    if (U.$('rfFormSubtitle')) U.$('rfFormSubtitle').textContent = subtitleText;
    const editorPanel = U.$('recipeEditorPanel');
    const listPanel = U.$('recipeListSection');
    if (editorPanel) editorPanel.style.display = 'block';
    if (listPanel) listPanel.style.display = 'none';
    if (window.BCP.app) window.BCP.app.showPage('book');
    editorPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeForm() {
    const editorPanel = U.$('recipeEditorPanel');
    const listPanel = U.$('recipeListSection');
    if (editorPanel) editorPanel.style.display = 'none';
    if (listPanel) listPanel.style.display = 'block';
    clearFormError();
  }

  function openFormForNew() {
    resetFormFields();
    addIngredientRow({ name: '', qtyRaw: '', unit: 'gram', note: '' });
    showEditorView('Tambah Resep Manual', 'Isi informasi resep dan daftar bahan. Mendukung angka desimal maupun pecahan (1/2, 1/4, 3/4).');
    U.$('rfName')?.focus();
  }

  function openFormForEdit(id) {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === id);
    if (!r) return;
    S.setLastOpenedRecipe(r.id);

    resetFormFields();
    U.$('rfId').value = r.id;
    U.$('rfSource').value = r.source || 'manual';
    U.$('rfName').value = r.name;
    U.$('rfCategory').value = U.RECIPE_CATEGORIES.includes(r.category) ? r.category : 'Lainnya';
    U.$('rfDescription').value = r.description || '';
    U.$('rfYield').value = r.baseYield;

    if (U.YIELD_UNITS.includes(r.yieldUnit)) {
      U.$('rfYieldUnit').value = r.yieldUnit;
      U.$('rfYieldUnitCustom').value = '';
    } else {
      U.$('rfYieldUnit').value = '__custom';
      U.$('rfYieldUnitCustom').value = r.yieldUnit || '';
    }
    toggleCustomYieldUnit();

    U.$('rfPanShape').value = r.panShape || '';
    U.$('rfPanSizeA').value = r.panSizeA || '';
    U.$('rfPanSizeB').value = r.panSizeB || '';
    togglePanFields();

    U.$('rfNotes').value = r.notes || '';
    if (r.items && r.items.length) {
      r.items.forEach((item) => addIngredientRow(item));
    } else {
      addIngredientRow();
    }

    showEditorView(`Edit Resep: ${r.name}`, 'Perubahan akan memperbarui resep ini tanpa mengganti ID atau membuat duplikat.');
  }

  function populateImportDataIntoOpenForm(parsed) {
    U.$('rfIngredientsList').innerHTML = '';
    if (parsed.ingredients && parsed.ingredients.length) {
      parsed.ingredients.forEach((ing) => addIngredientRow(ing));
    } else {
      addIngredientRow();
    }
    renderUnrecognizedPanel(parsed.unrecognized || []);
  }

  /**
   * Called directly by Smart Recipe Import/OCR so extracted data automatically fills the unified Recipe Book form!
   */
  function openFormWithImportedData({ title = '', category = '', ingredients = [], unrecognized = [], rawText = '', source = 'ocr', notes = '' }) {
    resetFormFields();
    U.$('rfSource').value = source || 'ocr';
    U.$('rfName').value = title || '';
    if (category && U.RECIPE_CATEGORIES.includes(category)) {
      U.$('rfCategory').value = category;
    }
    if (notes) U.$('rfNotes').value = notes;

    if (rawText) {
      const rawWrap = U.$('rfImportRawWrap');
      if (rawWrap) rawWrap.style.display = 'block';
      if (U.$('rfImportRawText')) U.$('rfImportRawText').value = rawText;
    }

    populateImportDataIntoOpenForm({ ingredients, unrecognized });

    showEditorView(
      'Review & Simpan Resep Hasil Import',
      'Hasil ekstraksi otomatis telah mengisi form resep. Periksa nama, jumlah, satuan, dan baris yang belum dikenali sebelum menyimpan.'
    );
  }

  function saveForm() {
    clearFormError();
    const id = U.$('rfId').value.trim();
    const source = U.$('rfSource').value || 'manual';
    const name = U.$('rfName').value.trim();
    const category = U.$('rfCategory').value || 'Lainnya';
    const description = U.$('rfDescription').value.trim();
    const yieldRaw = U.$('rfYield').value.trim();
    const yieldVal = U.parseQtyValue(yieldRaw);

    let yieldUnit = U.$('rfYieldUnit').value;
    if (yieldUnit === '__custom') {
      yieldUnit = U.$('rfYieldUnitCustom').value.trim();
      if (!yieldUnit) return showFormError('Isi nama satuan hasil khusus (misal: jar, box, loyang mini).');
    }

    const panShape = U.$('rfPanShape').value;
    const panSizeARaw = U.$('rfPanSizeA').value.trim();
    const panSizeBRaw = U.$('rfPanSizeB').value.trim();
    const notes = U.$('rfNotes').value.trim();

    if (!name) return showFormError('Nama resep wajib diisi.');
    if (!yieldRaw || !Number.isFinite(yieldVal) || yieldVal <= 0) {
      return showFormError('Hasil resep / yield harus berupa angka lebih dari 0.');
    }

    let panSizeA = null;
    let panSizeB = null;
    if (panShape === 'round') {
      const a = U.parseQtyValue(panSizeARaw);
      if (!Number.isFinite(a) || a <= 0) return showFormError('Isi diameter loyang bulat dengan angka lebih dari 0, atau pilih "Tidak ditentukan".');
      panSizeA = a;
    } else if (panShape === 'square') {
      const a = U.parseQtyValue(panSizeARaw);
      const b = U.parseQtyValue(panSizeBRaw);
      if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b) || b <= 0) {
        return showFormError('Isi panjang dan lebar loyang persegi/persegi panjang dengan angka lebih dari 0.');
      }
      panSizeA = a;
      panSizeB = b;
    }

    const rowEls = [...(U.$('rfIngredientsList')?.children || [])];
    if (!rowEls.length) {
      return showFormError('Tambahkan minimal 1 bahan terlebih dahulu.');
    }

    const items = [];
    const errors = [];

    rowEls.forEach((row, idx) => {
      const ingName = row.querySelector('.rf-ing-name').value.trim();
      const qtyRaw = row.querySelector('.rf-ing-qty').value.trim();
      const unitSel = row.querySelector('.rf-ing-unit').value;
      const customUnit = row.querySelector('.rf-ing-unit-custom').value.trim();
      const unit = unitSel === '__custom' ? U.normUnit(customUnit) : unitSel;
      const note = row.querySelector('.rf-ing-note').value.trim();

      // Skip completely blank trailing row ONLY if there are other rows, otherwise flag error
      if (!ingName && !qtyRaw && !note) {
        if (rowEls.length === 1) {
          errors.push(`Baris bahan #${idx + 1}: isi nama bahan dan jumlah.`);
        }
        return;
      }

      if (!ingName) {
        errors.push(`Baris bahan #${idx + 1}: nama bahan belum diisi.`);
        return;
      }
      if (!unit) {
        errors.push(`Baris "${ingName}": isi satuan khusus.`);
        return;
      }

      if (unit === 'secukupnya') {
        const qParsed = qtyRaw ? U.parseQtyValue(qtyRaw) : null;
        items.push({
          name: ingName,
          qty: Number.isFinite(qParsed) && qParsed > 0 ? qParsed : null,
          qtyRaw: qtyRaw || '',
          unit,
          note
        });
        return;
      }

      // NEVER turn blank into 0 silently!
      if (!qtyRaw) {
        errors.push(`Baris "${ingName}": jumlah belum diisi. Masukkan angka/pecahan atau pilih satuan "secukupnya".`);
        return;
      }
      const qParsed = U.parseQtyValue(qtyRaw);
      if (!Number.isFinite(qParsed) || qParsed <= 0) {
        errors.push(`Baris "${ingName}": jumlah "${qtyRaw}" tidak valid. Gunakan angka desimal (mis. 1.5) atau pecahan (mis. 1/2, 1/4, 3/4).`);
        return;
      }

      items.push({
        name: ingName,
        qty: qParsed,
        qtyRaw,
        unit,
        note
      });
    });

    if (errors.length) {
      return showFormError(`<strong>Periksa daftar bahan:</strong><br>${errors.map((e) => `• ${U.esc(e)}`).join('<br>')}`);
    }
    if (!items.length) {
      return showFormError('Minimal harus ada 1 bahan yang valid.');
    }

    const s = S.getState();
    const now = new Date().toISOString();
    const idx = id ? s.recipes.findIndex((r) => r.id === id) : -1;

    const recipeObj = S.sanitizeRecipe({
      id: idx >= 0 ? s.recipes[idx].id : U.generateId(),
      name,
      category,
      description,
      baseYield: yieldVal,
      yieldUnit,
      panShape,
      panSizeA,
      panSizeB,
      notes,
      source: idx >= 0 ? s.recipes[idx].source : source,
      items,
      createdAt: idx >= 0 ? s.recipes[idx].createdAt : now,
      updatedAt: now
    });

    if (idx >= 0) {
      s.recipes[idx] = recipeObj;
      U.toast(`Resep "${recipeObj.name}" berhasil diperbarui.`, 'success');
    } else {
      s.recipes.push(recipeObj);
      U.toast(`Resep "${recipeObj.name}" disimpan ke Buku Resep.`, 'success');
    }

    s.meta.lastOpenedRecipeId = recipeObj.id;
    S.persist();
    closeForm();
  }

  /**
   * Programmatically save a NEW recipe (e.g. from Scaling or Pan Conversion) without touching the original.
   */
  function saveNewRecipeFromCalculator(recipePayload) {
    const s = S.getState();
    const now = new Date().toISOString();
    const obj = S.sanitizeRecipe({
      ...recipePayload,
      id: U.generateId(),
      createdAt: now,
      updatedAt: now
    });
    if (!obj) return null;
    s.recipes.push(obj);
    s.meta.lastOpenedRecipeId = obj.id;
    S.persist();
    return obj;
  }

  async function deleteRecipe(id) {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === id);
    if (!r) return;
    const ok = await U.confirmDialog({
      title: 'Hapus Resep',
      message: `Yakin ingin menghapus resep "${r.name}" dari Buku Resep? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Hapus Resep',
      danger: true
    });
    if (!ok) return;
    s.recipes = s.recipes.filter((x) => x.id !== id);
    if (s.meta.lastOpenedRecipeId === id) {
      s.meta.lastOpenedRecipeId = s.recipes.length ? s.recipes[s.recipes.length - 1].id : null;
    }
    S.persist();
    U.toast(`Resep "${r.name}" dihapus.`, 'info');
  }

  function formatPanSummary(r) {
    if (r.panShape === 'round' && r.panSizeA) return `Bulat Ø ${U.fmt(r.panSizeA)} cm`;
    if (r.panShape === 'square' && r.panSizeA && r.panSizeB) return `Kotak ${U.fmt(r.panSizeA)}×${U.fmt(r.panSizeB)} cm`;
    return '';
  }

  function populateRecipeSelect(selectEl, placeholder = 'Pilih resep dari Buku Resep…') {
    if (!selectEl) return;
    const prev = selectEl.value;
    const s = S.getState();
    selectEl.innerHTML = `<option value="">${U.esc(placeholder)}</option>` +
      s.recipes.map((r) => `<option value="${U.esc(r.id)}">${U.esc(r.name)} (${U.fmt(r.baseYield)} ${U.esc(r.yieldUnit)} · ${r.items.length} bahan)</option>`).join('');
    if (s.recipes.some((r) => r.id === prev)) {
      selectEl.value = prev;
    }
  }

  function closeDetailModal() {
    const modal = U.$('recipeDetailModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function openDetail(id) {
    const s = S.getState();
    const r = s.recipes.find((x) => x.id === id);
    const modal = U.$('recipeDetailModal');
    const body = U.$('recipeDetailBody');
    if (!r || !modal || !body) return;

    S.setLastOpenedRecipe(r.id);
    const V = window.BCP.visuals;
    const imgSrc = V ? V.getRecipeImage(r) : './assets/images/baking-ingredients.jpg';
    const panBadge = formatPanSummary(r);

    if (U.$('recipeDetailTitle')) U.$('recipeDetailTitle').textContent = r.name;

    body.innerHTML = `
      <div class="rd-hero-wrap">
        ${V ? V.imgTag({ src: imgSrc, alt: r.name, className: 'rd-hero-img', width: 720, height: 420, lazy: false }) : ''}
        <div class="rd-hero-badges">
          <span class="chip chip-glass">${U.esc(r.category)}</span>
          ${r.source === 'ocr' || r.source === 'import' ? '<span class="chip chip-info">Import OCR</span>' : ''}
          ${panBadge ? `<span class="chip chip-glass">${U.esc(panBadge)}</span>` : ''}
        </div>
      </div>

      ${r.description ? `<p class="rd-desc">${U.esc(r.description)}</p>` : ''}

      <div class="rd-meta-strip">
        <div><span class="muted small-note">Hasil Resep</span><strong>${U.fmt(r.baseYield)} ${U.esc(r.yieldUnit)}</strong></div>
        <div><span class="muted small-note">Total Bahan</span><strong>${r.items.length} item</strong></div>
        <div><span class="muted small-note">Diperbarui</span><strong>${U.formatDate(r.updatedAt)}</strong></div>
      </div>

      <h4 class="detail-subhead">Daftar Bahan</h4>
      <div class="detail-list">
        ${r.items.map((it) => {
          const qtyStr = it.qty !== null ? `${U.fmt(it.qty)} ` : '';
          return `<div class="detail-list-row">
            <div>
              <strong>${U.esc(it.name)}</strong>
              ${it.note ? `<div class="small-note muted">${U.esc(it.note)}</div>` : ''}
            </div>
            <strong>${qtyStr}${U.esc(it.unit)}</strong>
          </div>`;
        }).join('')}
      </div>

      ${r.notes ? `<h4 class="detail-subhead">Catatan Resep</h4><div class="rd-notes">${U.esc(r.notes)}</div>` : ''}

      <div class="actions-row" style="margin-top:18px">
        <button type="button" class="btn btn-primary btn-sm" id="rdBtnEdit">Edit Resep</button>
        <button type="button" class="btn btn-soft btn-sm" id="rdBtnScale">Scaling</button>
        <button type="button" class="btn btn-soft btn-sm" id="rdBtnPan">Konversi Loyang</button>
        <button type="button" class="btn btn-soft btn-sm" id="rdBtnHpp">Hitung HPP</button>
        <button type="button" class="btn btn-danger-outline btn-sm" id="rdBtnDel">Hapus</button>
      </div>
    `;

    U.$('rdBtnEdit')?.addEventListener('click', () => {
      closeDetailModal();
      openFormForEdit(r.id);
    });
    U.$('rdBtnScale')?.addEventListener('click', () => {
      closeDetailModal();
      window.BCP.scaling?.loadRecipe(r.id);
      window.BCP.app?.showPage('scaling');
    });
    U.$('rdBtnPan')?.addEventListener('click', () => {
      closeDetailModal();
      window.BCP.pan?.loadRecipe(r.id);
      window.BCP.app?.showPage('pan');
    });
    U.$('rdBtnHpp')?.addEventListener('click', () => {
      closeDetailModal();
      window.BCP.hpp?.loadRecipe(r.id);
      window.BCP.app?.showPage('hpp');
    });
    U.$('rdBtnDel')?.addEventListener('click', async () => {
      closeDetailModal();
      await deleteRecipe(r.id);
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function render() {
    const container = U.$('recipeCardsGrid');
    const countEl = U.$('bookCountLabel');
    if (!container) return;

    const s = S.getState();
    const V = window.BCP.visuals;
    const filtered = s.recipes.filter((r) => {
      const catOk = selectedCategory === 'Semua' || r.category === selectedCategory;
      const qOk = !searchQuery ||
        r.name.toLowerCase().includes(searchQuery) ||
        r.category.toLowerCase().includes(searchQuery) ||
        (r.description || '').toLowerCase().includes(searchQuery) ||
        r.items.some((i) => i.name.toLowerCase().includes(searchQuery));
      return catOk && qOk;
    });

    if (countEl) {
      countEl.textContent = `${filtered.length} dari ${s.recipes.length} resep`;
    }

    if (!s.recipes.length) {
      container.innerHTML = `<div class="empty-state empty-state-illustrated">
        ${V ? V.imgTag({ src: V.IMAGES.bakingIngredients, alt: 'Ilustrasi bahan baking', className: 'empty-thumb', width: 220, height: 130 }) : ''}
        <p class="empty-title">Buku Resep masih kosong</p>
        <p class="empty-sub">Mulai dengan menambah resep manual atau gunakan Smart Recipe Import untuk membaca resep dari foto/dokumen.</p>
        <div class="actions-center">
          <button type="button" class="btn btn-primary" id="btnAddRecipeEmptyInline">+ Tambah Resep Manual</button>
          <button type="button" class="btn btn-soft" id="btnGoImportInline">Import Resep / OCR</button>
        </div>
      </div>`;
      U.$('btnAddRecipeEmptyInline')?.addEventListener('click', () => openFormForNew());
      U.$('btnGoImportInline')?.addEventListener('click', () => window.BCP.app?.showPage('import'));
      return;
    }

    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state">
        <p class="empty-title">Resep tidak ditemukan</p>
        <p class="empty-sub">Coba ubah kata kunci pencarian atau pilih kategori lain.</p>
      </div>`;
      return;
    }

    container.innerHTML = filtered.slice().reverse().map((r) => {
      const panBadge = formatPanSummary(r);
      const imgSrc = V ? V.getRecipeImage(r) : './assets/images/baking-ingredients.jpg';

      return `<article class="recipe-catalog-card">
        <div class="rcat-media" data-rc-detail="${U.esc(r.id)}" role="button" tabindex="0" aria-label="Lihat detail ${U.esc(r.name)}">
          ${V ? V.imgTag({ src: imgSrc, alt: r.name, className: 'rcat-img', width: 420, height: 270 }) : ''}
          <div class="rcat-media-badges">
            <span class="chip chip-glass">${U.esc(r.category)}</span>
            ${r.source === 'ocr' || r.source === 'import' ? '<span class="chip chip-info">OCR</span>' : ''}
          </div>
          ${panBadge ? `<span class="rcat-pan-pill">${U.esc(panBadge)}</span>` : ''}
        </div>
        <div class="rcat-body">
          <div class="rcat-meta-row">
            <span>${U.fmt(r.baseYield)} ${U.esc(r.yieldUnit)}</span>
            <span>•</span>
            <span>${r.items.length} bahan</span>
          </div>
          <h3 class="rcat-title" data-rc-detail="${U.esc(r.id)}" role="button" tabindex="0">${U.esc(r.name)}</h3>
          ${r.description ? `<p class="rcat-desc">${U.esc(r.description)}</p>` : ''}
          <div class="rcat-actions">
            <button type="button" class="btn btn-sm btn-primary" data-rc-detail="${U.esc(r.id)}">Detail</button>
            <button type="button" class="btn btn-sm btn-soft" data-rc-edit="${U.esc(r.id)}">Edit</button>
            <button type="button" class="btn btn-sm btn-ghost" data-rc-hpp="${U.esc(r.id)}" title="Hitung HPP resep ini">HPP</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-rc-del="${U.esc(r.id)}" aria-label="Hapus ${U.esc(r.name)}">Hapus</button>
          </div>
        </div>
      </article>`;
    }).join('');

    container.querySelectorAll('[data-rc-detail]').forEach((el) => {
      el.addEventListener('click', () => openDetail(el.getAttribute('data-rc-detail')));
    });
    container.querySelectorAll('[data-rc-edit]').forEach((b) => {
      b.addEventListener('click', () => openFormForEdit(b.getAttribute('data-rc-edit')));
    });
    container.querySelectorAll('[data-rc-hpp]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-rc-hpp');
        S.setLastOpenedRecipe(id);
        window.BCP.hpp?.loadRecipe(id);
        window.BCP.app?.showPage('hpp');
      });
    });
    container.querySelectorAll('[data-rc-del]').forEach((b) => {
      b.addEventListener('click', () => deleteRecipe(b.getAttribute('data-rc-del')));
    });
  }

  window.BCP.recipes = {
    init,
    render,
    openDetail,
    openFormForNew,
    openFormForEdit,
    openFormWithImportedData,
    closeForm,
    saveNewRecipeFromCalculator,
    deleteRecipe,
    populateRecipeSelect,
    formatPanSummary
  };
})();
