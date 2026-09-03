/* Maps Directory Crawler — Dashboard Pro
 * Lead Intelligence & Outreach Platform Controller.
 * Menghubungkan modul modular: MDCI18n, MDCAnalytics, MDCDrawer, MDCImportModal, MDCExport, MDCOpportunity.
 */

const $ = (id) => document.getElementById(id);

const {
  has, needsEnrich, needsEmail, STATUSES, toTSV, downloadCSV, downloadExcel, downloadJSON,
  extractEmailList, extractPhoneList, downloadBackup,
} = window.MDCExport || {};

const { getOpportunity } = window.MDCOpportunity || { getOpportunity: () => ({ id: 'standard', score: 0 }) };
const { LANG_KEY, getLang, initI18n, applyI18n, updateFilterOptionTexts } = window.MDCI18n || {};
const { renderAnalytics, initAnalyticsToggle } = window.MDCAnalytics || {};
const { initDrawer, openDrawer, closeDrawer, getActiveDrawerKey } = window.MDCDrawer || {};
const { initImportModal } = window.MDCImportModal || {};

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
let view = [];
let state = {};
let page = 1;
let perPage = 50;
let mode = 'table';
let firstLoad = true;
let ver = -1;
let seenKeys = new Set();
let lastSig = '';
let selectedKeys = new Set();

const keyOf = (r) => (r ? r.key || r.url : '');

/* ── TOAST NOTIFICATIONS ─────────────────────────────────────── */

