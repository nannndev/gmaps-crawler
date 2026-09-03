/* Maps Directory Crawler — service worker
 * Pemilik seluruh state crawl. Popup hanya menampilkan; content script hanya membaca DOM.
 * State disimpan di chrome.storage.local supaya selamat saat service worker di-suspend.
 */

const STATE_KEY = 'mdc_state';
const ROWS_KEY = 'mdc_rows';
const SESSIONS_KEY = 'mdc_sessions';
const VER_KEY = 'mdc_rows_ver';

const DEFAULT_STATE = {
  status: 'idle', // idle | collecting | detailing | enriching | emailing | done | error | stopped
  tabId: null,
  phase: '',
  collected: 0,
  detailIndex: 0,
  detailTotal: 0,
  errors: [],
  startedAt: null,
  finishedAt: null,
  message: '',
  sessionId: null,
  activeKey: null,
  options: { maxResults: 120, withDetail: true, detailDelayMs: 1200 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RUNNING_STATES = ['collecting', 'detailing', 'enriching', 'emailing'];

async function getState() {
  const o = await chrome.storage.local.get(STATE_KEY);
  return { ...DEFAULT_STATE, ...(o[STATE_KEY] || {}) };
}

async function setState(patch) {
  const next = { ...(await getState()), ...patch };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  try {
    const r = chrome.runtime.sendMessage({ type: 'STATE', state: next });
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (_) { /* popup tertutup */ }
  return next;
}

async function getRows() {
  const o = await chrome.storage.local.get(ROWS_KEY);
  return o[ROWS_KEY] || [];
}

async function setRows(rows) {
  // Versi dinaikkan tiap tulis agar dashboard bisa melewati transfer yang
  // tidak perlu — pada dataset besar ini beda antara mulus dan tersendat.
  const o = await chrome.storage.local.get(VER_KEY);
  await chrome.storage.local.set({
    [ROWS_KEY]: rows,
    [VER_KEY]: ((o[VER_KEY] || 0) + 1),
  });
}

async function getVer() {
  const o = await chrome.storage.local.get(VER_KEY);
  return o[VER_KEY] || 0;
}

const filled = (v) => v != null && String(v).trim() !== '';

async function getSessions() {
  const o = await chrome.storage.local.get(SESSIONS_KEY);
  return o[SESSIONS_KEY] || [];
}

async function setSessions(list) {
  await chrome.storage.local.set({ [SESSIONS_KEY]: list });
}

/** Ambil kata kunci pencarian dari URL Maps untuk dipakai sebagai label sesi. */
function labelFromUrl(url) {
  const m = /\/maps\/search\/([^/@?]+)/.exec(url || '');
  if (!m) return 'Crawl';
  try {
    return decodeURIComponent(m[1]).replace(/\+/g, ' ').trim() || 'Crawl';
  } catch (_) {
    return 'Crawl';
  }
}

async function newSession(label) {
  // startedAt dipakai sebagai id: unik per crawl dan langsung terurut waktu.
  const id = 's' + Date.now();
  const list = await getSessions();
  list.push({ id, label, startedAt: Date.now(), count: 0 });
  await setSessions(list);
  return id;
}

async function touchSession(id, count) {
  const list = await getSessions();
  const s = list.find((x) => x.id === id);
  if (s) {
    s.count = count;
    s.finishedAt = Date.now();
    await setSessions(list);
  }
}

/** Gabungkan hasil baru ke data lama berdasarkan key; jangan pernah menimpa
 *  nilai terisi dengan nilai kosong. Ini yang membuat data tidak hilang
 *  saat crawl dijalankan berulang kali di pencarian berbeda. */
function mergeRows(existing, incoming, sessionId) {
  const byKey = new Map();
  const order = [];
  for (const r of existing) {
    const k = r.key || r.url;
    if (!k) continue;
    byKey.set(k, r);
    order.push(k);
  }
  let added = 0;
  for (const r of incoming) {
    const k = r.key || r.url;
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev) {
      const now = Date.now();
      const iso = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
      const fresh = {
        ...r,
        savedAt: r.savedAt || now,
        scrapedAt: r.scrapedAt || iso,
      };
      fresh.sessions = sessionId ? [sessionId] : r.sessions || [];
      byKey.set(k, fresh);
      order.push(k);
      added++;
      continue;
    }
    const merged = { ...prev };
    for (const [f, v] of Object.entries(r)) {
      if (f !== 'sessions' && filled(v)) merged[f] = v;
    }
    // Anotasi manual selalu menang atas data crawl.
    if (filled(prev.status)) merged.status = prev.status;
    if (filled(prev.note)) merged.note = prev.note;
    if (Array.isArray(prev.tags) && prev.tags.length) merged.tags = prev.tags;
    if (Array.isArray(prev.socials) || Array.isArray(r.socials)) {
      const sSet = new Set([...(prev.socials || []), ...(r.socials || [])]);
      merged.socials = [...sSet];
    }
    // Tempat yang sama bisa muncul di beberapa pencarian — catat semuanya,
    // tapi tetap satu baris supaya tidak ada duplikat saat menghubungi.
    const tags = new Set([...(prev.sessions || []), ...(r.sessions || [])]);
    if (sessionId) tags.add(sessionId);
    merged.sessions = [...tags];
    byKey.set(k, merged);
  }
  return { rows: order.map((k) => byKey.get(k)), added };
}

/** Hapus duplikat berdasarkan nomor telepon yang sama. */
async function deduplicateRows() {
  const rows = await getRows();
  const byPhone = new Map();
  const out = [];
  let deduplicatedCount = 0;

  for (const r of rows) {
    const rawPhone = (r.phone || '').replace(/[^\d]/g, '');
    if (rawPhone && rawPhone.length >= 7) {
      if (byPhone.has(rawPhone)) {
        const targetKey = byPhone.get(rawPhone);
        const targetIndex = out.findIndex((x) => (x.key || x.url) === targetKey);
        if (targetIndex >= 0) {
          const merged = mergeRows([out[targetIndex]], [r], null).rows[0];
          out[targetIndex] = merged;
          deduplicatedCount++;
          continue;
        }
      } else {
        byPhone.set(rawPhone, r.key || r.url);
      }
    }
    out.push(r);
  }
  await setRows(out);
  return { count: out.length, removed: deduplicatedCount };
}

// Sinyal berhenti dibaca dari storage, bukan variabel modul — service worker bisa
// mati di tengah crawl dan variabel apa pun ikut hilang.
async function isStopped() {
  return (await getState()).status === 'stopped';
}

/** Kirim pesan ke content script; suntikkan ulang kalau belum ada. */
async function tell(tabId, msg, { timeout = 60000 } = {}) {
  const send = () =>
    new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('timeout menunggu halaman merespons'));
        }
      }, timeout);
      chrome.tabs.sendMessage(tabId, msg, (res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(res);
      });
    });

  try {
    return await send();
  } catch (e) {
    // Tab baru dinavigasi / content script belum jalan -> suntik lalu ulangi sekali.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await sleep(400);
    return await send();
  }
}

