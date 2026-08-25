/* Dashboard: tabel/kartu hasil crawl, filter, pagination, dan progress live.
 * Data selalu dibaca dari background — halaman ini tidak menyimpan state apa pun
 * selain preferensi tampilan. */

const $ = (id) => document.getElementById(id);
const {
  has, needsEnrich, needsEmail, STATUSES, toTSV, downloadCSV, downloadExcel, downloadJSON,
  extractEmailList, extractPhoneList
} = window.MDCExport;

const send = (msg) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const err = chrome.runtime.lastError;
      resolve(err ? { ok: false, error: err.message } : res || { ok: false, error: 'tanpa respons' });
    });
  });

const RUNNING = ['collecting', 'detailing', 'enriching', 'emailing'];
const PREFS_KEY = 'mdc_prefs';

let rows = [];
let sessions = [];
let view = [];        // baris setelah filter — inilah yang diexport
let state = {};
let page = 1;
let perPage = 50;
let mode = 'table';
let firstLoad = true;
let ver = -1;          // versi data yang dipegang halaman ini
let seenKeys = new Set();  // untuk animasi baris baru
let lastSig = '';          // hindari render ulang saat tidak ada perubahan
let selectedKeys = new Set(); // multi-select baris
let activeDrawerKey = null; // key baris yang sedang terbuka di drawer

const keyOf = (r) => r.key || r.url;

/* ── preferensi tampilan ─────────────────────────────────────── */

async function loadPrefs() {
  const o = await chrome.storage.local.get(PREFS_KEY);
  const p = o[PREFS_KEY] || {};
  mode = p.mode === 'card' ? 'card' : 'table';
  perPage = [25, 50, 100, 250].includes(p.perPage) ? p.perPage : 50;
  $('perPage').value = String(perPage);
  setMode(mode, false);
}

function savePrefs() {
  chrome.storage.local.set({ [PREFS_KEY]: { mode, perPage } });
}

/* ── filter & sort ───────────────────────────────────────────── */

function sessionLabel(id) {
  const s = sessions.find((x) => x.id === id);
  return s ? s.label : id;
}

function filtersActive() {
  return (
    $('q').value.trim() !== '' ||
    $('session').value !== 'all' ||
    $('fWebsite').value !== 'all' ||
    $('fPhone').value !== 'all' ||
    $('fStatus').value !== 'all' ||
    $('fEmail').value !== 'all' ||
    $('fSocial').value !== 'all' ||
    $('fRating').value !== 'all' ||
    $('sort').value !== 'default'
  );
}

function applyFilters() {
  const q = $('q').value.trim().toLowerCase();
  const sid = $('session').value;
  const fw = $('fWebsite').value;
  const fp = $('fPhone').value;
  const fs = $('fStatus').value;
  const fe = $('fEmail').value;
  const fsoc = $('fSocial').value;
  const fr = $('fRating').value;

  view = rows.filter((r) => {
    if (sid !== 'all' && !(r.sessions || []).includes(sid)) return false;
    if (fw === 'no' && has(r.website)) return false;
    if (fw === 'yes' && !has(r.website)) return false;
    if (fp === 'no' && has(r.phone)) return false;
    if (fp === 'yes' && !has(r.phone)) return false;

    if (fs === 'none' && has(r.status)) return false;
    if (fs !== 'all' && fs !== 'none' && r.status !== fs) return false;

    if (fe === 'yes' && !has(r.email)) return false;
    if (fe === 'no' && has(r.email)) return false;

    const hasSocials = Array.isArray(r.socials) && r.socials.length > 0;
    if (fsoc === 'yes' && !hasSocials) return false;
    if (fsoc === 'no' && hasSocials) return false;

    if (fr === 'none' && r.rating != null) return false;
    if (fr === 'lt4' && !(r.rating != null && r.rating < 4)) return false;
    if (fr === 'gte4' && !(r.rating != null && r.rating >= 4)) return false;
    if (fr === 'gte45' && !(r.rating != null && r.rating >= 4.5)) return false;

    if (q) {
      const tagsStr = Array.isArray(r.tags) ? r.tags.join(' ') : r.tags || '';
      const socStr = Array.isArray(r.socials) ? r.socials.join(' ') : r.socials || '';
      const hay = [r.name, r.address, r.category, r.phone, r.website, r.email, r.note, tagsStr, socStr]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sort = $('sort').value;
  if (sort === 'name') view.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
  else if (sort === 'rating') view.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'reviews') view.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  else if (sort === 'category') view.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'id'));

  $('reset').hidden = !filtersActive();

  // Jaga halaman tetap valid setelah jumlah baris berubah.
  const maxPage = Math.max(1, Math.ceil(view.length / perPage));
  if (page > maxPage) page = maxPage;
}

