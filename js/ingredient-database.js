/**
 * Baking Calculator Pro — Database Bahan Baku (window.BCP.materials)
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let searchQuery = '';
  let selectedCategory = 'Semua';

  function init() {
    populateCategorySelects();
    populateUnitSelects();

    const searchEl = U.$('matSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        render();
      });
    }

    const filterEl = U.$('matCategoryFilter');
    if (filterEl) {
      filterEl.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        render();
      });
    }

    ['matPurchaseUnit', 'matUnit', 'matQty', 'matPrice', 'matConversion'].forEach((id) => {
      const el = U.$(id);
      if (el) el.addEventListener('input', updateConversionPreview);
      if (el) el.addEventListener('change', updateConversionPreview);
    });

    const saveBtn = U.$('matSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveFromForm);

    const resetBtn = U.$('matResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetForm);

    updateConversionPreview();
    S.subscribe(render);
    render();
  }

  function populateCategorySelects() {
    const catEl = U.$('matCategory');
    if (catEl) {
      catEl.innerHTML = U.MATERIAL_CATEGORIES.map((c) => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join('');
    }
    const filterEl = U.$('matCategoryFilter');
    if (filterEl) {
      filterEl.innerHTML = `<option value="Semua">Semua kategori</option>` +
        U.MATERIAL_CATEGORIES.map((c) => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join('');
    }
  }

  function populateUnitSelects() {
    const pEl = U.$('matPurchaseUnit');
    if (pEl) {
      pEl.innerHTML = U.PURCHASE_UNITS.map((u) => `<option value="${U.esc(u)}">${U.esc(u)}</option>`).join('');
      pEl.value = 'gram';
    }
    const uEl = U.$('matUnit');
    if (uEl) {
      uEl.innerHTML = U.USAGE_UNITS.map((u) => `<option value="${U.esc(u)}">${U.esc(u)}</option>`).join('');
      uEl.value = 'gram';
    }
  }

  function updateConversionPreview() {
    const pUnit = U.$('matPurchaseUnit')?.value || 'gram';
    const uUnit = U.$('matUnit')?.value || 'gram';
    const convBox = U.$('matConversionBox');
    const convInput = U.$('matConversion');
    const convLabel = U.$('matConversionLabel');
    const previewEl = U.$('matUnitPricePreview');

    const autoFactor = U.convertSameDimension(1, pUnit, uUnit);
    if (autoFactor !== null) {
      if (convBox) convBox.style.display = 'none';
      if (convInput) convInput.value = autoFactor;
    } else {
      if (convBox) convBox.style.display = 'block';
      if (convLabel) convLabel.textContent = `Konversi (1 ${pUnit} = berapa ${uUnit}?)`;
      if (convInput && (!convInput.value || Number(convInput.value) <= 0)) {
        convInput.value = '1';
      }
    }

    if (previewEl) {
      const price = Number(U.$('matPrice')?.value);
      const qty = U.parseQtyValue(U.$('matQty')?.value);
      const factor = autoFactor !== null ? autoFactor : Number(convInput?.value);
      if (Number.isFinite(price) && price >= 0 && Number.isFinite(qty) && qty > 0 && Number.isFinite(factor) && factor > 0) {
        const effectiveQty = qty * factor;
        const unitPrice = price / effectiveQty;
        previewEl.innerHTML = `Total isi: <strong>${U.fmt(effectiveQty)} ${U.esc(uUnit)}</strong> · Estimasi harga satuan: <strong>${U.moneyPrecise(unitPrice)} / ${U.esc(uUnit)}</strong>`;
      } else {
        previewEl.textContent = 'Isi harga beli dan jumlah kemasan untuk melihat harga per satuan penggunaan.';
      }
    }
  }

  function clearFormError() {
    const errEl = U.$('matFormError');
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  function showFormError(msg) {
    const errEl = U.$('matFormError');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    } else {
      U.toast(msg, 'error');
    }
  }

  function saveFromForm() {
    clearFormError();
    const id = U.$('matId').value.trim();
    const name = U.$('matName').value.trim();
    const category = U.$('matCategory').value || 'Lainnya';
    const priceRaw = U.$('matPrice').value.trim();
    const qtyRaw = U.$('matQty').value.trim();
    const purchaseUnit = U.$('matPurchaseUnit').value || 'gram';
    const unit = U.$('matUnit').value || 'gram';

    if (!name) return showFormError('Nama bahan wajib diisi.');
    if (priceRaw === '' || !Number.isFinite(Number(priceRaw)) || Number(priceRaw) < 0) {
      return showFormError('Harga beli harus berupa angka 0 atau lebih.');
    }
    const qty = U.parseQtyValue(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
      return showFormError('Jumlah pembelian harus lebih besar dari 0 (mendukung desimal & pecahan).');
    }

    const autoFactor = U.convertSameDimension(1, purchaseUnit, unit);
    let conversionFactor = autoFactor;
    if (conversionFactor === null) {
      const manualConv = U.parseQtyValue(U.$('matConversion').value);
      if (!Number.isFinite(manualConv) || manualConv <= 0) {
        return showFormError(`Isi konversi satuan (1 ${purchaseUnit} = berapa ${unit}) dengan angka lebih dari 0.`);
      }
      conversionFactor = manualConv;
    }

    const s = S.getState();
    const duplicate = s.materials.find((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== id);
    if (duplicate) {
      return showFormError(`Bahan "${duplicate.name}" sudah ada di database. Gunakan nama berbeda atau klik Edit pada bahan yang sudah ada.`);
    }

    const now = new Date().toISOString();
    const idx = id ? s.materials.findIndex((m) => m.id === id) : -1;
    const obj = S.sanitizeMaterial({
      id: idx >= 0 ? s.materials[idx].id : U.generateId(),
      name,
      category,
      price: Number(priceRaw),
      qty,
      purchaseUnit,
      unit,
      conversionFactor,
      createdAt: idx >= 0 ? s.materials[idx].createdAt : now,
      updatedAt: now
    });

    if (idx >= 0) {
      s.materials[idx] = obj;
      U.toast(`Bahan "${obj.name}" diperbarui.`, 'success');
    } else {
      s.materials.push(obj);
      U.toast(`Bahan "${obj.name}" ditambahkan ke database.`, 'success');
    }

    resetForm();
    S.persist();
  }

  function resetForm() {
    clearFormError();
    if (U.$('matId')) U.$('matId').value = '';
    if (U.$('matName')) U.$('matName').value = '';
    if (U.$('matCategory')) U.$('matCategory').value = U.MATERIAL_CATEGORIES[0];
    if (U.$('matPrice')) U.$('matPrice').value = '';
    if (U.$('matQty')) U.$('matQty').value = '';
    if (U.$('matPurchaseUnit')) U.$('matPurchaseUnit').value = 'gram';
    if (U.$('matUnit')) U.$('matUnit').value = 'gram';
    if (U.$('matConversion')) U.$('matConversion').value = '1';
    if (U.$('matFormTitle')) U.$('matFormTitle').textContent = 'Tambah Bahan Baku';
    if (U.$('matSaveBtn')) U.$('matSaveBtn').textContent = 'Simpan Bahan';
    updateConversionPreview();
  }

  function editMaterial(id) {
    const s = S.getState();
    const m = s.materials.find((x) => x.id === id);
    if (!m) return;
    clearFormError();
    U.$('matId').value = m.id;
    U.$('matName').value = m.name;
    U.$('matCategory').value = U.MATERIAL_CATEGORIES.includes(m.category) ? m.category : 'Lainnya';
    U.$('matPrice').value = m.price;
    U.$('matQty').value = m.qty;
    U.$('matPurchaseUnit').value = U.PURCHASE_UNITS.includes(m.purchaseUnit) ? m.purchaseUnit : 'gram';
    U.$('matUnit').value = U.USAGE_UNITS.includes(m.unit) ? m.unit : 'gram';
    U.$('matConversion').value = m.conversionFactor || 1;
    if (U.$('matFormTitle')) U.$('matFormTitle').textContent = `Edit Bahan: ${m.name}`;
    if (U.$('matSaveBtn')) U.$('matSaveBtn').textContent = 'Simpan Perubahan';
    updateConversionPreview();
    if (window.BCP.app) window.BCP.app.showPage('materials');
    U.$('matName')?.focus();
  }

  async function deleteMaterial(id) {
    const s = S.getState();
    const m = s.materials.find((x) => x.id === id);
    if (!m) return;
    const ok = await U.confirmDialog({
      title: 'Hapus Bahan Baku',
      message: `Hapus "${m.name}" dari database bahan baku? Resep yang tersimpan tidak akan terhapus.`,
      confirmText: 'Hapus',
      danger: true
    });
    if (!ok) return;
    s.materials = s.materials.filter((x) => x.id !== id);
    if (U.$('matId')?.value === id) resetForm();
    S.persist();
    U.toast(`Bahan "${m.name}" dihapus.`, 'info');
  }

  /**
   * Find best matching material in DB by exact match or normalized name (ignoring notes in parentheses).
   */
  function findMatch(ingredientName) {
    const s = S.getState();
    const rawLower = String(ingredientName ?? '').trim().toLowerCase();
    if (!rawLower) return null;

    // 1. Exact case-insensitive match
    const exact = s.materials.find((m) => m.name.toLowerCase() === rawLower);
    if (exact) return exact;

    // 2. Normalized name match (ignores "(ayak)", "(lelehkan)", etc.)
    const norm = U.normalizeIngredientName(ingredientName);
    if (!norm) return null;
    const normMatch = s.materials.find((m) => U.normalizeIngredientName(m.name) === norm);
    if (normMatch) return normMatch;

    return null;
  }

  /**
   * Quick-save or update material directly from HPP calculator inline price entry.
   */
  function quickUpsertMaterial({ name, price, qty = 1, purchaseUnit, unit, category = 'Lainnya' }) {
    const cleanName = String(name ?? '').trim();
    if (!cleanName || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isFinite(Number(qty)) || Number(qty) <= 0) {
      return null;
    }
    const s = S.getState();
    const uUnit = U.normUnit(unit || purchaseUnit || 'gram') || 'gram';
    const pUnit = U.normUnit(purchaseUnit || uUnit) || uUnit;
    const autoFactor = U.convertSameDimension(1, pUnit, uUnit);
    const now = new Date().toISOString();

    const idx = s.materials.findIndex((m) => m.name.toLowerCase() === cleanName.toLowerCase());
    const obj = S.sanitizeMaterial({
      id: idx >= 0 ? s.materials[idx].id : U.generateId(),
      name: cleanName,
      category: idx >= 0 ? s.materials[idx].category : category,
      price: Number(price),
      qty: Number(qty),
      purchaseUnit: pUnit,
      unit: uUnit,
      conversionFactor: autoFactor !== null ? autoFactor : 1,
      createdAt: idx >= 0 ? s.materials[idx].createdAt : now,
      updatedAt: now
    });

    if (idx >= 0) {
      s.materials[idx] = obj;
    } else {
      s.materials.push(obj);
    }
    S.persist();
    return obj;
  }

  function render() {
    const container = U.$('materialsListContainer');
    const countEl = U.$('matListCount');
    if (!container) return;

    const s = S.getState();
    const filtered = s.materials.filter((m) => {
      const matchesCat = selectedCategory === 'Semua' || m.category === selectedCategory;
      const matchesQuery = !searchQuery ||
        m.name.toLowerCase().includes(searchQuery) ||
        m.category.toLowerCase().includes(searchQuery);
      return matchesCat && matchesQuery;
    });

    if (countEl) {
      countEl.textContent = `${filtered.length} dari ${s.materials.length} bahan`;
    }

    if (!s.materials.length) {
      container.innerHTML = `<div class="empty-state">
        <p class="empty-title">Belum ada bahan baku tersimpan</p>
        <p class="empty-sub">Tambahkan bahan seperti Tepung Terigu, Gula Pasir, Telur, atau Mentega agar Kalkulator HPP dapat menghitung biaya secara otomatis.</p>
      </div>`;
      return;
    }

    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state">
        <p class="empty-title">Bahan tidak ditemukan</p>
        <p class="empty-sub">Coba kata kunci atau kategori lain.</p>
      </div>`;
      return;
    }

    const rowsHtml = filtered.map((m) => {
      const unitPrice = S.getMaterialUnitPrice(m);
      const effQty = S.getMaterialEffectiveUsageQty(m);
      const packInfo = m.purchaseUnit !== m.unit
        ? `${U.fmt(m.qty)} ${U.esc(m.purchaseUnit)} (${U.fmt(effQty)} ${U.esc(m.unit)})`
        : `${U.fmt(m.qty)} ${U.esc(m.purchaseUnit)}`;
      return `<tr>
        <td data-label="Bahan">
          <div class="cell-main"><strong>${U.esc(m.name)}</strong><span class="chip chip-soft">${U.esc(m.category)}</span></div>
        </td>
        <td data-label="Harga Beli">${U.money(m.price)}</td>
        <td data-label="Kemasan">${packInfo}</td>
        <td data-label="Harga Satuan"><strong>${U.moneyPrecise(unitPrice)}</strong> <span class="muted">/ ${U.esc(m.unit)}</span></td>
        <td data-label="Aksi" class="cell-actions">
          <button type="button" class="btn btn-sm btn-soft" data-mat-edit="${U.esc(m.id)}">Edit</button>
          <button type="button" class="btn btn-sm btn-danger-outline" data-mat-del="${U.esc(m.id)}">Hapus</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `<div class="responsive-table-wrap">
      <table class="responsive-table">
        <thead>
          <tr>
            <th>Bahan</th>
            <th>Harga Beli</th>
            <th>Isi Kemasan</th>
            <th>Harga / Satuan</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

    container.querySelectorAll('[data-mat-edit]').forEach((btn) => {
      btn.addEventListener('click', () => editMaterial(btn.getAttribute('data-mat-edit')));
    });
    container.querySelectorAll('[data-mat-del]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMaterial(btn.getAttribute('data-mat-del')));
    });
  }

  window.BCP.materials = {
    init,
    render,
    editMaterial,
    deleteMaterial,
    resetForm,
    findMatch,
    quickUpsertMaterial
  };
})();