function showToast(msg, type = 'info', duration = 3200) {
  const container = $('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

/* ── PREFERENCES & LANGUAGE ──────────────────────────────────── */

async function loadPrefs() {
  const o = await chrome.storage.local.get([PREFS_KEY, LANG_KEY]);
  const p = o[PREFS_KEY] || {};
  mode = p.mode === 'card' ? 'card' : 'table';
  perPage = [25, 50, 100, 250].includes(p.perPage) ? p.perPage : 50;
  if ($('perPage')) $('perPage').value = String(perPage);

  if (initI18n) {
    initI18n(o[LANG_KEY] || 'id', () => {
      lastSig = '';
      draw();
      const activeKey = getActiveDrawerKey ? getActiveDrawerKey() : null;
      if (activeKey) {
        const row = rows.find((r) => keyOf(r) === activeKey);
        if (row && openDrawer) openDrawer(row);
      }
    });
  }

  setMode(mode, false);
}

function savePrefs() {
  chrome.storage.local.set({ [PREFS_KEY]: { mode, perPage } });
}

/* ── FILTERS & SORTING ───────────────────────────────────────── */

function sessionLabel(id) {
  const s = sessions.find((x) => x.id === id);
  return s ? s.label : id;
}

function filtersActive() {
  return (
    $('q').value.trim() !== '' ||
    $('session').value !== 'all' ||
    $('fOpp').value !== 'all' ||
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
  const fopp = $('fOpp').value;
  const fw = $('fWebsite').value;
  const fp = $('fPhone').value;
  const fs = $('fStatus').value;
  const fe = $('fEmail').value;
  const fsoc = $('fSocial').value;
  const fr = $('fRating').value;

  view = rows.filter((r) => {
    if (sid !== 'all' && !(r.sessions || []).includes(sid)) return false;

    if (fopp !== 'all') {
      const opp = getOpportunity(r);
      if (opp.id !== fopp) return false;
    }

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
  const isEn = getLang ? getLang() === 'en' : false;
  if (sort === 'score') {
    view.sort((a, b) => (getOpportunity(b).score || 0) - (getOpportunity(a).score || 0));
  } else if (sort === 'opp') {
    view.sort((a, b) => {
      const la = isEn ? (getOpportunity(a).labelEn || getOpportunity(a).label) : getOpportunity(a).label;
      const lb = isEn ? (getOpportunity(b).labelEn || getOpportunity(b).label) : getOpportunity(b).label;
      return la.localeCompare(lb, isEn ? 'en' : 'id');
    });
  } else if (sort === 'name') {
    view.sort((a, b) => (a.name || '').localeCompare(b.name || '', isEn ? 'en' : 'id'));
  } else if (sort === 'rating') {
    view.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'reviews') {
    view.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  } else if (sort === 'category') {
    view.sort((a, b) => (a.category || '').localeCompare(b.category || '', isEn ? 'en' : 'id'));
  }

  $('reset').hidden = !filtersActive();

  const maxPage = Math.max(1, Math.ceil(view.length / perPage));
  if (page > maxPage) page = maxPage;
}

function pageRows() {
  const start = (page - 1) * perPage;
  return view.slice(start, start + perPage);
}

/* ── DOM HELPERS ─────────────────────────────────────────────── */

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
  const isEn = getLang ? getLang() === 'en' : false;
  const label = row.enrichedAt ? (isEn ? 'no website' : 'tidak punya') : (isEn ? 'not checked' : 'belum ada');
  return tag(label, row.enrichedAt ? 'dim' : 'none');
}

function emailCell(r) {
  const container = document.createElement('div');
  const isEn = getLang ? getLang() === 'en' : false;
  if (has(r.email)) {
    const a = link('mailto:' + r.email, r.email);
    if (has(r.emailsAll)) a.title = r.emailsAll;
    container.appendChild(a);
  } else if (!has(r.website)) {
    container.appendChild(tag(isEn ? 'no site' : 'tanpa web', 'dim'));
  } else {
    const label = r.emailCheckedAt ? (isEn ? 'none' : 'tidak ada') : (isEn ? 'pending' : 'belum dicek');
    container.appendChild(tag(label, r.emailCheckedAt ? 'dim' : 'none'));
  }
  return container;
}

function statusSelect(r) {
  const sel = document.createElement('select');
  sel.className = 'stsel st-' + (r.status || 'none');
  sel.setAttribute('aria-label', `Status ${r.name || ''}`);
  
  const isEn = getLang ? getLang() === 'en' : false;
  const statusLabels = {
    '': '—',
    'baru': isEn ? 'New Lead' : 'Baru',
    'dihubungi': isEn ? 'Contacted' : 'Dihubungi',
    'followup': 'Follow-up',
    'deal': isEn ? 'Closed Deal' : 'Deal',
    'tolak': isEn ? 'Not Interested' : 'Tidak tertarik',
  };

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

function delButton(r) {
  const b = document.createElement('button');
  b.className = 'rowdel';
  b.textContent = '×';
  b.title = getLang && getLang() === 'en' ? 'Delete this row' : 'Hapus baris ini';
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
  const isEn = getLang ? getLang() === 'en' : false;
  return isEn ? String(r.rating) : String(r.rating).replace('.', ',');
}

/* ── SKELETON LOADING ────────────────────────────────────────── */

function renderSkeleton() {
  const tb = $('tbody');
  if (!tb) return;
  tb.textContent = '';
  for (let i = 0; i < 6; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skel';
    const W = [15, 60, 65, 45, 30, 85, 55, 50, 60, 40, 55, 15];
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

/* ── TABLE RENDERER ──────────────────────────────────────────── */

function renderTable(list) {
  const tb = $('tbody');
  tb.textContent = '';
  const frag = document.createDocumentFragment();
  const isEn = getLang ? getLang() === 'en' : false;

  for (const r of list) {
    const k = keyOf(r);
    const tr = document.createElement('tr');
    const cls = [];
    if (!has(r.website)) cls.push('nosite');
    if (state.activeKey && state.activeKey === k) cls.push('active');
    if (!firstLoad && !seenKeys.has(k)) cls.push('enter');
    tr.className = cls.join(' ');

    // Checkbox
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

    // Opportunity Pill
    const tdOpp = document.createElement('td');
    const opp = getOpportunity(r);
    const oppPill = document.createElement('span');
    oppPill.className = `opp-pill ${opp.cls}`;
    const oppShort = isEn ? (opp.shortLabelEn || opp.shortLabel) : opp.shortLabel;
    const oppDesc = isEn ? (opp.descEn || opp.desc) : opp.desc;
    oppPill.title = `${oppDesc} · Lead Score: ${opp.score}/100`;
    oppPill.innerHTML = `<span>${opp.icon}</span> <span>${oppShort}</span> <span class="score-chip">${opp.score}</span>`;
    tdOpp.appendChild(oppPill);
    tr.appendChild(tdOpp);

    // Name
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
      if (e.target.tagName !== 'A' && openDrawer) openDrawer(r);
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
    if (r.hours) tdNote.title = (isEn ? 'Opening Hours: ' : 'Jam buka: ') + r.hours;
    tr.appendChild(tdNote);

    const tdAct = document.createElement('td');
    tdAct.appendChild(delButton(r));
    tr.appendChild(tdAct);

    frag.appendChild(tr);
  }
  tb.appendChild(frag);

  const currentKeys = list.map(keyOf);
  const allSelected = currentKeys.length > 0 && currentKeys.every((k) => selectedKeys.has(k));
  $('selectAll').checked = allSelected;
}

/* ── CARD RENDERER ───────────────────────────────────────────── */

function renderCards(list) {
  const wrap = $('cardWrap');
  wrap.textContent = '';
  const frag = document.createDocumentFragment();
  const isEn = getLang ? getLang() === 'en' : false;

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

    const opp = getOpportunity(r);
    const oppLabel = isEn ? (opp.labelEn || opp.label) : opp.label;
    const oppDesc = isEn ? (opp.descEn || opp.desc) : opp.desc;
    const oppRow = document.createElement('div');
    oppRow.className = 'card-opp-row';
    const oppPill = document.createElement('span');
    oppPill.className = `opp-pill ${opp.cls}`;
    oppPill.title = oppDesc;
    oppPill.innerHTML = `<span>${opp.icon}</span> <span>${oppLabel}</span>`;
    oppRow.appendChild(oppPill);

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'score-chip';
    scoreSpan.textContent = `${isEn ? 'Score' : 'Skor'} ${opp.score}`;
    oppRow.appendChild(scoreSpan);
    card.appendChild(oppRow);

    const h3 = document.createElement('h3');
    h3.appendChild(r.url ? link(r.url, r.name || '(tanpa nama)') : document.createTextNode(r.name || '(tanpa nama)'));
    h3.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A' && openDrawer) openDrawer(r);
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
        rv.textContent = `${r.reviews} ${isEn ? 'reviews' : 'ulasan'}`;
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
    for (const [label, val, kind] of [
      [isEn ? 'Phone' : 'Telepon', r.phone, 'phone'],
      [isEn ? 'Website' : 'Website', r.website, 'site']
    ]) {
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
      b.textContent = isEn ? 'Hours' : 'Jam';
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

/* ── BATCH ACTIONS ───────────────────────────────────────────── */

function updateBatchBar() {
  const count = selectedKeys.size;
  $('batchBar').hidden = count === 0;
  const isEn = getLang ? getLang() === 'en' : false;
  $('batchCount').textContent = `${count} ${isEn ? 'selected' : 'terpilih'}`;
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
  const isEn = getLang ? getLang() === 'en' : false;
  showToast(isEn ? `Status updated for ${selectedKeys.size} leads` : `Status ${selectedKeys.size} baris berhasil diperbarui`, 'success');
  $('batchStatusSel').value = '';
  selectedKeys.clear();
  ver = -1;
  lastSig = '';
  refresh();
});

$('batchDelete').addEventListener('click', async () => {
  if (!selectedKeys.size) return;
  const isEn = getLang ? getLang() === 'en' : false;
  if (!confirm(isEn ? `Delete ${selectedKeys.size} selected leads?` : `Hapus ${selectedKeys.size} baris terpilih?`)) return;
  await send({ type: 'BATCH_DELETE', keys: [...selectedKeys] });
  showToast(isEn ? `${selectedKeys.size} leads deleted` : `${selectedKeys.size} baris dihapus`, 'info');
  selectedKeys.clear();
  ver = -1;
  lastSig = '';
  refresh();
});

$('batchExport').addEventListener('click', () => {
  const selectedRows = view.filter((r) => selectedKeys.has(keyOf(r)));
  if (!selectedRows.length) return;
  downloadCSV(selectedRows);
  const isEn = getLang ? getLang() === 'en' : false;
  showToast(isEn ? `${selectedRows.length} selected leads exported to CSV` : `${selectedRows.length} tempat terpilih diekspor ke CSV`, 'success');
});

/* ── PAGINATION & DRAW ───────────────────────────────────────── */

function renderPager() {
  const total = view.length;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  $('pager').hidden = total === 0;
  if (!total) return;

  const isEn = getLang ? getLang() === 'en' : false;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  $('pInfo').textContent = `${from}–${to} ${isEn ? 'of' : 'dari'} ${total}  ·  ${isEn ? 'page' : 'hal'} ${page}/${maxPage}`;

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
  if ($('tableWrap')) $('tableWrap').scrollTo({ top: 0, behavior: 'smooth' });
  if ($('cardWrap')) $('cardWrap').scrollTo({ top: 0, behavior: 'smooth' });
}

function draw() {
  const list = pageRows();
  const currentLang = getLang ? getLang() : 'id';
  const isEn = currentLang === 'en';

  const sig = JSON.stringify([
    mode, page, perPage, view.length, rows.length, state.activeKey, [...selectedKeys], currentLang,
    list.map((r) => [keyOf(r), r.phone || '', r.website || '', r.email || '',
                     r.status || '', r.note || '', r.enrichedAt || 0, r.emailCheckedAt || 0]),
  ]);
  if (sig === lastSig) return;
  lastSig = sig;

  const empty = view.length === 0;
  $('empty').hidden = !empty;
  if (empty) {
    $('emptyText').textContent = rows.length
      ? (isEn ? 'No leads match the current filters or search query.' : 'Tidak ada baris yang cocok dengan filter atau kata kunci pencarian.')
      : (isEn ? 'No leads yet. Open Google Maps, search for leads, and click Start in popup or Import CSV/JSON.' : 'Belum ada data. Buka Google Maps, cari sesuatu, lalu klik Mulai di popup extension atau Impor file CSV/JSON.');
  }
  $('tableWrap').hidden = mode !== 'table' || empty;
  $('cardWrap').hidden = mode !== 'card' || empty;

  if (!empty) {
    if (mode === 'table') renderTable(list);
    else renderCards(list);
  }
  renderPager();

  $('shown').textContent = view.length === rows.length
    ? `${rows.length} ${isEn ? 'leads' : 'tempat'}`
    : `${view.length} ${isEn ? 'of' : 'dari'} ${rows.length}`;

  for (const r of list) seenKeys.add(keyOf(r));
  if (renderAnalytics) renderAnalytics(rows, currentLang);
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

/* ── STATS & PROGRESS ────────────────────────────────────────── */

function renderStats() {
  const withSite = rows.filter((r) => has(r.website)).length;
  $('sTotal').textContent = rows.length;
  $('sWebPitch').textContent = rows.filter((r) => getOpportunity(r).id === 'web-pitch').length;
  $('sReady').textContent = rows.filter((r) => getOpportunity(r).id === 'outreach-ready').length;
  $('sPhone').textContent = rows.filter((r) => has(r.phone)).length;
  $('sSite').textContent = withSite;
  $('sEmail').textContent = rows.filter((r) => has(r.email)).length;
  $('sSocial').textContent = rows.filter((r) => Array.isArray(r.socials) && r.socials.length > 0).length;
  $('sIncomplete').textContent = rows.filter(needsEnrich).length;
}

function renderSessions() {
  const sel = $('session');
  const prev = sel.value;
  sel.textContent = '';
  const isEn = getLang ? getLang() === 'en' : false;

  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = `${isEn ? 'All sessions' : 'Semua sesi'} (${rows.length})`;
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
  const isEn = getLang ? getLang() === 'en' : false;
  $('statusChip').textContent = state.status || 'idle';
  $('statusChip').className = 'chip ' + (state.status || 'idle');
  $('live').hidden = !running;

  const pending = rows.filter(needsEmail).length;
  $('emails').disabled = running || pending === 0;
  $('emails').textContent = pending ? (isEn ? `Find Email (${pending})` : `Cari email (${pending})`) : (isEn ? 'Find Email & Socials' : 'Cari email & sosial');

  const incomplete = rows.filter(needsEnrich).length;
  $('enrich').disabled = running || incomplete === 0;
  $('enrich').textContent = incomplete ? (isEn ? `Enrich Contacts (${incomplete})` : `Lengkapi kontak (${incomplete})`) : (isEn ? 'Enrich Contacts' : 'Lengkapi kontak');
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
    $('runPct').textContent = `${state.collected || 0} ${isEn ? 'collected' : 'terkumpul'}`;
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

/* ── DATA REFRESH ────────────────────────────────────────────── */

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
    if (updateFilterOptionTexts) updateFilterOptionTexts(rows.length);
  }

  draw();
  renderRun();

  if (firstLoad) {
    firstLoad = false;
    for (const r of rows) seenKeys.add(keyOf(r));
  }
}

/* ── SORTABLE TABLE HEADERS ──────────────────────────────────── */

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

/* ── BACKUP DATABASE ACTION ──────────────────────────────────── */

$('btnBackup').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  const res = await send({ type: 'GET_BACKUP' });
  if (res && res.ok) {
    downloadBackup(res.rows, res.sessions);
    showToast(isEn ? `Database backup (${res.rows.length} leads) downloaded!` : `File backup database (${res.rows.length} tempat) berhasil diunduh!`, 'success');
  } else {
    showToast((isEn ? 'Backup failed: ' : 'Gagal membuat backup: ') + (res ? res.error : 'tanpa respons'), 'error');
  }
});

/* ── FILTER & SORT EVENT LISTENERS ───────────────────────────── */

for (const id of ['q', 'session', 'fOpp', 'fWebsite', 'fPhone', 'fStatus', 'fEmail', 'fSocial', 'fRating', 'sort']) {
  $(id).addEventListener('input', () => {
    page = 1;
    lastSig = '';
    applyFilters();
    draw();
  });
}

$('reset').addEventListener('click', () => {
  $('q').value = '';
  for (const id of ['session', 'fOpp', 'fWebsite', 'fPhone', 'fStatus', 'fEmail', 'fSocial', 'fRating']) $(id).value = 'all';
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
  if (e.key === 'Escape') {
    if (closeDrawer) closeDrawer();
  }
});

/* ── CRAWLER ACTIONS ─────────────────────────────────────────── */

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
  const isEn = getLang ? getLang() === 'en' : false;
  const granted = await chrome.permissions.request({ origins: ['*://*/*'] });
  if (!granted) {
    showToast(isEn ? 'Website access denied. Email search cancelled.' : 'Izin akses website belum diberikan. Pencarian email dibatalkan.', 'error');
    return;
  }
  const res = await send({ type: 'FIND_EMAILS' });
  if (!res.ok) {
    showToast((isEn ? 'Failed to start email search: ' : 'Gagal memulai pencarian email: ') + res.error, 'error');
  }
  refresh();
});

$('stop').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  await send({ type: 'STOP' });
  showToast(isEn ? 'Crawl stopped.' : 'Crawl dihentikan.', 'info');
  refresh();
});

$('clear').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  const confirmMsg = isEn
    ? `Delete all ${rows.length} leads and session history? This cannot be undone.`
    : `Hapus semua ${rows.length} baris dan seluruh riwayat sesi? Tindakan ini tidak bisa dibatalkan.`;
  if (!confirm(confirmMsg)) return;
  await send({ type: 'CLEAR' });
  showToast(isEn ? 'All data cleared successfully.' : 'Seluruh data berhasil dibersihkan.', 'info');
  ver = -1;
  page = 1;
  seenKeys = new Set();
  selectedKeys = new Set();
  lastSig = '';
  refresh();
});