function pageRows() {
  const start = (page - 1) * perPage;
  return view.slice(start, start + perPage);
}

/* ── elemen UI ───────────────────────────────────────────────── */

function link(href, label) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  return a;
}

function tag(text, cls) {
  const s = document.createElement('span');
  s.className = 'tag ' + cls;
  s.textContent = text;
  return s;
}

function contactCell(value, kind, row) {
  if (has(value)) {
    if (kind === 'phone') return link('tel:' + String(value).replace(/\s/g, ''), value);
    let label = value;
    try { label = new URL(value).hostname.replace(/^www\./, ''); } catch (_) {}
    return link(value, label);
  }
  return tag(row.enrichedAt ? 'tidak punya' : 'belum ada', row.enrichedAt ? 'dim' : 'none');
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

function statusSelect(r) {
  const sel = document.createElement('select');
  sel.className = 'stsel st-' + (r.status || 'none');
  sel.setAttribute('aria-label', `Status ${r.name || ''}`);
  for (const o of STATUSES) {
    const opt = document.createElement('option');
    opt.value = o.v;
    opt.textContent = o.label;
    if ((r.status || '') === o.v) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', async () => {
    sel.className = 'stsel st-' + (sel.value || 'none');
    r.status = sel.value;
    await send({ type: 'SET_FIELD', key: keyOf(r), field: 'status', value: sel.value });
    ver = -1;
    lastSig = '';
  });
  return sel;
}

function noteInput(r) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'note';
  inp.value = r.note || '';
  inp.placeholder = '—';
  inp.setAttribute('aria-label', `Catatan ${r.name || ''}`);
  let last = inp.value;
  const save = async () => {
    if (inp.value === last) return;
    last = inp.value;
    r.note = inp.value;
    await send({ type: 'SET_FIELD', key: keyOf(r), field: 'note', value: inp.value });
    ver = -1;
    lastSig = '';
  };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inp.blur();
  });
  return inp;
}

function emailCell(r) {
  const container = document.createElement('div');
  if (has(r.email)) {
    const a = link('mailto:' + r.email, r.email);
    if (has(r.emailsAll)) a.title = r.emailsAll;
    container.appendChild(a);
  } else if (!has(r.website)) {
    container.appendChild(tag('tanpa web', 'dim'));
  } else {
    container.appendChild(tag(r.emailCheckedAt ? 'tidak ada' : 'belum dicek', r.emailCheckedAt ? 'dim' : 'none'));
  }

  const soc = socialsEl(r.socials);
  if (soc) container.appendChild(soc);
  return container;
}

function delButton(r) {
  const b = document.createElement('button');
  b.className = 'rowdel';
  b.textContent = '×';
  b.title = 'Hapus baris ini';
  b.setAttribute('aria-label', `Hapus ${r.name || 'baris'}`);
  b.addEventListener('click', async (e) => {
    e.stopPropagation();
    await send({ type: 'DELETE_ROW', key: keyOf(r) });
    selectedKeys.delete(keyOf(r));
    ver = -1;
    lastSig = '';
    refresh();
  });
  return b;
}

function sessEl(r) {
  const tags = r.sessions || [];
  if (!tags.length) return null;
  const d = document.createElement('div');
  d.className = 'sess';
  d.textContent = tags.map(sessionLabel).join(' · ');
  return d;
}

function ratingText(r) {
  if (r.rating == null) return '—';
  return String(r.rating).replace('.', ',');
}

/* ── skeleton saat memuat ────────────────────────────────────── */