function isMapsUrl(url) {
  return /^https?:\/\/(www\.google\.[a-z.]+|maps\.google\.[a-z.]+)\/maps\//.test(url || '');
}

/** Tunggu tab selesai memuat URL baru. */
function waitForTabLoad(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeout);
  });
}

async function runCrawl(tabId, options, sessionId) {
  await setState({
    status: 'collecting',
    tabId,
    phase: 'collect',
    collected: 0,
    detailIndex: 0,
    detailTotal: 0,
    errors: [],
    startedAt: Date.now(),
    finishedAt: null,
    message: 'Mengumpulkan daftar hasil…',
    sessionId,
    options,
  });
  // Data lama sengaja TIDAK dihapus — hasil crawl baru digabung ke dalamnya.

  // --- fase 1: kumpulkan card dari feed ---
  const res = await tell(tabId, { type: 'COLLECT', options }, { timeout: 180000 });
  if (!res || !res.ok) throw new Error((res && res.error) || 'Gagal mengumpulkan daftar');

  let rows = res.data || [];
  // Dedup lintas-scroll: card yang sama bisa terbaca dua kali saat feed re-render.
  const seen = new Set();
  rows = rows.filter((r) => {
    const k = r.key || r.url;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Gabungkan ke koleksi tersimpan, lalu kerjakan hanya baris hasil crawl ini.
  const store = await getRows();
  const { rows: allRows, added } = mergeRows(store, rows, sessionId);
  await setRows(allRows);
  await touchSession(sessionId, rows.length);

  const keys = new Set(rows.map((r) => r.key || r.url));
  rows = allRows.filter((r) => keys.has(r.key || r.url));

  await setState({
    collected: rows.length,
    message: `${rows.length} tempat terkumpul (${added} baru, total ${allRows.length}).`,
  });

  if (await isStopped()) return finishMerged('stopped');
  if (!options.withDetail || rows.length === 0) return finishMerged('done');

  // --- fase 2: buka tiap tempat untuk data kontak ---
  await setState({
    status: 'detailing',
    phase: 'detail',
    detailTotal: rows.length,
    message: 'Mengambil detail kontak…',
  });

  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    if (await isStopped()) return finishMerged('stopped');

    const row = rows[i];
    await setState({
      detailIndex: i + 1,
      activeKey: row.key || row.url,
      message: `Detail ${i + 1}/${rows.length}: ${row.name || '(tanpa nama)'}`,
    });

    let d = null;
    try {
      // 1. Coba klik in-page langsung pada panel list tanpa reload tab (super cepat & tanpa refresh)
      d = await tell(
        tabId,
        {
          type: 'CLICK_AND_SCRAPE_DETAIL',
          key: row.key || row.url,
          url: row.url,
          name: row.name,
        },
        { timeout: 15000 }
      );

      // 2. Jika kartu tidak ditemukan di feed (misal feed tertutup), fallback buka URL
      if (!d || !d.ok || !d.data) {
        if (d && d.notFoundInFeed) {
          await chrome.tabs.update(tabId, { url: row.url });
          await waitForTabLoad(tabId);
          await sleep(options.detailDelayMs || 800);
          d = await tell(tabId, { type: 'SCRAPE_DETAIL' }, { timeout: 30000 });
        }
      }

      if (d && d.ok && d.data) {
        // Data detail lebih tepercaya daripada hasil parsing card, tapi jangan
        // menimpa nilai yang sudah ada dengan string kosong.
        for (const [k, v] of Object.entries(d.data)) {
          if (v !== '' && v != null) rows[i][k] = v;
        }
      } else {
        errors.push(`${row.name || row.url}: ${(d && d.error) || 'tanpa data'}`);
      }
    } catch (e) {
      errors.push(`${row.name || row.url}: ${String((e && e.message) || e)}`);
    }

    // Simpan tiap baris: kalau crawl mati di tengah, hasil sejauh ini tetap ada.
    await persistRow(rows[i]);
    if (errors.length) await setState({ errors: errors.slice(-25) });

    // Jeda dinamis: in-page click cukup jeda singkat (400-600ms)
    const baseDelay = d && d.inPage ? Math.min(options.detailDelayMs || 500, 600) : (options.detailDelayMs || 1200);
    await sleep(baseDelay + Math.random() * 250);
  }

  return finishMerged('done');
}

/** Tulis satu baris kembali ke koleksi tersimpan. */
async function persistRow(row) {
  const store = await getRows();
  const { rows } = mergeRows(store, [row], null);
  await setRows(rows);
}

async function finishMerged(status) {
  const rows = await getRows();
  const msg =
    status === 'stopped'
      ? `Dihentikan. ${rows.length} tempat tersimpan.`
      : `Selesai. ${rows.length} tempat tersimpan.`;
  await setState({ status, finishedAt: Date.now(), activeKey: null, message: msg });
  return rows;
}


/** Buka ulang tempat yang telepon/website-nya masih kosong dan lengkapi.
 *  Tidak mengulang crawl daftar — langsung ke halaman tiap tempat. */
async function runEnrich(tabId, options) {
  const all = await getRows();
  const targets = all.filter((r) => (!filled(r.phone) || !filled(r.website)) && r.url);

  if (!targets.length) {
    return setState({ status: 'done', message: 'Semua baris sudah lengkap.' });
  }

  await setState({
    status: 'enriching',
    tabId,
    phase: 'enrich',
    detailIndex: 0,
    detailTotal: targets.length,
    errors: [],
    startedAt: Date.now(),
    finishedAt: null,
    message: `Melengkapi ${targets.length} tempat…`,
    options,
  });

  const errors = [];
  for (let i = 0; i < targets.length; i++) {
    if (await isStopped()) return finishMerged('stopped');

    const row = targets[i];
    await setState({
      detailIndex: i + 1,
      activeKey: row.key || row.url,
      message: `Lengkapi ${i + 1}/${targets.length}: ${row.name || '(tanpa nama)'}`,
    });

    try {
      await chrome.tabs.update(tabId, { url: row.url });
      await waitForTabLoad(tabId);
      await sleep(options.detailDelayMs || 1200);

      const d = await tell(tabId, { type: 'SCRAPE_DETAIL' }, { timeout: 40000 });
      if (d && d.ok && d.data) {
        const patch = { ...row };
        for (const [k, v] of Object.entries(d.data)) {
          if (filled(v)) patch[k] = v;
        }
        // Tandai sudah diperiksa, supaya tempat yang memang tak punya website
        // tidak ikut lagi di putaran enrich berikutnya.
        patch.enrichedAt = Date.now();
        await persistRow(patch);
      } else {
        errors.push(`${row.name || row.url}: ${(d && d.error) || 'tanpa data'}`);
      }
    } catch (e) {
      errors.push(`${row.name || row.url}: ${String((e && e.message) || e)}`);
    }

    if (errors.length) await setState({ errors: errors.slice(-25) });
    await sleep((options.detailDelayMs || 1200) + Math.random() * 700);
  }

  return finishMerged('done');
}

/* ── pencarian email di website tempat ─────────────────────────── */

const EMAIL_PAGES = ['', '/contact', '/kontak', '/contact-us', '/about', '/tentang'];

/** Jalankan email.js di sebuah URL memakai tab tersembunyi milik kita sendiri. */
async function emailsFrom(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  await waitForTabLoad(tabId, 15000);
  await sleep(700);
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['email.js'],
  });
  const val = (res && res.result) || [];
  if (Array.isArray(val)) return { emails: val, socials: [] };
  return { emails: val.emails || [], socials: val.socials || [] };
}

