/**
 * Baking Calculator Pro — Visual Helpers & Asset Mapping (window.BCP.visuals)
 * Pure read-only presentation helpers: category/keyword recipe photography,
 * ingredient icons, pan comparison SVG, scaling visual, and image fallbacks.
 * NEVER modifies stored recipe or material data.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;

  const IMAGES = {
    hero: './assets/images/hero-baking.jpg',
    cheesecake: './assets/images/cheesecake.jpg',
    chocolateCake: './assets/images/chocolate-cake.jpg',
    cookies: './assets/images/cookies.jpg',
    bread: './assets/images/bread.jpg',
    croissant: './assets/images/croissant.jpg',
    dessertPudding: './assets/images/dessert-pudding.jpg',
    kueTradisional: './assets/images/kue-tradisional.jpg',
    bakingIngredients: './assets/images/baking-ingredients.jpg',
    bakingTools: './assets/images/baking-tools.jpg',
    recipeImport: './assets/images/recipe-import.jpg',
    panConversion: './assets/images/pan-conversion.jpg'
  };

  // Lightweight inline SVG fallback if any local image ever fails to load
  const FALLBACK_DATA_URI =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f3e6d6"/><stop offset="100%" stop-color="#e3cbb1"/></linearGradient></defs>' +
      '<rect width="640" height="420" fill="url(#g)"/>' +
      '<circle cx="320" cy="190" r="64" fill="#5c3d2e" fill-opacity="0.14"/>' +
      '<path d="M276 204c-11 0-20-9-20-20 0-10 7-18 17-20 4-14 17-24 32-24 8 0 15 3 21 7 6-3 13-5 20-5 16 0 29 11 33 26 8 3 14 10 14 19 0 11-9 20-20 20h-97z" fill="#5c3d2e" fill-opacity="0.45"/>' +
      '<rect x="276" y="214" width="88" height="16" rx="8" fill="#c88a55" fill-opacity="0.7"/>' +
      '</svg>'
    );

  function getRecipeImage(recipe) {
    const name = String(recipe?.name || '').toLowerCase();
    const cat = String(recipe?.category || '').toLowerCase();

    // 1. Smart keyword match from recipe name (specific product types checked BEFORE flavor keywords like "choco")
    if (/(cheese|keju|basque|burn|burnt)/.test(name) && !/(sagu\s*keju|kastengel|cookies|kukis|roti)/.test(name)) return IMAGES.cheesecake;
    if (/(cookie|kukis|nastar|kastengel|putri\s*salju|sagu\s*keju|kue\s*kering|biskuit|biscuit|macaron)/.test(name)) return IMAGES.cookies;
    if (/(croissant|pastry|danish|pie|tart|puff|strudel|choux|sus|eclair|cromboloni)/.test(name)) return IMAGES.croissant;
    if (/(roti|bread|donat|donut|brioche|sourdough|bagel|bun|pizza|bakpao|kentang)/.test(name)) return IMAGES.bread;
    if (/(puding|pudding|mousse|panna|custard|flan|dessert|vla|creme|brulee)/.test(name)) return IMAGES.dessertPudding;
    if (/(cokelat|coklat|choco|brownie|fudge|black\s*forest|tiramisu|mocha|ganache)/.test(name)) return IMAGES.chocolateCake;
    if (/(pandan|bolu|chiffon|lapis|sponge|marmer|butter\s*cake|klepon|onde|kue)/.test(name)) return IMAGES.kueTradisional;

    // 2. Category-specific fallback (different image per category!)
    if (cat.includes('roti') || cat.includes('donat')) return IMAGES.bread;
    if (cat.includes('cookies') || cat.includes('kering')) return IMAGES.cookies;
    if (cat.includes('pastry') || cat.includes('pie')) return IMAGES.croissant;
    if (cat.includes('dessert') || cat.includes('puding')) return IMAGES.dessertPudding;
    if (cat.includes('tradisional')) return IMAGES.kueTradisional;
    if (cat.includes('bolu') || cat.includes('cake')) return IMAGES.chocolateCake;
    if (cat.includes('krim') || cat.includes('isian')) return IMAGES.cheesecake;
    return IMAGES.bakingIngredients;
  }

  function getMaterialVisual(categoryOrName) {
    const text = String(categoryOrName || '').toLowerCase();
    if (/(tepung|pati|terigu|maizena|tapioka|almond|oat)/.test(text)) {
      return {
        tone: 'tone-flour',
        label: 'Tepung',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 10h14l-1.5 9a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7L5 10z"/><path d="M8 10c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5"/><path d="M9.5 14.5h5"/></svg>'
      };
    }
    if (/(telur|egg|kuning|putih)/.test(text)) {
      return {
        tone: 'tone-egg',
        label: 'Telur',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3c-3.8 0-7 6-7 11a7 7 0 0 0 14 0c0-5-3.2-11-7-11z"/><circle cx="12" cy="14" r="2.2"/></svg>'
      };
    }
    if (/(gula|pemanis|madu|sirup|karamel|palm)/.test(text)) {
      return {
        tone: 'tone-sugar',
        label: 'Gula',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="10" width="7" height="7" rx="1.5"/><rect x="12" y="12" width="7" height="7" rx="1.5"/><rect x="8.5" y="4" width="6.5" height="6.5" rx="1.5"/></svg>'
      };
    }
    if (/(lemak|dairy|mentega|butter|margarin|keju|cheese|cream|krim)/.test(text)) {
      return {
        tone: 'tone-butter',
        label: 'Dairy',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 13.5 13.5 7 20 10.5 10.5 17 4 13.5z"/><path d="M4 13.5V17l6.5 3.5L20 14v-3.5"/></svg>'
      };
    }
    if (/(cair|susu|air|santan|minyak|kopi|espresso)/.test(text)) {
      return {
        tone: 'tone-liquid',
        label: 'Cairan',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3.5C9 8 6.5 11 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 11 15 8 12 3.5z"/></svg>'
      };
    }
    if (/(cokelat|coklat|choco|cocoa|topping|meses|kacang|keju)/.test(text)) {
      return {
        tone: 'tone-choco',
        label: 'Cokelat',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M12 4v16M5 10h14M5 15h14"/></svg>'
      };
    }
    if (/(pengembang|perisa|ragi|baking|vanili|garam|pandan|esens|sp|ovalet)/.test(text)) {
      return {
        tone: 'tone-spice',
        label: 'Perisa',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M9 3h6l1 4H8l1-4z"/><rect x="7" y="7" width="10" height="13" rx="2"/><path d="M10 12h4M10 15.5h4"/></svg>'
      };
    }
    if (/(kemasan|box|dus|plastik|kertas|loyang|packaging|stiker)/.test(text)) {
      return {
        tone: 'tone-pack',
        label: 'Kemasan',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 8.5 12 4 3 8.5 12 13l9-4.5z"/><path d="M3 8.5V16l9 4.5 9-4.5V8.5"/></svg>'
      };
    }
    return {
      tone: 'tone-default',
      label: 'Bahan',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><path d="M9 12h6M12 9v6"/></svg>'
    };
  }

  function getHistoryVisual(type) {
    if (type === 'HPP') {
      return {
        tone: 'hist-tone-hpp',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7.5h8M8 12h3m4 0h1M8 16h3m4 0h1"/></svg>'
      };
    }
    if (type === 'Scaling') {
      return {
        tone: 'hist-tone-scale',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M7 16V9m5 7V4m5 12v-5"/></svg>'
      };
    }
    if (type === 'Konversi Loyang') {
      return {
        tone: 'hist-tone-pan',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>'
      };
    }
    return {
      tone: 'hist-tone-unit',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0-3 3m3-3 3 3M17 8v12m0 0-3-3m3 3 3-3"/></svg>'
    };
  }

  /**
   * Proportional live SVG visualization comparing Original Pan vs Target Pan
   * (purely visual — does not alter any calculation formula).
   */
  function renderPanComparisonSvg({ fromShape, fromA, fromB, toShape, toA, toB, fromLabel, toLabel, factor }) {
    const fW = fromShape === 'round' ? fromA : fromA;
    const fH = fromShape === 'round' ? fromA : (fromB || fromA);
    const tW = toShape === 'round' ? toA : toA;
    const tH = toShape === 'round' ? toA : (toB || toA);
    const maxDim = Math.max(fW, fH, tW, tH, 1);
    const boxSize = 96;
    const scale = (boxSize - 16) / maxDim;

    const drawShape = (shape, w, h, fill, stroke) => {
      const pw = Math.max(20, Math.round(w * scale));
      const ph = Math.max(20, Math.round(h * scale));
      const x = Math.round((boxSize - pw) / 2);
      const y = Math.round((boxSize - ph) / 2);
      if (shape === 'round') {
        const r = Math.round(pw / 2);
        return `<circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>` +
          `<circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="${Math.max(6, r - 6)}" fill="none" stroke="${stroke}" stroke-opacity="0.35" stroke-dasharray="3 3" stroke-width="1.2"/>`;
      }
      return `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>` +
        `<rect x="${x + 5}" y="${y + 5}" width="${Math.max(8, pw - 10)}" height="${Math.max(8, ph - 10)}" rx="4" fill="none" stroke="${stroke}" stroke-opacity="0.35" stroke-dasharray="3 3" stroke-width="1.2"/>`;
    };

    const pctDiff = Math.round((factor - 1) * 100);
    const diffBadge = pctDiff === 0
      ? 'Ukuran sama'
      : (pctDiff > 0 ? `+${pctDiff}% lebih besar` : `${pctDiff}% lebih kecil`);

    return `
      <div class="visual-compare-strip">
        <div class="vc-side">
          <span class="vc-tag">Loyang Awal</span>
          <svg class="vc-svg" viewBox="0 0 ${boxSize} ${boxSize}" width="${boxSize}" height="${boxSize}" aria-hidden="true">
            ${drawShape(fromShape, fW, fH, '#f5e8d8', '#8c6244')}
          </svg>
          <strong>${U.esc(fromLabel)}</strong>
        </div>
        <div class="vc-middle">
          <div class="vc-factor-pill">${U.fmt(factor, 2)}×</div>
          <div class="vc-arrow" aria-hidden="true">→</div>
          <span class="vc-diff">${U.esc(diffBadge)}</span>
        </div>
        <div class="vc-side">
          <span class="vc-tag vc-tag-target">Loyang Tujuan</span>
          <svg class="vc-svg" viewBox="0 0 ${boxSize} ${boxSize}" width="${boxSize}" height="${boxSize}" aria-hidden="true">
            ${drawShape(toShape, tW, tH, '#f7dfb8', '#5c3d2e')}
          </svg>
          <strong>${U.esc(toLabel)}</strong>
        </div>
      </div>
    `;
  }

  /**
   * Visual batch size comparison strip for Recipe Scaling.
   */
  function renderScalingVisual({ baseYield, targetYield, yieldUnit, factor }) {
    const maxY = Math.max(baseYield, targetYield, 0.001);
    const basePct = Math.max(12, Math.round((baseYield / maxY) * 100));
    const targetPct = Math.max(12, Math.round((targetYield / maxY) * 100));
    const direction = factor > 1 ? 'Diperbesar' : (factor < 1 ? 'Diperkecil' : 'Tetap');

    return `
      <div class="scale-visual-strip">
        <div class="sv-row">
          <div class="sv-meta">
            <span>Resep Awal</span>
            <strong>${U.fmt(baseYield)} ${U.esc(yieldUnit)}</strong>
          </div>
          <div class="sv-track"><div class="sv-bar sv-bar-base" style="width:${basePct}%"></div></div>
        </div>
        <div class="sv-row">
          <div class="sv-meta">
            <span>Target Produksi <span class="chip chip-accent" style="margin-left:6px">${U.esc(direction)} ${U.fmt(factor, 2)}×</span></span>
            <strong>${U.fmt(targetYield)} ${U.esc(yieldUnit)}</strong>
          </div>
          <div class="sv-track"><div class="sv-bar sv-bar-target" style="width:${targetPct}%"></div></div>
        </div>
      </div>
    `;
  }

  function imgTag({ src, alt = '', className = '', width = 400, height = 260, lazy = true }) {
    const loadAttr = lazy ? 'loading="lazy" decoding="async"' : 'decoding="async"';
    return `<img src="${U.esc(src)}" alt="${U.esc(alt)}" class="${U.esc(className)}" width="${width}" height="${height}" ${loadAttr} onerror="this.onerror=null;this.src='${FALLBACK_DATA_URI}'">`;
  }

  window.BCP.visuals = {
    IMAGES,
    FALLBACK_DATA_URI,
    getRecipeImage,
    getMaterialVisual,
    getHistoryVisual,
    renderPanComparisonSvg,
    renderScalingVisual,
    imgTag
  };
})();