function renderSkeleton() {
  const tb = $('tbody');
  tb.textContent = '';
  for (let i = 0; i < 6; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skel';
    const W = [15, 65, 45, 30, 85, 55, 50, 60, 40, 55, 15];
    for (let c = 0; c < W.length; c++) {
      const td = document.createElement('td');
      const s = document.createElement('span');
      s.className = 'sk';
      s.style.width = W[c] + '%';
      td.appendChild(s);
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  $('tableWrap').hidden = false;
  $('cardWrap').hidden = true;
  $('empty').hidden = true;
  $('pager').hidden = true;
}

/* ── render tabel ────────────────────────────────────────────── */

function renderTable(list) {
  const tb = $('tbody');
  tb.textContent = '';
  const frag = document.createDocumentFragment();

  for (const r of list) {
    const k = keyOf(r);
    const tr = document.createElement('tr');
    const cls = [];
    if (!has(r.website)) cls.push('nosite');
    if (state.activeKey && state.activeKey === k) cls.push('active');
    if (!firstLoad && !seenKeys.has(k)) cls.push('enter');
    tr.className = cls.join(' ');

    // Checkbox sel
    const tdChk = document.createElement('td');
    tdChk.className = 'c-chk';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = selectedKeys.has(k);
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      if (chk.checked) selectedKeys.add(k);
      else selectedKeys.delete(k);
      updateBatchBar();
    });
    tdChk.appendChild(chk);
    tr.appendChild(tdChk);

    // Nama sel (bisa diklik untuk buka drawer)
    const tdName = document.createElement('td');
    const nm = document.createElement('div');
    nm.className = 'pname';
    if (r.imageUrl) {
      const tImg = document.createElement('img');
      tImg.className = 'tbl-thumb';
      tImg.src = r.imageUrl;
      tImg.alt = r.name || '';
      tImg.loading = 'lazy';
      nm.appendChild(tImg);
    }
    const nmText = document.createElement('div');
    nmText.appendChild(r.url ? link(r.url, r.name || '(tanpa nama)') : document.createTextNode(r.name || '(tanpa nama)'));
    nm.appendChild(nmText);
    nm.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') {
        openDrawer(r);
      }
    });
    tdName.appendChild(nm);
    const se = sessEl(r);
    if (se) tdName.appendChild(se);
    tr.appendChild(tdName);

    const tdCat = document.createElement('td');
    tdCat.className = 'c-cat';
    tdCat.textContent = r.category || '—';
    if (r.category) tdCat.title = r.category;
    tr.appendChild(tdCat);

    const tdRate = document.createElement('td');
    tdRate.className = 'num';
    if (r.rating != null) {
      const sIcon = document.createElement('span');
      sIcon.className = 'star-icon';
      sIcon.textContent = '★ ';
      tdRate.appendChild(sIcon);
      const rVal = document.createElement('span');
      rVal.className = 'rate-val';
      rVal.textContent = ratingText(r);
      tdRate.appendChild(rVal);
      if (r.reviews != null) {
        const sp = document.createElement('span');
        sp.className = 'rev';
        sp.textContent = ` (${r.reviews})`;
        tdRate.appendChild(sp);
      }
    } else {
      tdRate.textContent = '—';
    }
    tr.appendChild(tdRate);

    const tdAddr = document.createElement('td');
    tdAddr.className = 'addr';
    tdAddr.textContent = r.address || '—';
    if (r.address) tdAddr.title = r.address;
    tr.appendChild(tdAddr);

    const tdPhone = document.createElement('td');
    tdPhone.appendChild(contactCell(r.phone, 'phone', r));
    tr.appendChild(tdPhone);

    const tdSite = document.createElement('td');
    tdSite.appendChild(contactCell(r.website, 'site', r));
    tr.appendChild(tdSite);

    const tdEmail = document.createElement('td');
    tdEmail.className = 'emailcell';
    tdEmail.appendChild(emailCell(r));
    tr.appendChild(tdEmail);

    const tdStatus = document.createElement('td');
    tdStatus.appendChild(statusSelect(r));
    tr.appendChild(tdStatus);

    const tdNote = document.createElement('td');
    tdNote.className = 'notecell';
    tdNote.appendChild(noteInput(r));
    if (Array.isArray(r.tags) && r.tags.length) {
      const tc = document.createElement('div');
      tc.className = 'tags-wrap';
      for (const t of r.tags) {
        const s = document.createElement('span');
        s.className = 'tag-chip';
        s.textContent = t;
        tc.appendChild(s);
      }
      tdNote.appendChild(tc);
    }
    if (r.hours) tdNote.title = 'Jam buka: ' + r.hours;
    tr.appendChild(tdNote);

    const tdAct = document.createElement('td');
    tdAct.appendChild(delButton(r));
    tr.appendChild(tdAct);

    frag.appendChild(tr);
  }
  tb.appendChild(frag);

  // Sync state selectAll checkbox
  const currentKeys = list.map(keyOf);
  const allSelected = currentKeys.length > 0 && currentKeys.every((k) => selectedKeys.has(k));
  $('selectAll').checked = allSelected;
}

