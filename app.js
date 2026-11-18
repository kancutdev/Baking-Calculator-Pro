/**
 * Baking Calculator Pro — Main Application Coordinator (window.BCP.app)
 * Mengelola navigasi hybrid (sidebar desktop + bottom nav mobile), dashboard,
 * backup/restore, About & media sosial Bang Doned, serta PWA Service Worker.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let currentPage = 'dashboard';
  let deferredInstallPrompt = null;
  let pendingBackupData = null;

  const SOCIAL_ICONS = {
    tiktok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-3.8.5-5.8s-.1-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M21.9 3.6c-.3-.3-.8-.4-1.3-.2L2.4 10.6c-.6.2-.9.8-.8 1.4.1.5.5.9 1.1 1l4.7 1.3 1.8 5.5c.2.5.6.8 1.1.8h.2c.5 0 .9-.3 1.1-.7l2.5-3.4 4.7 3.5c.3.2.6.3.9.3.2 0 .4 0 .6-.1.5-.2.8-.6.9-1.1l2.9-14.2c.1-.5-.1-1-.2-1.3zM9.2 13.7l9.2-6.1-7.4 7.7-.4 3-1.4-4.6z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .5-.1.7.5.2.6.8 2 .9 2.1.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.3.4-.5.5-.2.2-.3.4-.1.7.2.4.9 1.5 2 2.5 1.4 1.2 2.5 1.6 2.9 1.8.4.2.6.1.8-.1.2-.2.9-1.1 1.1-1.4.2-.4.5-.3.8-.2.4.1 2.2 1 2.6 1.2.4.2.6.3.7.5.1.2.1 1-.1 1.6z"/></svg>'
  };

  function init() {
    // Initialize all feature modules
    window.BCP.materials?.init();
    window.BCP.recipes?.init();
    window.BCP.importer?.init();
    window.BCP.scaling?.init();
    window.BCP.pan?.init();
    window.BCP.hpp?.init();
    window.BCP.units?.init();
    window.BCP.history?.init();

    bindNavigation();
    bindSettingsAndBackup();
    renderSocialSections();
    renderDashboard();

    S.subscribe(renderDashboard);

    const warn = S.getLoadWarning();
    if (warn) U.toast(warn, 'warning', 7000);

    setupPwa();
    showPage('dashboard', false);
  }

  function bindNavigation() {
    // All buttons with [data-nav-page] (desktop sidebar, mobile bottom nav, mobile drawer, dashboard quick actions)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-nav-page]');
      if (!target) return;
      const page = target.getAttribute('data-nav-page');
      if (page) {
        closeMobileDrawer();
        showPage(page);
      }
    });

    // Quick add recipe shortcut from dashboard
    U.$('btnDashAddRecipe')?.addEventListener('click', () => {
      window.BCP.recipes?.openFormForNew();
    });

    // Mobile "Menu" drawer button
    U.$('btnMobileMenuDrawer')?.addEventListener('click', openMobileDrawer);
    U.$('btnCloseMobileDrawer')?.addEventListener('click', closeMobileDrawer);
    U.$('mobileDrawerBackdrop')?.addEventListener('click', (e) => {
      if (e.target === U.$('mobileDrawerBackdrop')) closeMobileDrawer();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileDrawer();
    });
  }

  function openMobileDrawer() {
    const drawer = U.$('mobileDrawerBackdrop');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeMobileDrawer() {
    const drawer = U.$('mobileDrawerBackdrop');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function showPage(pageId, scrollTop = true) {
    const targetSection = U.$(`page-${pageId}`);
    if (!targetSection) return;
    currentPage = pageId;

    document.querySelectorAll('.app-page').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `page-${pageId}`);
    });

    // Update desktop sidebar & drawer active state
    document.querySelectorAll('.sidebar-nav [data-nav-page], .mobile-drawer [data-nav-page]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-nav-page') === pageId);
    });

    // Update mobile bottom nav active state
    const primaryMobilePages = ['dashboard', 'book', 'hpp', 'import'];
    document.querySelectorAll('.bottom-nav [data-nav-page]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-nav-page') === pageId);
    });
    const moreBtn = U.$('btnMobileMenuDrawer');
    if (moreBtn) {
      moreBtn.classList.toggle('active', !primaryMobilePages.includes(pageId));
    }

    if (scrollTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function renderDashboard() {
    const s = S.getState();

    if (U.$('dashStatRecipes')) U.$('dashStatRecipes').textContent = s.recipes.length;
    if (U.$('dashStatMaterials')) U.$('dashStatMaterials').textContent = s.materials.length;
    if (U.$('dashStatHistory')) U.$('dashStatHistory').textContent = s.history.length;

    // Last opened / used recipe card
    const lastWrap = U.$('dashLastRecipe');
    if (lastWrap) {
      const lastId = s.meta?.lastOpenedRecipeId;
      const lastRecipe = (lastId && s.recipes.find((r) => r.id === lastId)) || s.recipes[s.recipes.length - 1] || null;
      if (!lastRecipe) {
        lastWrap.innerHTML = `<div class="empty-state compact">
          <p class="empty-title">Belum ada resep tersimpan</p>
          <p class="empty-sub">Tambahkan resep manual atau import resep untuk mulai menghitung scaling, loyang, dan HPP.</p>
          <button type="button" class="btn btn-primary btn-sm" id="dashCreateFirstBtn">+ Tambah Resep Pertama</button>
        </div>`;
        U.$('dashCreateFirstBtn')?.addEventListener('click', () => window.BCP.recipes?.openFormForNew());
      } else {
        const pan = window.BCP.recipes?.formatPanSummary(lastRecipe);
        lastWrap.innerHTML = `
          <div class="last-recipe-card">
            <div class="lrc-head">
              <div>
                <span class="chip chip-accent">${U.esc(lastRecipe.category)}</span>
                ${pan ? `<span class="chip chip-soft">${U.esc(pan)}</span>` : ''}
              </div>
              <span class="muted small-note">Diperbarui ${U.formatDate(lastRecipe.updatedAt)}</span>
            </div>
            <h4 class="lrc-title">${U.esc(lastRecipe.name)}</h4>
            <p class="lrc-meta">${U.fmt(lastRecipe.baseYield)} ${U.esc(lastRecipe.yieldUnit)} · ${lastRecipe.items.length} bahan</p>
            <div class="lrc-actions">
              <button type="button" class="btn btn-sm btn-primary" id="dashLastEdit">Edit Resep</button>
              <button type="button" class="btn btn-sm btn-soft" id="dashLastScale">Scaling</button>
              <button type="button" class="btn btn-sm btn-soft" id="dashLastPan">Loyang</button>
              <button type="button" class="btn btn-sm btn-soft" id="dashLastHpp">Hitung HPP</button>
            </div>
          </div>
        `;
        U.$('dashLastEdit')?.addEventListener('click', () => window.BCP.recipes?.openFormForEdit(lastRecipe.id));
        U.$('dashLastScale')?.addEventListener('click', () => {
          window.BCP.scaling?.loadRecipe(lastRecipe.id);
          showPage('scaling');
        });
        U.$('dashLastPan')?.addEventListener('click', () => {
          window.BCP.pan?.loadRecipe(lastRecipe.id);
          showPage('pan');
        });
        U.$('dashLastHpp')?.addEventListener('click', () => {
          window.BCP.hpp?.loadRecipe(lastRecipe.id);
          showPage('hpp');
        });
      }
    }

    // Recent calculations list
    const recentWrap = U.$('dashRecentHistory');
    if (recentWrap) {
      const recent = s.history.slice(-5).reverse();
      if (!recent.length) {
        recentWrap.innerHTML = `<div class="empty-state compact">
          <p class="empty-title">Belum ada riwayat perhitungan</p>
          <p class="empty-sub">Simpan hasil HPP, Scaling, Konversi Loyang, atau Konversi Satuan untuk melihat catatan terbaru di sini.</p>
        </div>`;
      } else {
        recentWrap.innerHTML = recent.map((h) => `
          <div class="recent-item" data-dash-hist="${U.esc(h.id)}" role="button" tabindex="0">
            <div class="ri-left">
              <span class="chip chip-soft">${U.esc(h.type)}</span>
              <div>
                <strong class="ri-title">${U.esc(h.name)}</strong>
                <div class="ri-sub">${U.esc(h.summary)}</div>
              </div>
            </div>
            <span class="ri-date">${U.formatDate(h.date)}</span>
          </div>
        `).join('');
        recentWrap.querySelectorAll('[data-dash-hist]').forEach((el) => {
          el.addEventListener('click', () => window.BCP.history?.openDetail(el.getAttribute('data-dash-hist')));
        });
      }
    }
  }

  function bindSettingsAndBackup() {
    U.$('btnExportBackup')?.addEventListener('click', () => S.downloadBackup());

    const restoreInput = U.$('restoreBackupInput');
    if (restoreInput) {
      restoreInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const check = S.validateBackupText(String(reader.result || ''));
          const previewBox = U.$('restorePreviewBox');
          if (!check.valid) {
            pendingBackupData = null;
            if (previewBox) {
              previewBox.style.display = 'block';
              previewBox.innerHTML = `<div class="alert alert-danger"><strong>File backup tidak valid:</strong> ${U.esc(check.error)}</div>`;
            }
            U.toast(check.error, 'error', 5000);
            return;
          }

          pendingBackupData = check.data;
          if (previewBox) {
            previewBox.style.display = 'block';
            previewBox.innerHTML = `
              <div class="alert alert-info">
                <strong>File backup valid (${U.esc(file.name)})</strong>
                <p style="margin:6px 0">Isi backup: <b>${check.counts.recipes} resep</b>, <b>${check.counts.materials} bahan baku</b>, <b>${check.counts.history} riwayat</b>.</p>
                ${check.warnings.length ? `<p class="small-note" style="margin:4px 0">${check.warnings.map(U.esc).join(' ')}</p>` : ''}
                <div class="actions-row" style="margin-top:10px">
                  <button type="button" class="btn btn-primary btn-sm" id="btnRestoreMerge">Gabung dengan Data Saat Ini (Merge)</button>
                  <button type="button" class="btn btn-danger-outline btn-sm" id="btnRestoreReplace">Timpa Seluruh Data (Replace)</button>
                  <button type="button" class="btn btn-ghost btn-sm" id="btnRestoreCancel">Batal</button>
                </div>
              </div>
            `;

            U.$('btnRestoreMerge')?.addEventListener('click', () => {
              if (!pendingBackupData) return;
              const res = S.applyBackup(pendingBackupData, 'merge');
              pendingBackupData = null;
              previewBox.style.display = 'none';
              U.toast(`Backup digabung: +${res.addedRec} resep, +${res.addedMat} bahan, +${res.addedHist} riwayat baru.`, 'success', 5000);
            });

            U.$('btnRestoreReplace')?.addEventListener('click', async () => {
              if (!pendingBackupData) return;
              const ok = await U.confirmDialog({
                title: 'Timpa Seluruh Data Lokal?',
                message: 'Seluruh resep, bahan baku, dan riwayat saat ini akan diganti dengan isi file backup. Pastikan Anda sudah memiliki cadangan bila diperlukan.',
                confirmText: 'Ya, Timpa Semua',
                danger: true
              });
              if (!ok) return;
              S.applyBackup(pendingBackupData, 'replace');
              pendingBackupData = null;
              previewBox.style.display = 'none';
              U.toast('Seluruh data berhasil dipulihkan dari backup.', 'success');
            });

            U.$('btnRestoreCancel')?.addEventListener('click', () => {
              pendingBackupData = null;
              previewBox.style.display = 'none';
            });
          }
        };
        reader.onerror = () => {
          U.toast('Gagal membaca file backup.', 'error');
        };
        reader.readAsText(file);
        e.target.value = '';
      });
    }

    U.$('btnClearAllData')?.addEventListener('click', async () => {
      const ok = await U.confirmDialog({
        title: 'Hapus Seluruh Data Lokal?',
        message: 'Semua resep, database bahan baku, dan riwayat perhitungan pada browser ini akan dihapus permanen. Unduh backup JSON terlebih dahulu jika data masih dibutuhkan.',
        confirmText: 'Hapus Permanen',
        danger: true
      });
      if (!ok) return;
      S.clearAllData();
      U.toast('Seluruh data lokal telah dihapus.', 'info');
    });
  }

  /**
   * Render Bang Doned social media links strictly from window.SOCIAL_LINKS_CONFIG (social-links.js).
   * Hides any platform whose URL is empty or invalid — never renders fake links!
   */
  function renderSocialSections() {
    const cfg = window.SOCIAL_LINKS_CONFIG || { creatorName: 'Bang Doned', tagline: '', links: [] };
    const validLinks = (Array.isArray(cfg.links) ? cfg.links : []).filter((item) => U.isValidHttpUrl(item?.url));

    if (U.$('aboutCreatorName')) U.$('aboutCreatorName').textContent = cfg.creatorName || 'Bang Doned';
    if (U.$('aboutCreatorTagline')) U.$('aboutCreatorTagline').textContent = cfg.tagline || '';
    if (U.$('aboutAppVersion')) U.$('aboutAppVersion').textContent = `Versi ${S.APP_VERSION}`;

    const buildButtonsHtml = (compact = false) => {
      if (!validLinks.length) return '';
      return validLinks.map((item) => {
        const icon = SOCIAL_ICONS[String(item.id || '').toLowerCase()] || '';
        const text = compact
          ? U.esc(item.label)
          : `${U.esc(item.label)}${item.handle ? ` <span class="social-handle">${U.esc(item.handle)}</span>` : ''}`;
        return `<a class="social-pill ${compact ? 'social-pill-compact' : ''}" href="${U.esc(item.url.trim())}" target="_blank" rel="noopener noreferrer">
          ${icon}
          <span>${text}</span>
        </a>`;
      }).join('');
    };

    const aboutLinksEl = U.$('aboutSocialLinks');
    if (aboutLinksEl) {
      aboutLinksEl.innerHTML = buildButtonsHtml(false);
    }

    const footerSocialEl = U.$('footerSocialLinks');
    if (footerSocialEl) {
      footerSocialEl.innerHTML = buildButtonsHtml(true);
    }

    if (U.$('footerCreatorName')) {
      U.$('footerCreatorName').textContent = cfg.creatorName || 'Bang Doned';
    }
  }

  function setupPwa() {
    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = U.$('btnInstallPwa');
      if (btn) btn.style.display = 'inline-flex';
    });

    U.$('btnInstallPwa')?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (U.$('btnInstallPwa')) U.$('btnInstallPwa').style.display = 'none';
    });

    // Register modern service-worker.js and clean up legacy sw.js if present
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            if (reg.active && reg.active.scriptURL.endsWith('/sw.js')) {
              await reg.unregister();
            }
          }
          const reg = await navigator.serviceWorker.register('./service-worker.js');
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                U.toast('Versi baru aplikasi tersedia. Muat ulang halaman untuk memperbarui.', 'info', 6000);
              }
            });
          });
        } catch (_) {}
      });
    }
  }

  window.BCP.app = {
    init,
    showPage,
    getCurrentPage: () => currentPage
  };

  document.addEventListener('DOMContentLoaded', init);
})();
