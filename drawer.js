/* Maps Directory Crawler — Quick Detail Drawer Module
 * Panel drawer samping untuk melihat info lengkap dan manajemen CRM tiap tempat.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  let activeDrawerKey = null;
  let saveFieldHandler = null;
  let getLangFn = () => 'id';

  function keyOf(r) {
    return r ? r.key || r.url : '';
  }

  function getActiveDrawerKey() {
    return activeDrawerKey;
  }

  function tag(text, cls) {
    const s = document.createElement('span');
    s.className = 'tag ' + cls;
    s.textContent = text;
    return s;
  }

  function ratingText(r, isEn) {
    if (r.rating == null) return '—';
    return isEn ? String(r.rating) : String(r.rating).replace('.', ',');
  }

  function socialsEl(socials) {
    if (!Array.isArray(socials) || !socials.length) return null;
    const wrap = document.createElement('div');
    wrap.style.marginTop = '3px';
    for (const s of socials) {
      const parts = s.split(':');
      const type = parts[0];
      const handle = parts.slice(1).join(':');
      const a = document.createElement('a');
      a.className = `social-badge social-${type}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      let url = '#';
      let label = handle;
      if (type === 'instagram') { url = `https://instagram.com/${handle}`; label = `@${handle}`; }
      else if (type === 'whatsapp') { url = `https://wa.me/${handle.replace(/[^\d]/g, '')}`; label = `WA`; }
      else if (type === 'facebook') { url = `https://facebook.com/${handle}`; label = `FB`; }
      else if (type === 'linkedin') { url = `https://linkedin.com/company/${handle}`; label = `in`; }
      else if (type === 'tiktok') { url = `https://tiktok.com/@${handle}`; label = `TT`; }
      else if (type === 'twitter') { url = `https://x.com/${handle}`; label = `X`; }
      a.href = url;
      a.textContent = label;
      wrap.appendChild(a);
    }
    return wrap;
  }

  function openDrawer(r) {
    if (!r) return;
    activeDrawerKey = keyOf(r);
    const currentLang = getLangFn ? getLangFn() : 'id';
    const isEn = currentLang === 'en';

    $('dName').textContent = r.name || (isEn ? '(Unnamed)' : '(Tanpa Nama)');

    const drawerBody = $('drawerModal').querySelector('.drawer-body');
    let dImg = $('dHeroImg');
    if (!dImg) {
      dImg = document.createElement('img');
      dImg.id = 'dHeroImg';
      dImg.className = 'drawer-hero-img';
      drawerBody.prepend(dImg);
    }
    if (r.imageUrl) {
      dImg.src = r.imageUrl;
      dImg.hidden = false;
    } else {
      dImg.hidden = true;
    }

    const badges = $('dBadges');
    badges.textContent = '';
    if (r.rating != null) badges.appendChild(tag(`★ ${ratingText(r, isEn)} (${r.reviews || 0})`, 'dim'));
    if (r.category) badges.appendChild(tag(r.category, 'dim'));
    const hasWeb = r.website != null && String(r.website).trim() !== '';
    if (!hasWeb) badges.appendChild(tag(isEn ? 'No Website' : 'Tanpa Website', 'none'));

    // Peluang & Skor
    const { getOpportunity } = window.MDCOpportunity || { getOpportunity: () => ({ id: 'standard', score: 0, cls: 'opp-std', icon: '📍', label: 'Standard' }) };
    const opp = getOpportunity(r);
    const oppLabel = isEn ? (opp.labelEn || opp.label) : opp.label;
    $('dOppBadge').innerHTML = `<span class="opp-pill ${opp.cls}"><span>${opp.icon}</span> <span>${oppLabel}</span></span>`;
    $('dLeadScore').textContent = `${opp.score}/100`;

    // Tombol aksi cepat
    const cleanPhone = (r.phone || '').replace(/[^\d]/g, '');
    $('dBtnWa').hidden = !cleanPhone;
    if (cleanPhone) $('dBtnWa').href = `https://wa.me/${cleanPhone}`;

    $('dBtnCall').hidden = !cleanPhone;
    if (cleanPhone) $('dBtnCall').href = `tel:${cleanPhone}`;

    $('dBtnSite').hidden = !hasWeb;
    if (hasWeb) $('dBtnSite').href = r.website;

    $('dBtnMap').hidden = !r.url;
    if (r.url) $('dBtnMap').href = r.url;

    $('dBtnEmail').hidden = !r.email;
    if (r.email) $('dBtnEmail').href = `mailto:${r.email}`;

    // Fields
    $('dAddr').textContent = r.address || '—';
    $('dPhone').textContent = r.phone || '—';
    $('dWebsite').textContent = r.website || '—';
    $('dEmail').textContent = r.email || '—';

    const soc = socialsEl(r.socials);
    $('dSocials').textContent = '';
    if (soc) $('dSocials').appendChild(soc);
    else $('dSocials').textContent = '—';

    $('dPlusCode').textContent = r.plusCode || '—';
    if (r.lat != null && r.lng != null) {
      $('dCoords').textContent = `${r.lat}, ${r.lng}`;
    } else {
      $('dCoords').textContent = '—';
    }
    $('dHours').textContent = (r.hours || '').replace(/ \| /g, '\n') || '—';

    const scraped = r.scrapedAt || (r.savedAt ? new Date(r.savedAt).toLocaleString(isEn ? 'en-US' : 'id-ID') : '—');
    $('dScrapedAt').textContent = scraped || '—';

    // CRM Status
    const stWrap = $('dStatusWrap');
    stWrap.textContent = '';
    const sel = document.createElement('select');
    sel.className = 'stsel st-' + (r.status || 'none');
    sel.setAttribute('aria-label', `Status ${r.name || ''}`);

    const statusLabels = {
      '': '—',
      'baru': isEn ? 'New Lead' : 'Baru',
      'dihubungi': isEn ? 'Contacted' : 'Dihubungi',
      'followup': 'Follow-up',
      'deal': isEn ? 'Closed Deal' : 'Deal',
      'tolak': isEn ? 'Not Interested' : 'Tidak tertarik',
    };

    const { STATUSES } = window.MDCExport || { STATUSES: [] };
    for (const o of STATUSES) {
      const opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = statusLabels[o.v] || o.label;
      if ((r.status || '') === o.v) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', async () => {
      sel.className = 'stsel st-' + (sel.value || 'none');
      r.status = sel.value;
      if (saveFieldHandler) await saveFieldHandler(keyOf(r), 'status', sel.value);
    });
    stWrap.appendChild(sel);

    // CRM Note
    const txtNote = $('dNote');
    txtNote.value = r.note || '';
    txtNote.onblur = async () => {
      if (txtNote.value !== (r.note || '')) {
        r.note = txtNote.value;
        if (saveFieldHandler) await saveFieldHandler(keyOf(r), 'note', txtNote.value);
      }
    };

    // CRM Tags
    const txtTags = $('dTags');
    txtTags.value = Array.isArray(r.tags) ? r.tags.join(', ') : r.tags || '';
    txtTags.onblur = async () => {
      const parsed = txtTags.value.split(',').map((t) => t.trim()).filter(Boolean);
      r.tags = parsed;
      if (saveFieldHandler) await saveFieldHandler(keyOf(r), 'tags', parsed);
    };

    $('drawerOverlay').hidden = false;
    $('drawerModal').hidden = false;
  }

  function closeDrawer() {
    activeDrawerKey = null;
    if ($('drawerOverlay')) $('drawerOverlay').hidden = true;
    if ($('drawerModal')) $('drawerModal').hidden = true;
  }

  function initDrawer({ onSaveField, getLang }) {
    saveFieldHandler = onSaveField;
    if (typeof getLang === 'function') getLangFn = getLang;

    if ($('dClose')) $('dClose').addEventListener('click', closeDrawer);
    if ($('drawerOverlay')) $('drawerOverlay').addEventListener('click', closeDrawer);
  }

  window.MDCDrawer = {
    initDrawer,
    openDrawer,
    closeDrawer,
    getActiveDrawerKey,
  };
})();