/* ── render kartu ────────────────────────────────────────────── */

function renderCards(list) {
  const wrap = $('cardWrap');
  wrap.textContent = '';
  const frag = document.createDocumentFragment();

  for (const r of list) {
    const k = keyOf(r);
    const card = document.createElement('article');
    const cls = ['card'];
    if (!has(r.website)) cls.push('nosite');
    if (state.activeKey && state.activeKey === k) cls.push('active');
    if (!firstLoad && !seenKeys.has(k)) cls.push('enter');
    card.className = cls.join(' ');

    if (r.imageUrl) {
      const cImg = document.createElement('img');
      cImg.className = 'card-img';
      cImg.src = r.imageUrl;
      cImg.alt = r.name || '';
      cImg.loading = 'lazy';
      card.appendChild(cImg);
    }

    const h3 = document.createElement('h3');
    h3.appendChild(r.url ? link(r.url, r.name || '(tanpa nama)') : document.createTextNode(r.name || '(tanpa nama)'));
    h3.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') openDrawer(r);
    });
    card.appendChild(h3);

    const meta = document.createElement('div');
    meta.className = 'meta';
    if (r.rating != null) {
      const sp = document.createElement('span');
      sp.className = 'rate';
      sp.textContent = '★ ' + ratingText(r);
      meta.appendChild(sp);
      if (r.reviews != null) {
        const rv = document.createElement('span');
        rv.textContent = `${r.reviews} ulasan`;
        meta.appendChild(rv);
      }
    }
    if (r.category) {
      const c = document.createElement('span');
      c.textContent = r.category;
      meta.appendChild(c);
    }
    if (meta.children.length) card.appendChild(meta);

    if (r.address) {
      const ad = document.createElement('div');
      ad.className = 'addr';
      ad.textContent = r.address;
      card.appendChild(ad);
    }

    const lines = document.createElement('div');
    lines.className = 'lines';
    for (const [label, val, kind] of [['Telepon', r.phone, 'phone'], ['Website', r.website, 'site']]) {
      const d = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = label;
      d.appendChild(b);
      d.appendChild(contactCell(val, kind, r));
      lines.appendChild(d);
    }
    {
      const d = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = 'Email';
      d.appendChild(b);
      d.appendChild(emailCell(r));
      lines.appendChild(d);
    }
    if (r.hours) {
      const d = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = 'Jam';
      d.appendChild(b);
      const s = document.createElement('span');
      s.textContent = r.hours;
      s.title = r.hours;
      d.appendChild(s);
      lines.appendChild(d);
    }
    card.appendChild(lines);

    const crm = document.createElement('div');
    crm.className = 'crm';
    crm.appendChild(statusSelect(r));
    crm.appendChild(noteInput(r));
    card.appendChild(crm);

    const se = sessEl(r);
    if (se) card.appendChild(se);
    card.appendChild(delButton(r));
    frag.appendChild(card);
  }
  wrap.appendChild(frag);
}

/* ── batch actions ───────────────────────────────────────────── */

function updateBatchBar() {
  const count = selectedKeys.size;
  $('batchBar').hidden = count === 0;
  $('batchCount').textContent = `${count} terpilih`;
}

