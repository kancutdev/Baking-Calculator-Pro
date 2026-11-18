/**
 * Baking Calculator Pro — Core Utilities (window.BCP.utils)
 */
(function () {
  window.BCP = window.BCP || {};

  const STANDARD_UNITS = ['gram', 'kg', 'mg', 'ml', 'liter', 'sdt', 'sdm', 'cup', 'butir', 'pcs', 'secukupnya'];
  const PURCHASE_UNITS = ['gram', 'kg', 'mg', 'ml', 'liter', 'butir', 'pcs', 'pack', 'bungkus', 'botol', 'kaleng', 'dus'];
  const USAGE_UNITS = ['gram', 'kg', 'mg', 'ml', 'liter', 'sdt', 'sdm', 'cup', 'butir', 'pcs'];
  const YIELD_UNITS = ['pcs', 'slice', 'porsi', 'loyang', 'cup', 'kotak', 'toples', 'buah'];

  const RECIPE_CATEGORIES = [
    'Bolu & Cake',
    'Roti & Donat',
    'Cookies & Kue Kering',
    'Pastry & Pie',
    'Dessert & Puding',
    'Krim & Isian',
    'Kue Tradisional',
    'Lainnya'
  ];

  const MATERIAL_CATEGORIES = [
    'Tepung & Pati',
    'Gula & Pemanis',
    'Lemak & Dairy',
    'Telur',
    'Cairan',
    'Pengembang & Perisa',
    'Cokelat & Topping',
    'Kemasan',
    'Lainnya'
  ];

  const WEIGHT_TO_GRAM = { mg: 0.001, gram: 1, kg: 1000 };
  const VOLUME_TO_ML = { ml: 1, liter: 1000, sdt: 5, sdm: 15, cup: 240 };

  const UNIT_MAP = {
    g: 'gram', gr: 'gram', grm: 'gram', gram: 'gram', grams: 'gram',
    kg: 'kg', kilo: 'kg', kilogram: 'kg', kgs: 'kg',
    mg: 'mg', miligram: 'mg', milligram: 'mg',
    ml: 'ml', mililiter: 'ml', milliliter: 'ml', cc: 'ml',
    l: 'liter', lt: 'liter', ltr: 'liter', liter: 'liter', litre: 'liter',
    sdt: 'sdt', 'sendok teh': 'sdt', tsp: 'sdt', teaspoon: 'sdt',
    sdm: 'sdm', 'sendok makan': 'sdm', tbsp: 'sdm', tablespoon: 'sdm',
    cup: 'cup', cups: 'cup', cangkir: 'cup', gelas: 'cup',
    btr: 'butir', butir: 'butir',
    pcs: 'pcs', pc: 'pcs', buah: 'pcs', bh: 'pcs', biji: 'pcs', potong: 'pcs', ptg: 'pcs', slice: 'pcs',
    secukupnya: 'secukupnya', 'sejumput': 'secukupnya'
  };

  const UNICODE_FRACTIONS = {
    '¼': '1/4', '½': '1/2', '¾': '3/4',
    '⅓': '1/3', '⅔': '2/3',
    '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch (_) {}
    }
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function cleanNumber(n) {
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(6));
  }

  function fmt(n, maxDecimals = 4) {
    const val = Number(n);
    if (!Number.isFinite(val)) return '0';
    const rounded = Number(val.toFixed(maxDecimals));
    return rounded.toLocaleString('id-ID', { maximumFractionDigits: maxDecimals });
  }

  function money(n) {
    const val = Number(n);
    if (!Number.isFinite(val)) return 'Rp 0';
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  }

  function moneyPrecise(n) {
    const val = Number(n);
    if (!Number.isFinite(val)) return 'Rp 0';
    if (Math.abs(val) > 0 && Math.abs(val) < 100 && Math.abs(val - Math.round(val)) > 0.004) {
      return 'Rp ' + Number(val.toFixed(2)).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return money(val);
  }

  /**
   * Parse decimal, comma-decimal, fraction (1/2, 1 / 4), mixed fraction (1 1/2, 1½), or Unicode fraction.
   * Returns NaN for blank or invalid inputs — NEVER silently turns blank into 0.
   */
  function parseQtyValue(raw) {
    if (raw === null || raw === undefined) return NaN;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    let s = String(raw).trim();
    if (!s) return NaN;

    // Replace unicode fractions, inserting a space if preceded by a digit (e.g. "1½" -> "1 1/2")
    s = s.replace(/(\d)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/g, (_, d, f) => `${d} ${UNICODE_FRACTIONS[f]}`);
    s = s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (f) => UNICODE_FRACTIONS[f]);
    // Normalize spaces around slash: "1 / 4" -> "1/4"
    s = s.replace(/\s*\/\s*/g, '/');
    // Normalize Indonesian decimal comma when not a thousand separator
    if (/^\d+,\d+$/.test(s)) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '.');
    }

    // Mixed fraction: "1 1/2"
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
      const den = Number(mixed[3]);
      if (!den) return NaN;
      return cleanNumber(Number(mixed[1]) + Number(mixed[2]) / den);
    }

    // Simple fraction: "1/4"
    const frac = s.match(/^(\d+)\/(\d+)$/);
    if (frac) {
      const den = Number(frac[2]);
      if (!den) return NaN;
      return cleanNumber(Number(frac[1]) / den);
    }

    // Plain positive/zero number
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      return cleanNumber(Number(s));
    }
    return NaN;
  }

  function normUnit(raw) {
    const cleaned = String(raw ?? '').trim().replace(/\.+$/, '');
    if (!cleaned) return '';
    const lower = cleaned.toLowerCase();
    return UNIT_MAP[lower] || cleaned;
  }

  function getUnitDimension(unit) {
    const u = normUnit(unit).toLowerCase();
    if (u in WEIGHT_TO_GRAM) return 'weight';
    if (u in VOLUME_TO_ML) return 'volume';
    if (u === 'pcs' || u === 'butir') return 'count';
    return 'custom';
  }

  /**
   * Convert quantity between units of the SAME dimension (weight<->weight or volume<->volume).
   * Returns null if units are incompatible (e.g. gram <-> ml).
   */
  function convertSameDimension(qty, fromUnit, toUnit) {
    const q = Number(qty);
    if (!Number.isFinite(q)) return null;
    const from = normUnit(fromUnit).toLowerCase();
    const to = normUnit(toUnit).toLowerCase();
    if (!from || !to) return null;
    if (from === to) return cleanNumber(q);
    if (from in WEIGHT_TO_GRAM && to in WEIGHT_TO_GRAM) {
      return cleanNumber((q * WEIGHT_TO_GRAM[from]) / WEIGHT_TO_GRAM[to]);
    }
    if (from in VOLUME_TO_ML && to in VOLUME_TO_ML) {
      return cleanNumber((q * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to]);
    }
    return null;
  }

  function normalizeIngredientName(name) {
    return String(name ?? '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[,;:\-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function toast(message, type = 'info', duration = 3500) {
    const container = $('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="toast-dot"></span><span class="toast-msg">${esc(message)}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 260);
    }, duration);
  }

  function confirmDialog({ title = 'Konfirmasi', message = '', confirmText = 'Lanjutkan', cancelText = 'Batal', danger = false } = {}) {
    return new Promise((resolve) => {
      const modal = $('confirmModal');
      if (!modal) {
        resolve(window.confirm(message || title));
        return;
      }
      $('confirmModalTitle').textContent = title;
      $('confirmModalMessage').textContent = message;
      const okBtn = $('confirmModalOk');
      const cancelBtn = $('confirmModalCancel');
      okBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

      const cleanup = (result) => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        modal.onclick = null;
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') cleanup(false);
      };

      okBtn.onclick = () => cleanup(true);
      cancelBtn.onclick = () => cleanup(false);
      modal.onclick = (e) => {
        if (e.target === modal) cleanup(false);
      };
      document.addEventListener('keydown', onKey);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      okBtn.focus();
    });
  }

  function downloadFile(filename, content, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  const scriptPromises = new Map();
  function loadExternalScript(url, checkFn, timeoutMs = 20000) {
    if (checkFn && checkFn()) return Promise.resolve();
    if (scriptPromises.has(url)) return scriptPromises.get(url);

    const p = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        scriptPromises.delete(url);
        reject(new Error('Waktu muat library CDN habis. Periksa koneksi internet Anda lalu coba lagi.'));
      }, timeoutMs);

      script.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (checkFn && !checkFn()) {
          scriptPromises.delete(url);
          reject(new Error('Library berhasil diunduh tetapi gagal diinisialisasi.'));
          return;
        }
        resolve();
      };

      script.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        scriptPromises.delete(url);
        reject(new Error('Gagal memuat library dari CDN. Fitur import file/OCR membutuhkan koneksi internet atau gunakan tab Tempel Teks.'));
      };

      document.head.appendChild(script);
    });

    scriptPromises.set(url, p);
    return p;
  }

  function isValidHttpUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (_) {
      return false;
    }
  }

  window.BCP.utils = {
    STANDARD_UNITS,
    PURCHASE_UNITS,
    USAGE_UNITS,
    YIELD_UNITS,
    RECIPE_CATEGORIES,
    MATERIAL_CATEGORIES,
    WEIGHT_TO_GRAM,
    VOLUME_TO_ML,
    $,
    esc,
    generateId,
    cleanNumber,
    fmt,
    money,
    moneyPrecise,
    parseQtyValue,
    normUnit,
    getUnitDimension,
    convertSameDimension,
    normalizeIngredientName,
    formatDate,
    formatDateTime,
    toast,
    confirmDialog,
    downloadFile,
    loadExternalScript,
    isValidHttpUrl
  };
})();