$('dedupe').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  const res = await send({ type: 'DEDUPLICATE' });
  if (res.ok) {
    showToast(
      isEn
        ? `Cleanup finished: merged ${res.removed} duplicates. ${res.count} leads remaining.`
        : `Pembersihan selesai: ${res.removed} duplikat digabung. Sisa ${res.count} tempat.`,
      'success'
    );
    ver = -1;
    lastSig = '';
    refresh();
  }
});

// Exports & Clipboard actions
$('csv').addEventListener('click', () => {
  downloadCSV(view);
  const isEn = getLang ? getLang() === 'en' : false;
  showToast(isEn ? `${view.length} leads exported to CSV` : `${view.length} baris diekspor ke CSV`, 'success');
});
$('excel').addEventListener('click', () => {
  downloadExcel(view);
  const isEn = getLang ? getLang() === 'en' : false;
  showToast(isEn ? `${view.length} leads exported to Excel (.xls)` : `${view.length} baris diekspor ke Excel (.xls)`, 'success');
});
$('json').addEventListener('click', () => {
  downloadJSON(view);
  const isEn = getLang ? getLang() === 'en' : false;
  showToast(isEn ? `${view.length} leads exported to JSON` : `${view.length} baris diekspor ke JSON`, 'success');
});
$('copy').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  try {
    await navigator.clipboard.writeText(toTSV(view));
    showToast(isEn ? `${view.length} leads copied to clipboard!` : `${view.length} baris disalin ke clipboard!`, 'success');
  } catch (_) {}
});
$('copyEmails').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  const list = extractEmailList(view);
  if (!list) return showToast(isEn ? 'No emails found to copy in this filter.' : 'Tidak ada email untuk disalin pada filter ini.', 'error');
  await navigator.clipboard.writeText(list);
  showToast(isEn ? 'Email list copied to clipboard!' : 'Daftar email berhasil disalin ke clipboard!', 'success');
});
$('copyPhones').addEventListener('click', async () => {
  const isEn = getLang ? getLang() === 'en' : false;
  const list = extractPhoneList(view);
  if (!list) return showToast(isEn ? 'No phone numbers found to copy in this filter.' : 'Tidak ada nomor telepon untuk disalin pada filter ini.', 'error');
  await navigator.clipboard.writeText(list);
  showToast(isEn ? 'Phone list copied to clipboard!' : 'Daftar nomor telepon berhasil disalin ke clipboard!', 'success');
});

/* ── INITIALIZATION ──────────────────────────────────────────── */

if (initDrawer) {
  initDrawer({
    onSaveField: async (key, field, value) => {
      await send({ type: 'SET_FIELD', key, field, value });
      ver = -1;
      lastSig = '';
    },
    getLang: () => (getLang ? getLang() : 'id'),
  });
}

if (initImportModal) {
  initImportModal({
    send,
    showToast,
    getLang: () => (getLang ? getLang() : 'id'),
    onRefresh: (resetPage = false) => {
      ver = -1;
      if (resetPage) {
        page = 1;
        selectedKeys.clear();
      }
      lastSig = '';
      refresh();
    },
  });
}

if (initAnalyticsToggle) {
  initAnalyticsToggle(() => {
    if (renderAnalytics) renderAnalytics(rows, getLang ? getLang() : 'id');
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'STATE') refresh();
});

setInterval(() => {
  if (RUNNING.includes(state.status)) refresh();
}, 700);
setInterval(refresh, 2500);

renderSkeleton();
loadPrefs().then(refresh);