$('selectAll').addEventListener('change', (e) => {
  const keys = pageRows().map(keyOf);
  if (e.target.checked) {
    for (const k of keys) selectedKeys.add(k);
  } else {
    for (const k of keys) selectedKeys.delete(k);
  }
  draw();
  updateBatchBar();
});

$('batchCancel').addEventListener('click', () => {
  selectedKeys.clear();
  draw();
  updateBatchBar();
});

$('batchStatusSel').addEventListener('change', async () => {
  const st = $('batchStatusSel').value;
  if (!st || selectedKeys.size === 0) return;
  await send({ type: 'BATCH_SET_STATUS', keys: [...selectedKeys], status: st });
  $('batchStatusSel').value = '';
  selectedKeys.clear();
  ver = -1;
  lastSig = '';
  refresh();
});

$('batchDelete').addEventListener('click', async () => {
  if (!selectedKeys.size) return;
  if (!confirm(`Hapus ${selectedKeys.size} baris terpilih?`)) return;
  await send({ type: 'BATCH_DELETE', keys: [...selectedKeys] });
  selectedKeys.clear();
  ver = -1;
  lastSig = '';
  refresh();
});

$('batchExport').addEventListener('click', () => {
  const selectedRows = view.filter((r) => selectedKeys.has(keyOf(r)));
  if (!selectedRows.length) return;
  downloadCSV(selectedRows);
});

/* ── quick detail drawer ─────────────────────────────────────── */

function openDrawer(r) {
  activeDrawerKey = keyOf(r);
  $('dName').textContent = r.name || '(Tanpa Nama)';

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
  if (r.rating != null) badges.appendChild(tag(`★ ${ratingText(r)} (${r.reviews || 0})`, 'dim'));
  if (r.category) badges.appendChild(tag(r.category, 'dim'));
  if (!has(r.website)) badges.appendChild(tag('Tanpa Website', 'none'));

  // Quick Action Buttons
  const cleanPhone = (r.phone || '').replace(/[^\d]/g, '');
  $('dBtnWa').hidden = !cleanPhone;
  if (cleanPhone) $('dBtnWa').href = `https://wa.me/${cleanPhone}`;

  $('dBtnCall').hidden = !cleanPhone;
  if (cleanPhone) $('dBtnCall').href = `tel:${cleanPhone}`;

  $('dBtnSite').hidden = !has(r.website);
  if (has(r.website)) $('dBtnSite').href = r.website;

  $('dBtnMap').hidden = !has(r.url);
  if (has(r.url)) $('dBtnMap').href = r.url;

  $('dBtnEmail').hidden = !has(r.email);
  if (has(r.email)) $('dBtnEmail').href = `mailto:${r.email}`;

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

  // CRM controls inside drawer
  const stWrap = $('dStatusWrap');
  stWrap.textContent = '';
  const sel = statusSelect(r);
  stWrap.appendChild(sel);

  const txtNote = $('dNote');
  txtNote.value = r.note || '';
  txtNote.onblur = async () => {
    if (txtNote.value !== (r.note || '')) {
      r.note = txtNote.value;
      await send({ type: 'SET_FIELD', key: keyOf(r), field: 'note', value: txtNote.value });
      ver = -1;
      lastSig = '';
    }
  };

  const txtTags = $('dTags');
  txtTags.value = Array.isArray(r.tags) ? r.tags.join(', ') : r.tags || '';
  txtTags.onblur = async () => {
    const parsed = txtTags.value.split(',').map((t) => t.trim()).filter(Boolean);
    r.tags = parsed;
    await send({ type: 'SET_FIELD', key: keyOf(r), field: 'tags', value: parsed });
    ver = -1;
    lastSig = '';
  };

  $('drawerOverlay').hidden = false;
  $('drawerModal').hidden = false;
}

function closeDrawer() {
  activeDrawerKey = null;
  $('drawerOverlay').hidden = true;
  $('drawerModal').hidden = true;
}

$('dClose').addEventListener('click', closeDrawer);
$('drawerOverlay').addEventListener('click', closeDrawer);

/* ── visual analytics ────────────────────────────────────────── */