async function runEmails(options) {
  const all = await getRows();
  // Hanya baris yang punya website tapi belum punya email.
  const targets = all.filter((r) => filled(r.website) && !filled(r.email) && !r.emailCheckedAt);

  if (!targets.length) {
    return setState({ status: 'done', message: 'Tidak ada website baru untuk dicek.' });
  }

  // Izin domain diminta dari popup/dashboard (butuh user gesture).
  const okPerm = await chrome.permissions.contains({ origins: ['*://*/*'] });
  if (!okPerm) throw new Error('Izin akses website belum diberikan.');

  // Pakai tab terpisah supaya tab Maps milik user tidak diganggu.
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false });

  await setState({
    status: 'emailing',
    tabId: tab.id,
    phase: 'email',
    detailIndex: 0,
    detailTotal: targets.length,
    errors: [],
    startedAt: Date.now(),
    finishedAt: null,
    message: `Mencari email & sosial di ${targets.length} website…`,
    options,
  });

  const errors = [];
  try {
    for (let i = 0; i < targets.length; i++) {
      if (await isStopped()) break;

      const row = targets[i];
      await setState({
        detailIndex: i + 1,
        activeKey: row.key || row.url,
        message: `Email & Sosial ${i + 1}/${targets.length}: ${row.name || row.website}`,
      });

      let emails = [];
      let socials = [];
      try {
        const base = new URL(row.website);
        for (const path of EMAIL_PAGES) {
          if (await isStopped()) break;
          try {
            const found = await emailsFrom(tab.id, new URL(path || '/', base).href);
            emails.push(...found.emails);
            socials.push(...found.socials);
            // Berhenti begitu ketemu — tidak perlu buka semua halaman.
            if (emails.length) break;
          } catch (_) { /* halaman ini tidak ada, coba berikutnya */ }
        }
      } catch (e) {
        errors.push(`${row.name || row.website}: ${String((e && e.message) || e)}`);
      }

      const uniqE = [...new Set(emails)];
      const uniqS = [...new Set([...(row.socials || []), ...socials])];
      await persistRow({
        ...row,
        email: uniqE[0] || row.email || '',
        emailsAll: uniqE.length > 1 ? uniqE.join(', ') : '',
        socials: uniqS,
        emailCheckedAt: Date.now(),
      });

      if (errors.length) await setState({ errors: errors.slice(-25) });
      await sleep(600 + Math.random() * 600);
    }
  } finally {
    // Tab kerja selalu ditutup, termasuk saat dihentikan atau error.
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }

  const st = await getState();
  return finishMerged(st.status === 'stopped' ? 'stopped' : 'done');
}

