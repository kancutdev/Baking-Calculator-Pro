/**
 * Baking Calculator Pro — Calculation History (window.BCP.history)
 * Mencatat riwayat HPP, Recipe Scaling, Konversi Loyang, dan Konversi Satuan.
 */
(function () {
  window.BCP = window.BCP || {};
  const U = window.BCP.utils;
  const S = window.BCP.storage;

  let activeFilter = 'Semua';

  function init() {
    document.querySelectorAll('[data-history-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-history-filter');
        document.querySelectorAll('[data-history-filter]').forEach((b) => b.classList.toggle('active', b === btn));
        render();
      });
    });

    U.$('btnClearAllHistory')?.addEventListener('click', clearAll);
    U.$('btnCloseHistoryModal')?.addEventListener('click', closeDetailModal);
    U.$('historyDetailModal')?.addEventListener('click', (e) => {
      if (e.target === U.$('historyDetailModal')) closeDetailModal();
    });

    S.subscribe(render);
    render();
  }

  function getTypeBadgeClass(type) {
    if (type === 'HPP') return 'chip-accent';
    if (type === 'Scaling') return 'chip-info';
    if (type === 'Konversi Loyang') return 'chip-warning';
    return 'chip-soft';
  }

  function openDetail(id) {
    const entry = S.getState().history.find((h) => h.id === id);
    const modal = U.$('historyDetailModal');
    const body = U.$('historyDetailBody');
    const title = U.$('historyDetailTitle');
    if (!entry || !modal || !body) return;

    if (title) title.textContent = `${entry.type} — ${entry.name}`;

    let html = `<div class="hist-detail-meta">
      <span class="chip ${getTypeBadgeClass(entry.type)}">${U.esc(entry.type)}</span>
      <span class="muted">${U.formatDateTime(entry.date)}</span>
    </div>`;

    if (entry.type === 'HPP') {
      const r = entry.results || entry.details || {};
      const items = r.items || [];
      const totalHpp = r.totalHpp ?? r.total ?? entry.total ?? 0;
      const yieldQty = entry.inputs?.yieldQty ?? r.yield ?? 1;
      const yieldUnit = entry.inputs?.yieldUnit || 'potong';
      const sellBatch = r.sellBatch ?? r.suggestedPrice ?? 0;
      const hppPerUnit = r.hppPerUnit ?? (yieldQty ? totalHpp / yieldQty : totalHpp);
      const sellPerUnit = r.sellPerUnit ?? (yieldQty ? sellBatch / yieldQty : sellBatch);

      html += `<div class="kpi-grid kpi-grid-2" style="margin:14px 0">
        <div class="kpi-box"><span class="kpi-label">Total HPP</span><strong class="kpi-value">${U.money(totalHpp)}</strong></div>
        <div class="kpi-box kpi-box-accent"><span class="kpi-label">HPP / ${U.esc(yieldUnit)}</span><strong class="kpi-value">${U.money(hppPerUnit)}</strong></div>
        <div class="kpi-box kpi-box-success"><span class="kpi-label">Harga Jual / ${U.esc(yieldUnit)}</span><strong class="kpi-value">${U.money(sellPerUnit)}</strong></div>
        <div class="kpi-box"><span class="kpi-label">Hasil & Margin</span><strong class="kpi-value">${U.fmt(yieldQty)} ${U.esc(yieldUnit)} · ${U.fmt(entry.inputs?.margin ?? r.margin ?? 0, 1)}%</strong></div>
      </div>`;

      if (items.length) {
        html += `<h4 class="detail-subhead">Rincian Bahan</h4>
        <div class="detail-list">
          ${items.map((it) => `<div class="detail-list-row">
            <span><strong>${U.esc(it.name)}</strong> (${it.qty !== null && it.qty !== undefined ? U.fmt(it.qty) + ' ' : ''}${U.esc(it.unit || '')})</span>
            <strong>${it.cost !== null && it.cost !== undefined ? U.money(it.cost) : '—'}</strong>
          </div>`).join('')}
        </div>`;
      }
    } else if (entry.type === 'Scaling' || entry.type === 'Konversi Loyang') {
      const res = entry.results || {};
      const items = res.items || [];
      html += `<div class="alert alert-info" style="margin:12px 0">
        <strong>Ringkasan:</strong> ${U.esc(entry.summary)}
      </div>`;
      if (items.length) {
        html += `<h4 class="detail-subhead">Perbandingan Bahan</h4>
        <div class="detail-list">
          ${items.map((it) => `<div class="detail-list-row">
            <span><strong>${U.esc(it.name)}</strong></span>
            <span>${it.origQty !== null ? U.fmt(it.origQty) : ''} ${U.esc(it.unit)} → <strong>${it.newQty !== null ? U.fmt(it.newQty) : ''} ${U.esc(it.unit)}</strong></span>
          </div>`).join('')}
        </div>`;
      }
    } else {
      html += `<div class="alert alert-info" style="margin:12px 0">
        <strong>Hasil:</strong> ${U.esc(entry.summary)}
        ${entry.results?.note ? `<p class="small-note" style="margin:6px 0 0">${U.esc(entry.results.note)}</p>` : ''}
      </div>`;
    }

    body.innerHTML = html;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeDetailModal() {
    const modal = U.$('historyDetailModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function deleteItem(id) {
    const ok = await U.confirmDialog({
      title: 'Hapus Riwayat',
      message: 'Hapus catatan perhitungan ini dari riwayat?',
      confirmText: 'Hapus',
      danger: true
    });
    if (!ok) return;
    const s = S.getState();
    s.history = s.history.filter((h) => h.id !== id);
    S.persist();
    U.toast('Catatan riwayat dihapus.', 'info');
  }

  async function clearAll() {
    const s = S.getState();
    if (!s.history.length) return;
    const ok = await U.confirmDialog({
      title: 'Hapus Semua Riwayat',
      message: `Yakin ingin menghapus seluruh ${s.history.length} catatan riwayat perhitungan?`,
      confirmText: 'Hapus Semua',
      danger: true
    });
    if (!ok) return;
    s.history = [];
    S.persist();
    U.toast('Seluruh riwayat telah dibersihkan.', 'info');
  }

  function render() {
    const container = U.$('historyListContainer');
    if (!container) return;
    const s = S.getState();
    const list = s.history
      .slice()
      .reverse()
      .filter((h) => activeFilter === 'Semua' || h.type === activeFilter);

    if (!s.history.length) {
      container.innerHTML = `<div class="empty-state">
        <p class="empty-title">Belum ada riwayat perhitungan</p>
        <p class="empty-sub">Riwayat HPP, Scaling Resep, Konversi Loyang, dan Konversi Satuan yang Anda simpan akan muncul di sini.</p>
      </div>`;
      return;
    }

    if (!list.length) {
      container.innerHTML = `<div class="empty-state">
        <p class="empty-title">Tidak ada riwayat untuk kategori "${U.esc(activeFilter)}"</p>
      </div>`;
      return;
    }

    container.innerHTML = list.map((h) => `
      <div class="history-card">
        <div class="hc-body" data-hist-open="${U.esc(h.id)}" role="button" tabindex="0">
          <div class="hc-top">
            <span class="chip ${getTypeBadgeClass(h.type)}">${U.esc(h.type)}</span>
            <span class="muted small-note">${U.formatDateTime(h.date)}</span>
          </div>
          <h4 class="hc-title">${U.esc(h.name)}</h4>
          <p class="hc-summary">${U.esc(h.summary || (h.total !== null ? U.money(h.total) : ''))}</p>
        </div>
        <div class="hc-actions">
          <button type="button" class="btn btn-sm btn-soft" data-hist-open="${U.esc(h.id)}">Detail</button>
          <button type="button" class="btn btn-sm btn-danger-outline" data-hist-del="${U.esc(h.id)}" aria-label="Hapus riwayat">Hapus</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-hist-open]').forEach((el) => {
      el.addEventListener('click', () => openDetail(el.getAttribute('data-hist-open')));
    });
    container.querySelectorAll('[data-hist-del]').forEach((btn) => {
      btn.addEventListener('click', () => deleteItem(btn.getAttribute('data-hist-del')));
    });
  }

  window.BCP.history = {
    init,
    render,
    openDetail,
    deleteItem,
    clearAll
  };
})();
