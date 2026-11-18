/**
 * Baking Calculator Pro — Smart Recipe Import & OCR (window.BCP.importer)
 * Mendukung Foto/Screenshot (OCR), PDF, DOCX, XLSX, CSV, dan Teks Tempel Langsung.
 * Hasil ekstraksi otomatis mengisi form terpadu Buku Resep.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;

  const CDN = {
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    tesseract: 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
  };

  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  let lastExtracted = null;

  const UNIT_TOKEN =
    'kilogram|kg|kilo|gram|grams|grm|gr|g|miligram|milligram|mg|mililiter|milliliter|ml|cc|liter|litre|ltr|lt|l|' +
    'sendok\\s+makan|sdm|tbsp|tablespoon|sendok\\s+teh|sdt|tsp|teaspoon|' +
    'cangkir|cups|cup|gelas|butir|btr|pcs|pc|buah|biji|potong|ptg|slice|' +
    'bungkus|bks|sachet|sct|pack|pak|siung|lembar|lbr|batang|btg|kaleng|botol|ikat';

  const QTY_TOKEN =
    '(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\s*\\/\\s*\\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+(?:[.,]\\d+)?)';

  function init() {
    const fileInput = U.$('importFileInput');
    const dropzone = U.$('importDropzone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
        e.target.value = '';
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach((ev) => {
        dropzone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach((ev) => {
        dropzone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', (e) => {
        const f = e.dataTransfer?.files?.[0];
        if (f) handleFile(f);
      });
    }

    U.$('btnParsePastedText')?.addEventListener('click', () => {
      const text = U.$('importPasteText')?.value || '';
      if (!text.trim()) {
        U.toast('Tempel teks resep terlebih dahulu sebelum mengekstrak.', 'warning');
        return;
      }
      processRawText(text, '', 'import');
    });

    U.$('btnLoadSampleRecipe')?.addEventListener('click', () => {
      const sample = [
        'Resep Roti Kentang Empuk',
        'Bahan:',
        '500 gr tepung terigu protein tinggi',
        '200 gr kentang kukus (haluskan)',
        '100 gr gula pasir',
        '11 gr ragi instan',
        '4 kuning telur',
        '100 ml susu cair dingin',
        '75 gr mentega',
        '1/4 sdt garam',
        '2 sdm susu bubuk'
      ].join('\n');
      if (U.$('importPasteText')) U.$('importPasteText').value = sample;
      U.toast('Contoh resep Roti Kentang dimasukkan. Klik "Ekstrak & Isi Form Resep".', 'info');
    });

    U.$('btnImportReprocess')?.addEventListener('click', () => {
      const text = U.$('importRawPreview')?.value || '';
      if (!text.trim()) return;
      processRawText(text, lastExtracted?.fallbackTitle || '', lastExtracted?.source || 'ocr');
    });

    U.$('btnOpenExtractedForm')?.addEventListener('click', () => {
      if (!lastExtracted) return;
      openUnifiedForm(lastExtracted);
    });
  }

  function setStatus(message, state = 'idle', progressPct = null) {
    const statusEl = U.$('importStatusBox');
    const barWrap = U.$('importProgressWrap');
    const barFill = U.$('importProgressFill');
    const dropzone = U.$('importDropzone');
    if (dropzone) {
      dropzone.classList.toggle('is-scanning', state === 'loading');
    }
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `import-status status-${state}`;
    }
    if (barWrap && barFill) {
      if (progressPct !== null && Number.isFinite(progressPct)) {
        barWrap.style.display = 'block';
        barFill.style.width = `${Math.max(5, Math.min(100, Math.round(progressPct)))}%`;
      } else {
        barWrap.style.display = 'none';
        barFill.style.width = '0%';
      }
    }
  }

  /**
   * Gentle adaptive preprocessing for printed photos & screenshots (including dark mode!).
   * Avoids destructive hard binary thresholding that blacks out warm/dim photos.
   */
  async function preprocessImageForOcr(file) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const maxWidth = 2400;
    const minWidth = 1000;
    let scale = 1;
    if (bitmap.width < minWidth) {
      scale = Math.min(2.5, minWidth / bitmap.width);
    } else if (bitmap.width > maxWidth) {
      scale = maxWidth / bitmap.width;
    }

    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;

    // Pass 1: compute luminance statistics
    let sum = 0;
    let minL = 255;
    let maxL = 0;
    const lum = new Uint8Array(d.length / 4);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      lum[p] = y;
      sum += y;
      if (y < minL) minL = y;
      if (y > maxL) maxL = y;
    }
    const mean = sum / lum.length;
    const isDarkBg = mean < 115; // dark mode screenshot detection
    const range = Math.max(25, maxL - minL);

    // Pass 2: gentle contrast stretch + invert if dark background
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      let v = lum[p];
      if (isDarkBg) v = 255 - v;
      // Soft linear stretch with light S-curve boost
      let norm = (v - (isDarkBg ? (255 - maxL) : minL)) / range;
      norm = Math.max(0, Math.min(1, norm));
      // Mild contrast enhancement around midpoint 0.55 without destroying grays
      const enhanced = norm < 0.55
        ? Math.pow(norm / 0.55, 1.25) * 0.55
        : 0.55 + (1 - Math.pow((1 - norm) / 0.45, 1.25)) * 0.45;
      const out = Math.round(Math.max(0, Math.min(255, enhanced * 255)));
      d[i] = d[i + 1] = d[i + 2] = out;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  async function ocrImage(file) {
    setStatus('Memuat library OCR (Tesseract.js)…', 'loading', 10);
    await U.loadExternalScript(CDN.tesseract, () => Boolean(window.Tesseract));

    setStatus('Menyiapkan & memperbaiki kontras gambar…', 'loading', 25);
    const canvas = await preprocessImageForOcr(file);

    const logger = (m) => {
      if (m.status === 'loading language traineddata') {
        setStatus('Mengunduh model bahasa OCR…', 'loading', 35 + (m.progress || 0) * 20);
      } else if (m.status === 'recognizing text') {
        setStatus(`Membaca teks gambar… ${Math.round((m.progress || 0) * 100)}%`, 'loading', 55 + (m.progress || 0) * 40);
      }
    };

    try {
      setStatus('Membaca teks gambar (Indonesia + Inggris)…', 'loading', 35);
      const res = await window.Tesseract.recognize(canvas, 'ind+eng', { logger });
      return res?.data?.text || '';
    } catch (_) {
      setStatus('Model bahasa Indonesia gagal dimuat, mencoba bahasa Inggris…', 'loading', 45);
      const res = await window.Tesseract.recognize(canvas, 'eng', { logger });
      return res?.data?.text || '';
    }
  }

  async function extractPdfText(file) {
    setStatus('Memuat library PDF…', 'loading', 20);
    await U.loadExternalScript(CDN.pdfjs, () => Boolean(window.pdfjsLib));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;

    setStatus('Membaca teks PDF per baris…', 'loading', 50);
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const allLines = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Group text items by Y position so each visual line stays separate!
      const lineMap = new Map();
      content.items.forEach((item) => {
        const str = String(item.str || '').trim();
        if (!str) return;
        const y = Math.round((item.transform?.[5] || 0) / 5) * 5;
        const x = item.transform?.[4] || 0;
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y).push({ x, str });
      });

      const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
      sortedYs.forEach((y) => {
        const parts = lineMap.get(y).sort((a, b) => a.x - b.x).map((i) => i.str);
        allLines.push(parts.join(' ').replace(/\s+/g, ' ').trim());
      });
    }

    const joined = allLines.join('\n').trim();
    if (!joined) {
      throw new Error('PDF tidak berisi teks tertanam (kemungkinan PDF hasil scan/gambar). Ambil screenshot atau konversi ke JPG/PNG lalu upload untuk OCR.');
    }
    return joined;
  }

  async function extractDocxText(file) {
    setStatus('Memuat library DOCX…', 'loading', 25);
    await U.loadExternalScript(CDN.mammoth, () => Boolean(window.mammoth));
    setStatus('Membaca dokumen Word…', 'loading', 60);
    const ab = await file.arrayBuffer();
    const res = await window.mammoth.extractRawText({ arrayBuffer: ab });
    return res?.value || '';
  }

  async function extractSpreadsheetText(file) {
    setStatus('Memuat library Excel…', 'loading', 25);
    await U.loadExternalScript(CDN.xlsx, () => Boolean(window.XLSX));
    setStatus('Membaca lembar kerja Excel…', 'loading', 60);
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map((name) => window.XLSX.utils.sheet_to_csv(wb.Sheets[name])).join('\n');
  }

  async function readUploadedFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'csv') {
      setStatus('Membaca file teks/CSV…', 'loading', 50);
      return await file.text();
    }
    if (ext === 'docx') return await extractDocxText(file);
    if (ext === 'xlsx' || ext === 'xls') return await extractSpreadsheetText(file);
    if (ext === 'pdf') return await extractPdfText(file);
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return await ocrImage(file);
    throw new Error(`Format ".${ext}" tidak didukung. Gunakan JPG, PNG, WEBP, PDF, DOCX, XLSX, CSV, atau TXT.`);
  }

  /**
   * Extract trailing parenthetical note from ingredient name, e.g.:
   * "kentang kukus (haluskan)" -> { name: "kentang kukus", note: "haluskan" }
   */
  function splitNameAndNote(rawName, extraNote = '') {
    let name = String(rawName ?? '')
      .replace(/^[\s:–—\-•*]+|[\s:–—\-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const notes = [];
    if (extraNote && extraNote.trim()) {
      notes.push(extraNote.replace(/^[\s,(]+|[\s,)]+$/g, '').trim());
    }
    const parenMatch = name.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) {
      notes.unshift(parenMatch[1].trim());
      name = name.slice(0, parenMatch.index).trim();
    }
    const commaMatch = name.match(/^([^,]+),\s*(.+)$/);
    if (commaMatch && commaMatch[2].length <= 40) {
      notes.push(commaMatch[2].trim());
      name = commaMatch[1].trim();
    }
    return {
      name: name.replace(/^[\s:–—\-]+|[\s:–—\-]+$/g, '').trim(),
      note: notes.filter(Boolean).join('; ')
    };
  }

  /**
   * Attempt to parse a single line into { name, qty, qtyRaw, unit, note } or null.
   */
  function parseSingleIngredientLine(rawLine) {
    let line = String(rawLine ?? '')
      .replace(/[•●▪◦◆◇►▸■□✓✔]/g, ' ')
      .replace(/^\s*[-*–—]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!line) return null;

    // Strip numbering ONLY when followed by whitespace (e.g. "1. 250 gr" or "2) gula"),
    // NEVER strip decimal numbers like "1.5 sdm"!
    line = line.replace(/^\d+[.)]\s+/, '').trim();

    // Common OCR typos for fractions: "l/4", "I/2" -> "1/4", "1/2"
    line = line.replace(/\b[lI]\s*\/\s*([2348])\b/g, '1/$1');

    // CSV format: "Tepung terigu,250,gram,ayak" or "250,gram,Tepung terigu"
    if (line.includes(',')) {
      const cols = line.split(',').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2 && cols.length <= 4) {
        const c0Qty = U.parseQtyValue(cols[0]);
        const c1Qty = U.parseQtyValue(cols[1]);
        if (Number.isFinite(c0Qty) && c0Qty > 0 && cols.length >= 3) {
          const u = U.normUnit(cols[1]);
          const sn = splitNameAndNote(cols[2], cols[3] || '');
          if (sn.name) return { name: sn.name, qty: c0Qty, qtyRaw: cols[0], unit: u || 'gram', note: sn.note };
        }
        if (Number.isFinite(c1Qty) && c1Qty > 0) {
          const u = cols[2] ? U.normUnit(cols[2]) : 'pcs';
          const sn = splitNameAndNote(cols[0], cols[3] || '');
          if (sn.name) return { name: sn.name, qty: c1Qty, qtyRaw: cols[1], unit: u || 'gram', note: sn.note };
        }
      }
    }

    // Pattern 1: Quantity + Unit + Ingredient (e.g. "250 gr tepung terigu", "1/4 sdt garam", "1.5 sdm gula (halus)")
    const reQtyFirst = new RegExp(`^(${QTY_TOKEN})\\s*(${UNIT_TOKEN})\\.?\\b\\s*[-:–—]?\\s*(.+)$`, 'i');
    let m = line.match(reQtyFirst);
    if (m) {
      const qtyRaw = m[1].trim();
      const qty = U.parseQtyValue(qtyRaw);
      const unit = U.normUnit(m[2]);
      const sn = splitNameAndNote(m[3]);
      if (sn.name && Number.isFinite(qty) && qty > 0) {
        return { name: sn.name, qty, qtyRaw, unit, note: sn.note };
      }
    }

    // Pattern 2: Ingredient + Quantity + Unit + Optional trailing note!
    // e.g. "Tepung terigu 250 gram", "Tepung terigu : 500 gr (ayak)", "Mentega 50 gr, lelehkan"
    const reQtyAfter = new RegExp(`^(.+?)\\s*[:\\-–—]?\\s+(${QTY_TOKEN})\\s*(${UNIT_TOKEN})\\.?\\b(.*)$`, 'i');
    m = line.match(reQtyAfter);
    if (m) {
      const qtyRaw = m[2].trim();
      const qty = U.parseQtyValue(qtyRaw);
      const unit = U.normUnit(m[3]);
      const sn = splitNameAndNote(m[1], m[4] || '');
      if (sn.name && Number.isFinite(qty) && qty > 0) {
        return { name: sn.name, qty, qtyRaw, unit, note: sn.note };
      }
    }

    // Pattern 3: Egg / count without explicit unit: "4 kuning telur", "2 putih telur", "3 telur ayam"
    m = line.match(new RegExp(`^(${QTY_TOKEN})\\s+(kuning\\s+telur|putih\\s+telur|telur\\s*\\w*|butir\\s+telur)(.*)$`, 'i'));
    if (m) {
      const qtyRaw = m[1].trim();
      const qty = U.parseQtyValue(qtyRaw);
      const sn = splitNameAndNote((m[2] + ' ' + (m[3] || '')).replace(/^butir\s+/i, ''));
      if (sn.name && Number.isFinite(qty) && qty > 0) {
        return { name: sn.name, qty, qtyRaw, unit: 'butir', note: sn.note };
      }
    }

    // Pattern 4: Egg count after name: "Kuning telur 4", "Telur : 3"
    m = line.match(new RegExp(`^(kuning\\s+telur|putih\\s+telur|telur[^0-9]*)\\s*[:\\-–—]?\\s*(${QTY_TOKEN})\\s*$`, 'i'));
    if (m) {
      const qtyRaw = m[2].trim();
      const qty = U.parseQtyValue(qtyRaw);
      const sn = splitNameAndNote(m[1]);
      if (sn.name && Number.isFinite(qty) && qty > 0) {
        return { name: sn.name, qty, qtyRaw, unit: 'butir', note: sn.note };
      }
    }

    // Pattern 5: "secukupnya" / "sejumput" (qty left blank intentionally — NEVER 0!)
    m = line.match(/^(.+?)\s*[:\-–—]?\s*(secukupnya|sejumput|sesuai\s+selera)\b(.*)$/i);
    if (m) {
      const sn = splitNameAndNote(m[1], m[3] || '');
      if (sn.name) {
        return { name: sn.name, qty: null, qtyRaw: '', unit: 'secukupnya', note: sn.note };
      }
    }

    // Pattern 6: Generic count + ingredient without unit (e.g. "2 pisang ambon", "1 jeruk nipis")
    m = line.match(new RegExp(`^(${QTY_TOKEN})\\s+([a-zA-Z\\u00C0-\\u024F].{2,})$`));
    if (m) {
      const qtyRaw = m[1].trim();
      const qty = U.parseQtyValue(qtyRaw);
      const sn = splitNameAndNote(m[2]);
      // Avoid mistaking numbered steps ("1 Campur semua bahan...") by rejecting long sentences
      if (sn.name && sn.name.split(/\s+/).length <= 5 && Number.isFinite(qty) && qty > 0) {
        return { name: sn.name, qty, qtyRaw, unit: 'pcs', note: sn.note };
      }
    }

    return null;
  }

  /**
   * Main recipe parser: detects title, separates ingredients vs instructions,
   * merges 2-column OCR lines, and preserves unrecognized lines for manual review.
   */
  function parseRecipeText(rawText, fallbackTitle = '') {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    let title = '';
    const ingredients = [];
    const unrecognized = [];
    const noteLines = [];
    const seen = new Set();
    let inStepsSection = false;
    let passedIngredientHeader = false;

    const isIngredientHeader = (l) =>
      /^(bahan(\s*[-–—]?\s*bahan|\s+[a-z0-9]+)?|ingredients?|komposisi|material)\s*:?\s*$/i.test(l);
    const isStepHeader = (l) =>
      /^(cara\s+membuat|cara\s+buat|langkah(\s*[-–—]?\s*langkah)?|metode|instruksi|instructions?|directions?|steps?|catatan\s+pembuatan)\s*:?\s*$/i.test(l);
    const isCsvHeader = (l) =>
      /^(nama\s*bahan|bahan|ingredient)\s*,\s*(jumlah|qty|takaran)/i.test(l);

    const qtyUnitOnlyRe = new RegExp(`^(${QTY_TOKEN})\\s*(${UNIT_TOKEN})\\.?$`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isCsvHeader(line)) continue;

      if (isStepHeader(line)) {
        inStepsSection = true;
        continue;
      }

      if (inStepsSection) {
        noteLines.push(line);
        continue;
      }

      if (isIngredientHeader(line)) {
        passedIngredientHeader = true;
        continue;
      }

      // Check 2-column OCR pattern: current line is text-only, next line is "250 gr"
      if (i + 1 < lines.length && qtyUnitOnlyRe.test(lines[i + 1]) && !parseSingleIngredientLine(line)) {
        const merged = `${line} ${lines[i + 1]}`;
        const parsedMerged = parseSingleIngredientLine(merged);
        if (parsedMerged) {
          const key = `${parsedMerged.name}|${parsedMerged.qtyRaw}|${parsedMerged.unit}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            ingredients.push(parsedMerged);
          }
          i++; // consume next line
          continue;
        }
      }

      const parsed = parseSingleIngredientLine(line);
      if (parsed) {
        const key = `${parsed.name}|${parsed.qtyRaw}|${parsed.unit}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          ingredients.push(parsed);
        }
        continue;
      }

      // Detect recipe title if before ingredients & before ingredient header
      if (!title && !passedIngredientHeader && ingredients.length === 0 && line.length <= 70) {
        title = line.replace(/^resep\s*:\s*/i, '').trim();
        continue;
      }

      // Never silently drop unrecognized ingredient lines — show them for manual review!
      unrecognized.push(line);
    }

    return {
      title: title || fallbackTitle || 'Resep Hasil Import',
      ingredients,
      unrecognized,
      notes: noteLines.length ? `Langkah / catatan dari dokumen:\n${noteLines.join('\n')}` : '',
      rawText: String(rawText || ''),
      fallbackTitle
    };
  }

  function openUnifiedForm(extracted) {
    if (!window.BCP.recipes) return;
    window.BCP.recipes.openFormWithImportedData({
      title: extracted.title,
      ingredients: extracted.ingredients,
      unrecognized: extracted.unrecognized,
      rawText: extracted.rawText,
      notes: extracted.notes,
      source: extracted.source || 'ocr'
    });
  }

  function processRawText(text, fallbackTitle = '', source = 'ocr') {
    const parsed = parseRecipeText(text, fallbackTitle);
    parsed.source = source;
    lastExtracted = parsed;

    // Show raw text preview box on Import page too
    const previewWrap = U.$('importResultSummaryWrap');
    if (previewWrap) previewWrap.style.display = 'block';
    if (U.$('importRawPreview')) U.$('importRawPreview').value = parsed.rawText;
    if (U.$('importSummaryText')) {
      const unrecInfo = parsed.unrecognized.length
        ? ` · ${parsed.unrecognized.length} baris perlu pemeriksaan manual`
        : '';
      U.$('importSummaryText').innerHTML =
        `<strong>${U.esc(parsed.title)}</strong> — Dikenali <strong>${parsed.ingredients.length} bahan</strong>${unrecInfo}.`;
    }

    if (parsed.ingredients.length > 0 || parsed.unrecognized.length > 0) {
      setStatus(
        `Ekstraksi selesai: ${parsed.ingredients.length} bahan dikenali${parsed.unrecognized.length ? `, ${parsed.unrecognized.length} baris perlu pemeriksaan` : ''}. Form resep otomatis diisi!`,
        'success',
        null
      );
      // Automatically populate and open the unified Recipe Book form!
      openUnifiedForm(parsed);
    } else {
      setStatus('Teks terbaca, tetapi belum ada bahan yang dikenali. Koreksi teks di bawah lalu klik Proses Ulang.', 'warning', null);
    }
  }

  async function handleFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      setStatus('Ukuran file terlalu besar. Maksimal 15 MB.', 'error');
      U.toast('Ukuran file maksimal 15 MB.', 'error');
      return;
    }

    const fallbackTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const ext = file.name.split('.').pop().toLowerCase();
    const source = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'ocr' : 'import';

    try {
      const text = await readUploadedFile(file);
      if (!text || !text.trim()) {
        setStatus('Tidak ada teks yang terbaca dari file tersebut. Pastikan gambar jelas dan teks tercetak rapi.', 'warning');
        return;
      }
      processRawText(text, fallbackTitle, source);
    } catch (err) {
      const msg = err?.message || 'Terjadi kesalahan saat membaca file.';
      setStatus(`Gagal memproses file: ${msg}`, 'error');
      U.toast(msg, 'error', 5000);
    }
  }

  window.BCP.importer = {
    init,
    parseRecipeText,
    parseSingleIngredientLine,
    handleFile,
    processRawText
  };
})();