function renderAnalytics() {
  const panel = $('analyticsPanel');
  if (panel.hidden) return;

  // 1. CRM Funnel
  const funnelWrap = $('analyticsFunnel');
  funnelWrap.textContent = '';
  const statusCounts = { baru: 0, dihubungi: 0, followup: 0, deal: 0, tolak: 0, none: 0 };
  for (const r of rows) {
    const s = r.status || 'none';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  for (const st of STATUSES) {
    const key = st.v || 'none';
    const cnt = statusCounts[key] || 0;
    const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
    
    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <div class="chart-bar-label"><span>${st.label}</span><span>${cnt} (${pct}%)</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
    `;
    funnelWrap.appendChild(row);
  }

  // 2. Top Categories
  const catWrap = $('analyticsCategories');
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

  // 3. Completeness
  const compWrap = $('analyticsCompleteness');
  compWrap.textContent = '';
  const nPhone = rows.filter((r) => has(r.phone)).length;
  const nSite = rows.filter((r) => has(r.website)).length;
  const nEmail = rows.filter((r) => has(r.email)).length;
  const nSocial = rows.filter((r) => Array.isArray(r.socials) && r.socials.length > 0).length;

  for (const [label, cnt] of [['Telepon', nPhone], ['Website', nSite], ['Email', nEmail], ['Sosial', nSocial]]) {
    const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <div class="chart-bar-label"><span>${label}</span><span>${cnt} (${pct}%)</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
    `;
    compWrap.appendChild(row);
  }

  // 4. Rating Distribution
  const rateWrap = $('analyticsRating');
  rateWrap.textContent = '';
  const rHigh = rows.filter((r) => r.rating != null && r.rating >= 4.5).length;
  const rMid = rows.filter((r) => r.rating != null && r.rating >= 4.0 && r.rating < 4.5).length;
  const rLow = rows.filter((r) => r.rating != null && r.rating < 4.0).length;

  for (const [label, cnt] of [['≥ 4,5 Star', rHigh], ['4,0 - 4,4 Star', rMid], ['< 4,0 Star', rLow]]) {
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

$('toggleAnalytics').addEventListener('click', () => {
  const p = $('analyticsPanel');
  p.hidden = !p.hidden;
  renderAnalytics();
});

/* ── pagination & render ─────────────────────────────────────── */

function renderPager() {
  const total = view.length;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  $('pager').hidden = total === 0;
  if (!total) return;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  $('pInfo').textContent = `${from}–${to} dari ${total}  ·  hal ${page}/${maxPage}`;

  $('pFirst').disabled = page <= 1;
  $('pPrev').disabled = page <= 1;
  $('pNext').disabled = page >= maxPage;
  $('pLast').disabled = page >= maxPage;
}

function goto(p) {
  const maxPage = Math.max(1, Math.ceil(view.length / perPage));
  page = Math.min(Math.max(1, p), maxPage);
  lastSig = '';
  draw();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function draw() {
  const list = pageRows();

  const sig = JSON.stringify([
    mode, page, perPage, view.length, rows.length, state.activeKey, [...selectedKeys],
    list.map((r) => [keyOf(r), r.phone || '', r.website || '', r.email || '',
                     r.status || '', r.note || '', r.enrichedAt || 0, r.emailCheckedAt || 0]),
  ]);
  if (sig === lastSig) return;
  lastSig = sig;

  const empty = view.length === 0;
  $('empty').hidden = !empty;
  if (empty) {
    $('empty').textContent = rows.length
      ? 'Tidak ada baris yang cocok dengan filter.'
      : 'Belum ada data. Buka Google Maps, cari sesuatu, lalu klik Mulai di popup extension.';
  }
  $('tableWrap').hidden = mode !== 'table' || empty;
  $('cardWrap').hidden = mode !== 'card' || empty;

  if (!empty) {
    if (mode === 'table') renderTable(list);
    else renderCards(list);
  }
  renderPager();

  $('shown').textContent = view.length === rows.length
    ? `${rows.length} tempat`
    : `${view.length} dari ${rows.length}`;

  for (const r of list) seenKeys.add(keyOf(r));
  renderAnalytics();
}

function setMode(m, persist = true) {
  mode = m;
  $('viewTable').classList.toggle('on', m === 'table');
  $('viewCard').classList.toggle('on', m === 'card');
  $('viewTable').setAttribute('aria-pressed', String(m === 'table'));
  $('viewCard').setAttribute('aria-pressed', String(m === 'card'));
  lastSig = '';
  if (persist) {
    savePrefs();
    draw();
  }
}

/* ── statistik & progress ────────────────────────────────────── */

function renderStats() {
  const withSite = rows.filter((r) => has(r.website)).length;
  $('sTotal').textContent = rows.length;
  $('sPhone').textContent = rows.filter((r) => has(r.phone)).length;
  $('sSite').textContent = withSite;
  $('sNoSite').textContent = rows.length - withSite;
  $('sEmail').textContent = rows.filter((r) => has(r.email)).length;
  $('sSocial').textContent = rows.filter((r) => Array.isArray(r.socials) && r.socials.length > 0).length;
  $('sIncomplete').textContent = rows.filter(needsEnrich).length;
}

function renderSessions() {
  const sel = $('session');
  const prev = sel.value;
  sel.textContent = '';

  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = `Semua sesi (${rows.length})`;
  sel.appendChild(all);

  for (const s of [...sessions].reverse()) {
    const n = rows.filter((r) => (r.sessions || []).includes(s.id)).length;
    if (!n) continue;
    const o = document.createElement('option');
    o.value = s.id;
    const d = new Date(s.startedAt);
    const p = (x) => String(x).padStart(2, '0');
    o.textContent = `${s.label} — ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())} (${n})`;
    sel.appendChild(o);
  }
  sel.value = [...sel.options].some((o) => o.value === prev) ? prev : 'all';
}

function renderRun() {
  const running = RUNNING.includes(state.status);
  $('statusChip').textContent = state.status || 'idle';
  $('statusChip').className = 'chip ' + (state.status || 'idle');
  $('live').hidden = !running;

  const pending = rows.filter(needsEmail).length;
  $('emails').disabled = running || pending === 0;
  $('emails').textContent = pending ? `Cari email (${pending})` : 'Cari email & sosial';

  const incomplete = rows.filter(needsEnrich).length;
  $('enrich').disabled = running || incomplete === 0;
  $('enrich').textContent = incomplete ? `Lengkapi kontak (${incomplete})` : 'Lengkapi kontak';
  $('stop').disabled = !running;
  $('clear').disabled = running || rows.length === 0;

  const show = running || state.status === 'error';
  $('runBar').hidden = !show;
  if (!show) return;

  $('runBar').classList.toggle('err', state.status === 'error');

  let msg = state.message || '';
  const fill = $('fill');
  if (state.status === 'collecting') {
    fill.classList.add('indet');
    $('runPct').textContent = `${state.collected || 0} terkumpul`;
  } else if (state.detailTotal) {
    fill.classList.remove('indet');
    const pct = Math.round((state.detailIndex / state.detailTotal) * 100);
    fill.style.width = pct + '%';
    $('runPct').textContent = `${state.detailIndex}/${state.detailTotal} · ${pct}%`;
  } else {
    fill.classList.remove('indet');
    fill.style.width = '0%';
    $('runPct').textContent = '';
  }
  $('runMsg').textContent = msg;
}

/* ── refresh ─────────────────────────────────────────────────── */

async function refresh() {
  const res = await send({ type: 'GET_STATE', since: ver });
  if (!res.ok) return;

  const rowsChanged = Array.isArray(res.rows);
  if (rowsChanged) rows = res.rows;
  if (typeof res.ver === 'number') ver = res.ver;
  sessions = res.sessions || [];
  state = res.state || {};

  if (rowsChanged) {
    renderSessions();
    renderStats();
    applyFilters();
  }

  draw();
  renderRun();

  if (firstLoad) {
    firstLoad = false;
    for (const r of rows) seenKeys.add(keyOf(r));
  }
}

/* ── table header sorting ────────────────────────────────────── */

document.querySelectorAll('th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const targetSort = th.dataset.sort;
    const current = $('sort').value;
    $('sort').value = current === targetSort ? 'default' : targetSort;
    page = 1;
    lastSig = '';
    applyFilters();
    draw();
  });
});

/* ── events ──────────────────────────────────────────────────── */

for (const id of ['q', 'session', 'fWebsite', 'fPhone', 'fStatus', 'fEmail', 'fSocial', 'fRating', 'sort']) {
  $(id).addEventListener('input', () => {
    page = 1;
    lastSig = '';
    applyFilters();
    draw();
  });
}

$('reset').addEventListener('click', () => {
  $('q').value = '';
  for (const id of ['session', 'fWebsite', 'fPhone', 'fStatus', 'fEmail', 'fSocial', 'fRating']) $(id).value = 'all';
  $('sort').value = 'default';
  page = 1;
  lastSig = '';
  applyFilters();
  draw();
});

$('viewTable').addEventListener('click', () => setMode('table'));
$('viewCard').addEventListener('click', () => setMode('card'));

$('pFirst').addEventListener('click', () => goto(1));
$('pPrev').addEventListener('click', () => goto(page - 1));
$('pNext').addEventListener('click', () => goto(page + 1));
$('pLast').addEventListener('click', () => goto(Math.ceil(view.length / perPage)));
$('perPage').addEventListener('change', () => {
  perPage = parseInt($('perPage').value, 10) || 50;
  page = 1;
  savePrefs();
  lastSig = '';
  applyFilters();
  draw();
});

document.addEventListener('keydown', (e) => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === 'ArrowLeft' && page > 1) goto(page - 1);
  if (e.key === 'ArrowRight') goto(page + 1);
  if (e.key === 'Escape') closeDrawer();
});

