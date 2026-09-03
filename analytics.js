/* Maps Directory Crawler — Visual Analytics Module
 * Merender 5 bagan analitik: Radar Peluang, CRM Funnel, Kategori, Kelengkapan Kontak, Distribusi Rating.
 */
(() => {
  const $ = (id) => document.getElementById(id);

  function renderAnalytics(rows, currentLang) {
    const panel = $('analyticsPanel');
    if (!panel || panel.hidden) return;
    const isEn = currentLang === 'en';

    const { OPPORTUNITY_TYPES, getOpportunity } = window.MDCOpportunity || { OPPORTUNITY_TYPES: [] };
    const { STATUSES, has } = window.MDCExport || { STATUSES: [], has: Boolean };

    // 1. Radar Peluang Lead
    const oppWrap = $('analyticsOpportunity');
    if (oppWrap) {
      oppWrap.textContent = '';
      const oppCounts = {};
      for (const ot of OPPORTUNITY_TYPES) oppCounts[ot.id] = 0;
      for (const r of rows) {
        const opp = getOpportunity ? getOpportunity(r) : { id: 'standard' };
        oppCounts[opp.id] = (oppCounts[opp.id] || 0) + 1;
      }
      for (const ot of OPPORTUNITY_TYPES) {
        const cnt = oppCounts[ot.id] || 0;
        const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        const label = isEn ? (ot.shortLabelEn || ot.shortLabel) : ot.shortLabel;
        row.innerHTML = `
          <div class="chart-bar-label"><span>${ot.icon} ${label}</span><span>${cnt} (${pct}%)</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        `;
        oppWrap.appendChild(row);
      }
    }

    // 2. CRM Funnel
    const funnelWrap = $('analyticsFunnel');
    if (funnelWrap) {
      funnelWrap.textContent = '';
      const statusCounts = { baru: 0, dihubungi: 0, followup: 0, deal: 0, tolak: 0, none: 0 };
      for (const r of rows) {
        const s = r.status || 'none';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }

      const statusLabels = {
        '': '—',
        'baru': isEn ? 'New Lead' : 'Baru',
        'dihubungi': isEn ? 'Contacted' : 'Dihubungi',
        'followup': 'Follow-up',
        'deal': isEn ? 'Closed Deal' : 'Deal',
        'tolak': isEn ? 'Not Interested' : 'Tidak tertarik',
      };

      for (const st of STATUSES) {
        const key = st.v || 'none';
        const cnt = statusCounts[key] || 0;
        const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        const label = statusLabels[st.v] || st.label;
        row.innerHTML = `
          <div class="chart-bar-label"><span>${label}</span><span>${cnt} (${pct}%)</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        `;
        funnelWrap.appendChild(row);
      }
    }

    // 3. Top Categories
    const catWrap = $('analyticsCategories');
    if (catWrap) {
      catWrap.textContent = '';
      const catCounts = {};
      for (const r of rows) {
        if (r.category) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
      }
      const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
      for (const [cat, cnt] of topCats) {
        const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        row.innerHTML = `
          <div class="chart-bar-label"><span>${cat}</span><span>${cnt}</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        `;
        catWrap.appendChild(row);
      }
    }

    // 4. Completeness
    const compWrap = $('analyticsCompleteness');
    if (compWrap) {
      compWrap.textContent = '';
      const nPhone = rows.filter((r) => has(r.phone)).length;
      const nSite = rows.filter((r) => has(r.website)).length;
      const nEmail = rows.filter((r) => has(r.email)).length;
      const nSocial = rows.filter((r) => Array.isArray(r.socials) && r.socials.length > 0).length;

      const compList = isEn
        ? [['Phone', nPhone], ['Website', nSite], ['Email', nEmail], ['Socials', nSocial]]
        : [['Telepon', nPhone], ['Website', nSite], ['Email', nEmail], ['Sosial', nSocial]];

      for (const [label, cnt] of compList) {
        const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        row.innerHTML = `
          <div class="chart-bar-label"><span>${label}</span><span>${cnt} (${pct}%)</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        `;
        compWrap.appendChild(row);
      }
    }

    // 5. Rating Distribution
    const rateWrap = $('analyticsRating');
    if (rateWrap) {
      rateWrap.textContent = '';
      const rHigh = rows.filter((r) => r.rating != null && r.rating >= 4.5).length;
      const rMid = rows.filter((r) => r.rating != null && r.rating >= 4.0 && r.rating < 4.5).length;
      const rLow = rows.filter((r) => r.rating != null && r.rating < 4.0).length;

      for (const [label, cnt] of [['≥ 4.5 Star', rHigh], ['4.0 - 4.4 Star', rMid], ['< 4.0 Star', rLow]]) {
        const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        row.innerHTML = `
          <div class="chart-bar-label"><span>${label}</span><span>${cnt}</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        `;
        rateWrap.appendChild(row);
      }
    }
  }

  function initAnalyticsToggle(onToggleCallback) {
    const btn = $('toggleAnalytics');
    if (btn) {
      btn.addEventListener('click', () => {
        const p = $('analyticsPanel');
        if (p) {
          p.hidden = !p.hidden;
          if (typeof onToggleCallback === 'function') onToggleCallback();
        }
      });
    }
  }

  window.MDCAnalytics = {
    renderAnalytics,
    initAnalyticsToggle,
  };
})();