async function startEmails(options) {
  const st = await getState();
  if (RUNNING_STATES.includes(st.status)) throw new Error('Proses sedang berjalan.');
  runEmails(options).catch(async (e) => {
    await setState({ status: 'error', finishedAt: Date.now(), message: String((e && e.message) || e) });
  });
  return { ok: true };
}

async function activeMapsTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isMapsUrl(tab.url)) {
    throw new Error('Buka dulu hasil pencarian Google Maps di tab aktif.');
  }
  return tab;
}

async function startEnrich(options) {
  const st = await getState();
  if (RUNNING_STATES.includes(st.status)) {
    throw new Error('Proses sedang berjalan.');
  }
  const tab = await activeMapsTab();
  runEnrich(tab.id, options).catch(async (e) => {
    await setState({ status: 'error', finishedAt: Date.now(), message: String((e && e.message) || e) });
  });
  return { ok: true };
}

async function start(options) {
  const st = await getState();
  if (RUNNING_STATES.includes(st.status)) {
    throw new Error('Proses sedang berjalan.');
  }

  const tab = await activeMapsTab();
  const sessionId = await newSession(labelFromUrl(tab.url));

  runCrawl(tab.id, options, sessionId).catch(async (e) => {
    await setState({
      status: 'error',
      finishedAt: Date.now(),
      message: String((e && e.message) || e),
    });
  });

  return { ok: true };
}