$('enrich').addEventListener('click', async () => {
  const res = await send({ type: 'ENRICH' });
  if (!res.ok) {
    $('runBar').hidden = false;
    $('runBar').classList.add('err');
    $('runMsg').textContent = res.error;
    $('runPct').textContent = '';
  }
  refresh();
});

$('emails').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: ['*://*/*'] });
  if (!granted) {
    $('runBar').hidden = false;
    $('runBar').classList.add('err');
    $('runMsg').textContent = 'Izin akses website ditolak — pencarian email dibatalkan.';
    return;
  }
  const res = await send({ type: 'FIND_EMAILS' });
  if (!res.ok) {
    $('runBar').hidden = false;
    $('runBar').classList.add('err');
    $('runMsg').textContent = res.error;
  }
  refresh();
});

$('stop').addEventListener('click', async () => {
  await send({ type: 'STOP' });
  refresh();
});

$('clear').addEventListener('click', async () => {
  if (!confirm(`Hapus semua ${rows.length} baris dan seluruh riwayat sesi? Tindakan ini tidak bisa dibatalkan.`)) return;
  await send({ type: 'CLEAR' });
  ver = -1;
  page = 1;
  seenKeys = new Set();
  selectedKeys = new Set();
  lastSig = '';
  refresh();
});

