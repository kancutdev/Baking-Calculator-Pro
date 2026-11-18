/**
 * Baking Calculator Pro — Local Storage, Migration, Backup & Restore (window.BCP.storage)
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;

  const DBKEY = 'bakingCalculatorPro_v2';
  const LEGACY_DBKEY = 'bakingCalculatorPro_v1';
  const CORRUPT_BACKUP_KEY = 'bakingCalculatorPro_corrupt_backup';
  const SCHEMA_VERSION = 2;
  const APP_VERSION = '1.3.0';
  const MAX_HISTORY = 300;

  let listeners = [];
  let state = null;
  let loadWarning = null;

  function sanitizeMaterial(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name ?? '').trim();
    const price = Number(raw.price);
    const qty = Number(raw.qty);
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty <= 0) {
      return null;
    }
    const unit = U.normUnit(raw.unit || 'gram') || 'gram';
    const purchaseUnit = U.normUnit(raw.purchaseUnit || unit) || unit;
    let conversionFactor = Number(raw.conversionFactor);
    if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
      const sameDim = U.convertSameDimension(1, purchaseUnit, unit);
      conversionFactor = sameDim !== null ? sameDim : 1;
    }
    const now = new Date().toISOString();
    return {
      id: String(raw.id || U.generateId()),
      name,
      category: String(raw.category || 'Lainnya').trim() || 'Lainnya',
      price: U.cleanNumber(price),
      qty: U.cleanNumber(qty),
      purchaseUnit,
      unit,
      conversionFactor: U.cleanNumber(conversionFactor),
      createdAt: raw.createdAt || raw.date || now,
      updatedAt: raw.updatedAt || raw.date || now
    };
  }

  function sanitizeRecipeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name ?? '').trim();
    if (!name) return null;
    const unit = U.normUnit(raw.unit || 'gram') || 'gram';
    const qtyParsed = raw.qty === '' || raw.qty === null || raw.qty === undefined
      ? NaN
      : U.parseQtyValue(raw.qty);
    const qty = Number.isFinite(qtyParsed) && qtyParsed > 0 ? qtyParsed : null;
    const qtyRaw = raw.qtyRaw !== undefined && raw.qtyRaw !== null && String(raw.qtyRaw).trim() !== ''
      ? String(raw.qtyRaw).trim()
      : (qty !== null ? String(qty) : '');
    return {
      name,
      qty,
      qtyRaw,
      unit,
      note: String(raw.note ?? '').trim()
    };
  }

  function sanitizeRecipe(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name ?? '').trim();
    if (!name) return null;
    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    const items = rawItems.map(sanitizeRecipeItem).filter(Boolean);
    const baseYieldNum = U.parseQtyValue(raw.baseYield);
    const baseYield = Number.isFinite(baseYieldNum) && baseYieldNum > 0 ? baseYieldNum : 1;
    const panShape = ['round', 'square'].includes(raw.panShape) ? raw.panShape : '';
    const panSizeA = Number(raw.panSizeA);
    const panSizeB = Number(raw.panSizeB);
    const now = new Date().toISOString();
    const createdAt = raw.createdAt || raw.date || now;
    const updatedAt = raw.updatedAt || raw.date || createdAt;
    return {
      id: String(raw.id || U.generateId()),
      name,
      category: String(raw.category || 'Lainnya').trim() || 'Lainnya',
      description: String(raw.description ?? '').trim(),
      baseYield,
      yieldUnit: String(raw.yieldUnit || 'loyang').trim() || 'loyang',
      panShape,
      panSizeA: Number.isFinite(panSizeA) && panSizeA > 0 ? U.cleanNumber(panSizeA) : null,
      panSizeB: Number.isFinite(panSizeB) && panSizeB > 0 ? U.cleanNumber(panSizeB) : null,
      notes: String(raw.notes ?? '').trim(),
      source: raw.source === 'ocr' || raw.source === 'import' ? raw.source : 'manual',
      items,
      createdAt,
      updatedAt,
      date: updatedAt // legacy compatibility field
    };
  }

  function sanitizeHistory(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name ?? 'Perhitungan').trim() || 'Perhitungan';
    const type = String(raw.type || 'HPP').trim() || 'HPP';
    const date = raw.date || new Date().toISOString();
    const total = Number.isFinite(Number(raw.total)) ? Number(raw.total) : null;
    return {
      id: String(raw.id || U.generateId()),
      type,
      name,
      summary: String(raw.summary || (total !== null ? U.money(total) : '')).trim(),
      total,
      inputs: raw.inputs && typeof raw.inputs === 'object' ? raw.inputs : null,
      results: raw.results && typeof raw.results === 'object' ? raw.results : null,
      details: raw.details && typeof raw.details === 'object' ? raw.details : null,
      date
    };
  }

  function createEmptyState() {
    return {
      materials: [],
      recipes: [],
      history: [],
      meta: {
        schemaVersion: SCHEMA_VERSION,
        lastOpenedRecipeId: null
      }
    };
  }

  function normalizeStateObject(obj) {
    const empty = createEmptyState();
    if (!obj || typeof obj !== 'object') return empty;
    const materials = Array.isArray(obj.materials) ? obj.materials.map(sanitizeMaterial).filter(Boolean) : [];
    const recipes = Array.isArray(obj.recipes) ? obj.recipes.map(sanitizeRecipe).filter(Boolean) : [];
    const history = Array.isArray(obj.history) ? obj.history.map(sanitizeHistory).filter(Boolean).slice(-MAX_HISTORY) : [];

    // Ensure unique IDs
    const dedupeIds = (arr) => {
      const seen = new Set();
      return arr.map((item) => {
        if (seen.has(item.id)) item = { ...item, id: U.generateId() };
        seen.add(item.id);
        return item;
      });
    };

    const dedupedRecipes = dedupeIds(recipes);
    const lastId = obj.meta && typeof obj.meta.lastOpenedRecipeId === 'string' && dedupedRecipes.some((r) => r.id === obj.meta.lastOpenedRecipeId)
      ? obj.meta.lastOpenedRecipeId
      : null;

    return {
      materials: dedupeIds(materials),
      recipes: dedupedRecipes,
      history: dedupeIds(history),
      meta: {
        schemaVersion: SCHEMA_VERSION,
        lastOpenedRecipeId: lastId
      }
    };
  }

  function loadState() {
    loadWarning = null;
    try {
      const v2Raw = localStorage.getItem(DBKEY);
      const v1Raw = !v2Raw ? localStorage.getItem(LEGACY_DBKEY) : null;
      const raw = v2Raw || v1Raw;

      if (!raw) {
        state = createEmptyState();
        return state;
      }

      const parsed = JSON.parse(raw);
      state = normalizeStateObject(parsed);

      // Auto-persist legacy v1 -> v2 migration immediately without deleting v1 until safely written
      if (!v2Raw && v1Raw) {
        try {
          localStorage.setItem(DBKEY, JSON.stringify(state));
        } catch (_) {}
      }
      return state;
    } catch (err) {
      // Preserve raw corrupt string for possible manual recovery
      try {
        const raw = localStorage.getItem(DBKEY) || localStorage.getItem(LEGACY_DBKEY);
        if (raw) localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      } catch (_) {}
      loadWarning = 'Data lokal sebelumnya rusak dan telah diamankan. Aplikasi dimulai dengan data kosong; gunakan Restore Backup jika tersedia.';
      state = createEmptyState();
      return state;
    }
  }

  function getState() {
    if (!state) loadState();
    return state;
  }

  function getLoadWarning() {
    return loadWarning;
  }

  function subscribe(fn) {
    if (typeof fn === 'function' && !listeners.includes(fn)) {
      listeners.push(fn);
    }
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    });
  }

  function persist() {
    try {
      if (state.history.length > MAX_HISTORY) {
        state.history = state.history.slice(-MAX_HISTORY);
      }
      localStorage.setItem(DBKEY, JSON.stringify(state));
      notify();
      return true;
    } catch (err) {
      U.toast('Penyimpanan browser penuh atau diblokir. Unduh backup JSON, lalu kosongkan ruang penyimpanan.', 'error', 6000);
      return false;
    }
  }

  /**
   * Calculate price per 1 usage unit (m.unit) accurately.
   */
  function getMaterialUnitPrice(material) {
    if (!material || !Number.isFinite(material.price) || !Number.isFinite(material.qty) || material.qty <= 0) {
      return 0;
    }
    const purchaseUnit = material.purchaseUnit || material.unit || 'gram';
    const usageUnit = material.unit || 'gram';
    const sameDim = U.convertSameDimension(material.qty, purchaseUnit, usageUnit);
    let totalUsageQty;
    if (sameDim !== null && sameDim > 0) {
      totalUsageQty = sameDim;
    } else {
      const factor = Number(material.conversionFactor) > 0 ? Number(material.conversionFactor) : 1;
      totalUsageQty = material.qty * factor;
    }
    return totalUsageQty > 0 ? material.price / totalUsageQty : 0;
  }

  function getMaterialEffectiveUsageQty(material) {
    const purchaseUnit = material.purchaseUnit || material.unit || 'gram';
    const usageUnit = material.unit || 'gram';
    const sameDim = U.convertSameDimension(material.qty, purchaseUnit, usageUnit);
    if (sameDim !== null && sameDim > 0) return U.cleanNumber(sameDim);
    const factor = Number(material.conversionFactor) > 0 ? Number(material.conversionFactor) : 1;
    return U.cleanNumber(material.qty * factor);
  }

  function setLastOpenedRecipe(recipeId) {
    const s = getState();
    if (!recipeId || !s.recipes.some((r) => r.id === recipeId)) return;
    if (s.meta.lastOpenedRecipeId === recipeId) return;
    s.meta.lastOpenedRecipeId = recipeId;
    persist();
  }

  function addHistoryEntry(entry) {
    const s = getState();
    const clean = sanitizeHistory({
      id: U.generateId(),
      date: new Date().toISOString(),
      ...entry
    });
    if (!clean) return false;
    s.history.push(clean);
    if (s.history.length > MAX_HISTORY) {
      s.history = s.history.slice(-MAX_HISTORY);
    }
    return persist();
  }

  function exportBackupData() {
    const s = getState();
    return {
      app: 'Baking Calculator Pro',
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      materials: s.materials,
      recipes: s.recipes,
      history: s.history,
      meta: s.meta
    };
  }

  function downloadBackup() {
    const payload = exportBackupData();
    const stamp = new Date().toISOString().slice(0, 10);
    U.downloadFile(`baking-calculator-backup-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    U.toast('Backup JSON berhasil diunduh.', 'success');
  }

  function validateBackupText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return { valid: false, error: 'File bukan JSON yang valid atau rusak.' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Struktur file backup tidak dikenali.' };
    }
    if (!Array.isArray(parsed.materials) || !Array.isArray(parsed.recipes) || !Array.isArray(parsed.history)) {
      return { valid: false, error: 'File backup tidak memiliki data bahan, resep, dan riwayat yang lengkap.' };
    }
    const normalized = normalizeStateObject(parsed);
    const droppedMaterials = parsed.materials.length - normalized.materials.length;
    const droppedRecipes = parsed.recipes.length - normalized.recipes.length;
    const droppedHistory = parsed.history.length - normalized.history.length;
    const warnings = [];
    if (droppedMaterials > 0) warnings.push(`${droppedMaterials} data bahan tidak valid dilewati.`);
    if (droppedRecipes > 0) warnings.push(`${droppedRecipes} data resep tidak valid dilewati.`);
    if (droppedHistory > 0) warnings.push(`${droppedHistory} data riwayat tidak valid dilewati.`);

    return {
      valid: true,
      data: normalized,
      counts: {
        materials: normalized.materials.length,
        recipes: normalized.recipes.length,
        history: normalized.history.length
      },
      warnings
    };
  }

  function applyBackup(normalizedData, mode = 'replace') {
    const s = getState();
    if (mode === 'merge') {
      // Merge materials by ID or case-insensitive name
      const matById = new Map(s.materials.map((m) => [m.id, m]));
      const matByName = new Map(s.materials.map((m) => [m.name.toLowerCase(), m]));
      let addedMat = 0;
      normalizedData.materials.forEach((m) => {
        if (!matById.has(m.id) && !matByName.has(m.name.toLowerCase())) {
          s.materials.push(m);
          matById.set(m.id, m);
          matByName.set(m.name.toLowerCase(), m);
          addedMat++;
        }
      });

      // Merge recipes by ID (if same ID exists, skip; if different ID, add)
      const recById = new Set(s.recipes.map((r) => r.id));
      let addedRec = 0;
      normalizedData.recipes.forEach((r) => {
        if (!recById.has(r.id)) {
          s.recipes.push(r);
          recById.add(r.id);
          addedRec++;
        }
      });

      // Merge history by ID
      const histById = new Set(s.history.map((h) => h.id));
      let addedHist = 0;
      normalizedData.history.forEach((h) => {
        if (!histById.has(h.id)) {
          s.history.push(h);
          histById.add(h.id);
          addedHist++;
        }
      });

      persist();
      return { addedMat, addedRec, addedHist };
    }

    // Replace mode
    state = normalizeStateObject(normalizedData);
    persist();
    return {
      addedMat: state.materials.length,
      addedRec: state.recipes.length,
      addedHist: state.history.length
    };
  }

  function clearAllData() {
    state = createEmptyState();
    return persist();
  }

  // Initialize immediately on load
  loadState();

  window.BCP.storage = {
    DBKEY,
    LEGACY_DBKEY,
    APP_VERSION,
    SCHEMA_VERSION,
    getState,
    getLoadWarning,
    subscribe,
    persist,
    sanitizeMaterial,
    sanitizeRecipe,
    sanitizeRecipeItem,
    getMaterialUnitPrice,
    getMaterialEffectiveUsageQty,
    setLastOpenedRecipe,
    addHistoryEntry,
    exportBackupData,
    downloadBackup,
    validateBackupText,
    applyBackup,
    clearAllData
  };
})();