async function stop() {
  const st = await getState();
  await setState({ status: 'stopped', message: 'Menghentikan…' });
  if (st.tabId) {
    try {
      await chrome.tabs.sendMessage(st.tabId, { type: 'ABORT' });
    } catch (_) { /* tab sudah tertutup */ }
  }
  return { ok: true };
}

async function postToWebhook(url) {
  const rows = await getRows();
  if (!rows.length) throw new Error('Belum ada data untuk dikirim.');
  if (!/^https:\/\//i.test(url)) throw new Error('Webhook harus memakai HTTPS.');

  // Izin origin diminta dari popup (butuh user gesture); di sini tinggal verifikasi.
  const ok = await chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] });
  if (!ok) throw new Error('Izin ke domain webhook belum diberikan.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'gmaps-crawler', count: rows.length, rows }),
  });
  if (!res.ok) throw new Error(`Webhook menjawab HTTP ${res.status}`);
  return { ok: true, count: rows.length };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg && msg.type) {
        case 'START':
          return sendResponse(await start(msg.options || DEFAULT_STATE.options));
        case 'FIND_EMAILS':
          return sendResponse(await startEmails(msg.options || DEFAULT_STATE.options));
        case 'ENRICH':
          return sendResponse(await startEnrich(msg.options || DEFAULT_STATE.options));
        case 'SET_FIELD': {
          // Anotasi manual (status kontak, catatan). Disimpan di baris yang sama
          // supaya ikut terekspor dan tidak hilang saat crawl ulang.
          const rows = await getRows();
          const r = rows.find((x) => (x.key || x.url) === msg.key);
          if (!r) return sendResponse({ ok: false, error: 'baris tidak ditemukan' });
          if (msg.field === 'status') r.status = msg.value || '';
          else if (msg.field === 'note') r.note = msg.value || '';
          else if (msg.field === 'tags') r.tags = Array.isArray(msg.value) ? msg.value : [];
          else return sendResponse({ ok: false, error: 'field tidak dikenal' });
          r.touchedAt = Date.now();
          await setRows(rows);
          return sendResponse({ ok: true });
        }
        case 'BATCH_SET_STATUS': {
          const keys = new Set(msg.keys || []);
          const rows = await getRows();
          for (const r of rows) {
            if (keys.has(r.key || r.url)) {
              r.status = msg.status || '';
              r.touchedAt = Date.now();
            }
          }
          await setRows(rows);
          return sendResponse({ ok: true, updated: keys.size });
        }
        case 'BATCH_DELETE': {
          const keys = new Set(msg.keys || []);
          const rows = (await getRows()).filter((r) => !keys.has(r.key || r.url));
          await setRows(rows);
          return sendResponse({ ok: true, count: rows.length });
        }
        case 'DEDUPLICATE': {
          const res = await deduplicateRows();
          return sendResponse({ ok: true, count: res.count, removed: res.removed });
        }
        case 'DELETE_ROW': {
          const rows = (await getRows()).filter((r) => (r.key || r.url) !== msg.key);
          await setRows(rows);
          return sendResponse({ ok: true, count: rows.length });
        }
        case 'DELETE_SESSION': {
          const sid = msg.sessionId;
          await setSessions((await getSessions()).filter((x) => x.id !== sid));
          // Baris yang juga ditemukan sesi lain tetap disimpan, cukup lepas tagnya.
          const kept = [];
          for (const r of await getRows()) {
            const tags = (r.sessions || []).filter((t) => t !== sid);
            if (tags.length || !(r.sessions || []).length) kept.push({ ...r, sessions: tags });
          }
          await setRows(kept);
          return sendResponse({ ok: true, count: kept.length });
        }
        case 'OPEN_DASHBOARD':
          await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
          return sendResponse({ ok: true });
        case 'STOP':
          return sendResponse(await stop());
        case 'GET_STATE': {
          const ver = await getVer();
          const fresh = typeof msg.since === 'number' && msg.since === ver;
          return sendResponse({
            ok: true,
            state: await getState(),
            sessions: await getSessions(),
            ver,
            // rows dihilangkan kalau klien sudah punya versi terbaru.
            ...(fresh ? {} : { rows: await getRows() }),
          });
        }
        case 'CLEAR':
          await setRows([]);
          await setSessions([]);
          await setState({ ...DEFAULT_STATE, options: (await getState()).options });
          return sendResponse({ ok: true });
        case 'IMPORT_ROWS': {
          const importList = Array.isArray(msg.rows) ? msg.rows : [];
          if (!importList.length) return sendResponse({ ok: false, error: 'Tidak ada data valid untuk diimpor' });
          const sid = await newSession(msg.sessionLabel || 'Impor Data');
          const { rows: merged, added } = mergeRows(await getRows(), importList, sid);
          await setRows(merged);
          return sendResponse({ ok: true, count: merged.length, added, imported: importList.length });
        }
        case 'RESTORE_BACKUP': {
          const backupRows = Array.isArray(msg.rows) ? msg.rows : [];
          const backupSessions = Array.isArray(msg.sessions) ? msg.sessions : [];
          await setRows(backupRows);
          await setSessions(backupSessions);
          await setState({ ...DEFAULT_STATE, options: (await getState()).options });
          return sendResponse({ ok: true, rowsCount: backupRows.length, sessionsCount: backupSessions.length });
        }
        case 'GET_BACKUP': {
          return sendResponse({
            ok: true,
            version: '1.3.0',
            exportedAt: new Date().toISOString(),
            rows: await getRows(),
            sessions: await getSessions(),
          });
        }
        case 'WEBHOOK':
          return sendResponse(await postToWebhook(msg.url));
        case 'PROGRESS': {
          // Laporan langsung dari content script saat fase collect.
          const st = await getState();
          if (st.status === 'collecting') {
            // Simpan baris parsial agar dashboard menampilkannya sambil scroll
            // berjalan. Merge bersifat idempoten, jadi aman dipanggil berulang.
            if (Array.isArray(msg.rows) && msg.rows.length) {
              const { rows } = mergeRows(await getRows(), msg.rows, st.sessionId);
              await setRows(rows);
            }
            if (typeof msg.collected === 'number') {
              await setState({
                collected: msg.collected,
                message: `Mengumpulkan… ${msg.collected} tempat`,
              });
            }
          }
          return sendResponse({ ok: true });
        }
        default:
          return sendResponse({ ok: false, error: 'unknown message' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});