$('dedupe').addEventListener('click', async () => {
  const res = await send({ type: 'DEDUPLICATE' });
  if (res.ok) {
    alert(`Pembersihan selesai: ${res.removed} duplikat digabung. Sisa ${res.count} tempat.`);
    ver = -1;
    lastSig = '';
    refresh();
  }
});

// Exports & Copies
$('csv').addEventListener('click', () => downloadCSV(view));
$('excel').addEventListener('click', () => downloadExcel(view));
$('json').addEventListener('click', () => downloadJSON(view));
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(toTSV(view));
    alert(`${view.length} baris disalin ke clipboard!`);
  } catch (_) {}
});
$('copyEmails').addEventListener('click', async () => {
  const list = extractEmailList(view);
  if (!list) return alert('Tidak ada email untuk disalin pada filter ini.');
  await navigator.clipboard.writeText(list);
  alert('Daftar email berhasil disalin ke clipboard!');
});
$('copyPhones').addEventListener('click', async () => {
  const list = extractPhoneList(view);
  if (!list) return alert('Tidak ada nomor telepon untuk disalin pada filter ini.');
  await navigator.clipboard.writeText(list);
  alert('Daftar nomor telepon berhasil disalin ke clipboard!');
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'STATE') refresh();
});

setInterval(() => {
  if (RUNNING.includes(state.status)) refresh();
}, 700);
setInterval(refresh, 2500);

renderSkeleton();
loadPrefs().then(refresh);
