/* Maps Directory Crawler — content script
 * Berjalan di halaman Google Maps. Dua tugas:
 *   COLLECT       -> scroll feed hasil pencarian, kumpulkan data dasar tiap card
 *   SCRAPE_DETAIL -> baca panel detail satu tempat (telepon, website, jam buka, dll)
 * Semua state orkestrasi ada di background.js; file ini stateless dan idempoten.
 */
(() => {
  if (window.__mdcInjected) return;
  window.__mdcInjected = true;

  let aborted = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();

  async function waitFor(fn, { timeout = 15000, interval = 200 } = {}) {
    const t0 = Date.now();
    for (;;) {
      try {
        const v = fn();
        if (v) return v;
      } catch (_) { /* selector belum ada, coba lagi */ }
      if (Date.now() - t0 > timeout) return null;
      await sleep(interval);
    }
  }

  // --- parsing helpers -----------------------------------------------------

  // Rating id-ID datang sebagai "4,5" — en-US sebagai "4.5".
  function num(s) {
    if (s == null) return null;
    const t = String(s).trim().replace(/ /g, ' ');
    const m = t.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    return parseFloat(m[0].replace(',', '.'));
  }

  // Jumlah review: "1.234" (id) / "1,234" (en) -> 1234
  function intFrom(s) {
    if (s == null) return null;
    const d = String(s).replace(/[^\d]/g, '');
    return d ? parseInt(d, 10) : null;
  }

  function latLngFrom(url) {
    // Koordinat tempat ada di token !3d<lat>!4d<lng>. /@lat,lng adalah pusat peta,
    // bukan tempatnya — hanya dipakai sebagai fallback terakhir.
    let m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url || '');
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url || '');
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return { lat: null, lng: null };
  }

  // Kunci dedup stabil: token !1s0x<hex>:0x<hex> adalah id tempat internal Maps.
  function keyFrom(url) {
    const m = /!1s([^!?]+)/.exec(url || '');
    if (m) return decodeURIComponent(m[1]);
    const p = /\/maps\/place\/([^/@]+)/.exec(url || '');
    return p ? decodeURIComponent(p[1]) : url || '';
  }

  function ariaValue(el) {
    // aria-label berbentuk "Telepon: 021-123" / "Address: Jl. X" -> ambil setelah ":"
    const l = (el && el.getAttribute('aria-label')) || '';
    const i = l.indexOf(':');
    return (i >= 0 ? l.slice(i + 1) : l).trim();
  }

  // --- COLLECT: card di daftar hasil ---------------------------------------

  function getFeed() {
    return document.querySelector('div[role="feed"]');
  }

  const STATUS_RE = /^(buka|tutup|open|closed|temporarily|permanently|sementara|permanen|24 jam|opens|closes|tutup sementara)/i;

  function cleanImageUrl(url) {
    if (!url || typeof url !== 'string' || url.startsWith('data:')) return '';
    return url.replace(/=(w\d+-h\d+|s\d+)[^=]*$/, '=w600-h400-k-no');
  }

  /* Class Google Maps sering berubah, jadi urutannya: selector terstruktur dulu,
   * lalu parsing innerText sebagai jaring pengaman. */
  function parseCard(a) {
    const card = a.closest('[jsaction]') || a.parentElement || a;
    const url = a.href;
    const name =
      a.getAttribute('aria-label') ||
      txt(card.querySelector('.qBF1Pd, .fontHeadlineSmall')) ||
      '';

    const row = { key: keyFrom(url), name, url, ...latLngFrom(url) };

    const imgEl = card.querySelector('img[src*="googleusercontent.com"], img[src*="streetviewpixels"], img[src*="ggpht.com"], img[src^="http"]');
    if (imgEl && imgEl.src && !imgEl.src.startsWith('data:')) {
      row.imageUrl = cleanImageUrl(imgEl.src);
    }

    // Rating + jumlah review
    const rEl = card.querySelector('span[role="img"][aria-label]');
    const rLabel = rEl ? rEl.getAttribute('aria-label') : '';
    if (/star|bintang/i.test(rLabel)) {
      const rm = rLabel.match(/([\d.,]+)\s*(?:star|bintang)/i);
      const cm = rLabel.match(/([\d.,]+)\s*(?:review|ulasan)/i);
      row.rating = rm ? num(rm[1]) : null;
      row.reviews = cm ? intFrom(cm[1]) : null;
    }

    const lines = (card.innerText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (row.rating == null) {
      // Bentuk gabungan pada card: "4,5(123)"
      for (const l of lines) {
        const m = l.match(/^([\d]+[.,][\d])\s*\(([\d.,]+)\)$/);
        if (m) {
          row.rating = num(m[1]);
          row.reviews = intFrom(m[2]);
          break;
        }
      }
    }

    // Baris "Kategori · Alamat" — ambil yang pertama dan bukan baris status jam.
    for (const l of lines) {
      if (l === name || STATUS_RE.test(l)) continue;
      if (l.includes('·')) {
        const parts = l.split('·').map((s) => s.trim()).filter(Boolean);
        if (!row.category) row.category = parts[0] || '';
        if (!row.address && parts.length > 1) row.address = parts.slice(1).join(' · ');
        if (row.address) break;
      }
    }
    row.category = row.category || '';
    row.address = row.address || '';
    return row;
  }

  function readCards() {
    const feed = getFeed();
    if (!feed) return [];
    const seen = new Set();
    const out = [];
    for (const a of feed.querySelectorAll('a[href*="/maps/place/"]')) {
      if (!a.href) continue;
      const k = keyFrom(a.href);
      if (seen.has(k)) continue;
      seen.add(k);
      try {
        out.push(parseCard(a));
      } catch (_) { /* satu card rusak tidak boleh menggagalkan panen */ }
    }
    return out;
  }

  function reachedEnd() {
    const feed = getFeed();
    const t = (feed && feed.innerText) || '';
    return /reached the end of the list|akhir dari daftar|telah mencapai akhir/i.test(t);
  }

  function progress(payload) {
    try {
      const r = chrome.runtime.sendMessage({ type: 'PROGRESS', ...payload });
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (_) { /* background sedang tidur, abaikan */ }
  }

  async function collect(options) {
    aborted = false;
    const max = Math.max(1, options.maxResults || 120);

    const feed = await waitFor(getFeed, { timeout: 20000 });
    if (!feed) {
      throw new Error(
        'Daftar hasil tidak ditemukan. Pastikan halaman menampilkan hasil pencarian (bukan satu tempat / peta kosong).'
      );
    }

    let stale = 0;
    let cards = readCards();
    let last = cards.length;
    // Kirim baris apa adanya tiap putaran supaya dashboard bisa menampilkannya
    // sambil scroll masih jalan, bukan menunggu seluruh fase selesai.
    progress({ phase: 'collect', collected: last, rows: cards.slice(0, max) });

    // Feed dimuat bertahap; berhenti kalau 4x scroll berturut-turut tidak menambah apa pun.
    while (!aborted && last < max && stale < 4) {
      feed.scrollTop = feed.scrollHeight;
      await sleep(900 + Math.random() * 500);
      cards = readCards();
      const n = cards.length;
      if (n > last) {
        stale = 0;
        last = n;
        progress({ phase: 'collect', collected: n, rows: cards.slice(0, max) });
      } else {
        stale++;
      }
      if (reachedEnd()) break;
    }

    return readCards().slice(0, max);
  }

  // --- SCRAPE_DETAIL: panel satu tempat ------------------------------------

  function detailPane() {
    return document.querySelector('div[role="main"][aria-label]') || document.body;
  }

  function extractHours(pane) {
    const rows = [];
    for (const tr of pane.querySelectorAll('table tr')) {
      const cells = [...tr.querySelectorAll('th,td')].map(txt).filter(Boolean);
      if (cells.length >= 2) rows.push(cells[0] + ': ' + cells[1]);
    }
    if (rows.length) return rows.join(' | ');
    const btn = pane.querySelector(
      '[data-item-id="oh"], button[aria-label*="Hours"], button[aria-label*="Jam buka"], button[aria-label*="jam buka"]'
    );
    return btn ? ariaValue(btn) : '';
  }

  function readDetail() {
    const pane = detailPane();
    const out = {};

    const h1 = pane.querySelector('h1');
    if (h1 && txt(h1)) out.name = txt(h1);

    const heroImg = pane.querySelector('button[jsaction*="heroHeader"] img, button[jsaction*="photo"] img, img[src*="googleusercontent.com"], img[src*="streetviewpixels"], img[src*="ggpht.com"]');
    if (heroImg && heroImg.src && !heroImg.src.startsWith('data:')) {
      out.imageUrl = cleanImageUrl(heroImg.src);
    }

    const addr = pane.querySelector('button[data-item-id="address"]');
    if (addr) out.address = ariaValue(addr);

    const phone = pane.querySelector('button[data-item-id^="phone"]');
    if (phone) out.phone = ariaValue(phone);

    const site = pane.querySelector('a[data-item-id="authority"]');
    if (site) out.website = site.href || ariaValue(site);

    const plus = pane.querySelector('button[data-item-id="oloc"]');
    if (plus) out.plusCode = ariaValue(plus);

    const cat = pane.querySelector('button[jsaction*="category"]');
    if (cat && txt(cat)) out.category = txt(cat);

    const rEl = pane.querySelector('span[role="img"][aria-label]');
    const rLabel = rEl ? rEl.getAttribute('aria-label') : '';
    if (/star|bintang/i.test(rLabel)) {
      const rm = rLabel.match(/([\d.,]+)\s*(?:star|bintang)/i);
      if (rm) out.rating = num(rm[1]);
    }
    const revBtn = pane.querySelector('button[jsaction*="reviewChart"], button[aria-label*="review"], button[aria-label*="ulasan"]');
    if (revBtn) {
      const n = intFrom(txt(revBtn) || revBtn.getAttribute('aria-label'));
      if (n) out.reviews = n;
    }

    const hours = extractHours(pane);
    if (hours) out.hours = hours;

    // URL final setelah load adalah sumber koordinat paling akurat.
    const ll = latLngFrom(location.href);
    if (ll.lat != null) {
      out.lat = ll.lat;
      out.lng = ll.lng;
    }
    return out;
  }

  async function scrapeDetailWhenReady() {
    // Panel siap kalau h1 sudah terisi DAN minimal satu baris info ter-render.
    const ok = await waitFor(
      () => {
        const pane = detailPane();
        const h1 = pane.querySelector('h1');
        return h1 && txt(h1) && pane.querySelector('[data-item-id]') ? true : null;
      },
      { timeout: 15000 }
    );

    if (!ok) {
      // Tetap coba baca — sebagian tempat memang minim data, jangan buang barisnya.
      const partial = readDetail();
      if (!partial.name) throw new Error('Panel detail tidak termuat');
      return partial;
    }

    let data = readDetail();
    if (!data.hours) {
      // Tabel jam buka sering baru dirender setelah tombolnya diklik.
      const btn = detailPane().querySelector(
        '[data-item-id="oh"], button[aria-label*="Jam buka"], button[aria-label*="Hours"]'
      );
      if (btn) {
        try {
          btn.click();
          await sleep(600);
          data = { ...data, ...readDetail() };
        } catch (_) { /* tidak bisa expand, lanjut tanpa jam buka */ }
      }
    }
    return data;
  }

  // --- IN-PAGE CLICK & SCRAPE DETAIL (SUPER FAST, NO RELOAD) ---------------

  let lastDetailName = '';

  function findCardElement(key, url, name) {
    const feed = getFeed();
    if (!feed) return null;

    const anchors = [...feed.querySelectorAll('a[href*="/maps/place/"]')];

    // 1. Cocokkan key (!1s token atau place id)
    if (key) {
      const byKey = anchors.find((a) => {
        const k = keyFrom(a.href);
        return k === key || a.href.includes(key);
      });
      if (byKey) return byKey;
    }

    // 2. Cocokkan URL
    if (url) {
      const cleanUrl = url.split('?')[0];
      const byUrl = anchors.find((a) => {
        const aClean = a.href.split('?')[0];
        return aClean === cleanUrl || a.href.startsWith(cleanUrl) || cleanUrl.startsWith(aClean);
      });
      if (byUrl) return byUrl;
    }

    // 3. Cocokkan nama tempat
    if (name) {
      const nLow = name.trim().toLowerCase();
      const byName = anchors.find((a) => {
        const aria = (a.getAttribute('aria-label') || '').trim().toLowerCase();
        if (aria && aria === nLow) return true;
        const card = a.closest('[jsaction]') || a.parentElement;
        const cName = txt(card && card.querySelector('.qBF1Pd, .fontHeadlineSmall')).toLowerCase();
        return cName && cName === nLow;
      });
      if (byName) return byName;
    }

    return null;
  }

  async function locateAndScrollToCard(key, url, name) {
    const feed = getFeed();
    if (!feed) return null;

    // 1. Coba temukan langsung di DOM saat ini
    let a = findCardElement(key, url, name);
    if (a) return a;

    // 2. Jika tidak ada dan feed sedang di bawah (efek dari fase scroll sebelumnya),
    // scroll kembali ke atas terlebih dahulu.
    if (feed.scrollTop > 400) {
      feed.scrollTop = 0;
      await sleep(350);
      a = findCardElement(key, url, name);
      if (a) return a;
    }

    // 3. Scroll bertahap ke bawah untuk mencari kartu di virtual feed
    for (let s = 0; s < 12; s++) {
      feed.scrollTop += 500;
      await sleep(220);
      a = findCardElement(key, url, name);
      if (a) return a;
      if (reachedEnd()) break;
    }

    return null;
  }

  function triggerCardClick(a) {
    a.scrollIntoView({ behavior: 'instant', block: 'center' });
    const evt = { bubbles: true, cancelable: true, view: window };
    a.dispatchEvent(new MouseEvent('mousedown', evt));
    a.dispatchEvent(new MouseEvent('mouseup', evt));
    a.click();
    const card = a.closest('[jsaction]') || a;
    if (card !== a) {
      card.dispatchEvent(new MouseEvent('mousedown', evt));
      card.dispatchEvent(new MouseEvent('mouseup', evt));
      card.click();
    }
  }

  async function waitForDetailUpdate(targetKey, targetName, prevName, timeout = 5000) {
    const t0 = Date.now();
    const nLow = (targetName || '').trim().toLowerCase();

    while (Date.now() - t0 < timeout) {
      const pane = detailPane();
      if (pane) {
        const h1 = pane.querySelector('h1');
        const curName = txt(h1);
        const curNameLow = curName.toLowerCase();

        const nameMatch = nLow && (curNameLow === nLow || curNameLow.includes(nLow) || nLow.includes(curNameLow));
        const keyMatch = targetKey && (location.href.includes(targetKey) || keyFrom(location.href) === targetKey);
        const nameChanged = prevName && curName && curName !== prevName;

        const hasContent = !!pane.querySelector('[data-item-id], [jsaction*="category"], button[aria-label]');

        if ((nameMatch || keyMatch || nameChanged) && (hasContent || Date.now() - t0 > 1200)) {
          await sleep(250);
          return true;
        }
      }
      await sleep(80);
    }
    return false;
  }

  async function clickAndScrapeDetail(msg) {
    const { key, url, name } = msg || {};
    const feed = getFeed();
    if (!feed) {
      return { ok: false, notFoundInFeed: true, error: 'Feed tidak ditemukan di halaman' };
    }

    const anchor = await locateAndScrollToCard(key, url, name);
    if (!anchor) {
      return { ok: false, notFoundInFeed: true, error: 'Kartu tidak ditemukan di feed' };
    }

    const prevName = lastDetailName;
    triggerCardClick(anchor);

    await waitForDetailUpdate(key, name, prevName, 5000);

    let data = readDetail();
    lastDetailName = data.name || name || '';

    if (!data.hours) {
      const btn = detailPane().querySelector(
        '[data-item-id="oh"], button[aria-label*="Jam buka"], button[aria-label*="Hours"]'
      );
      if (btn) {
        try {
          btn.click();
          await sleep(350);
          data = { ...data, ...readDetail() };
        } catch (_) {}
      }
    }

    return { ok: true, data, inPage: true };
  }

  // --- message bridge ------------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        switch (msg && msg.type) {
          case 'PING':
            return sendResponse({ ok: true });
          case 'ABORT':
            aborted = true;
            return sendResponse({ ok: true });
          case 'COLLECT':
            return sendResponse({ ok: true, data: await collect(msg.options || {}) });
          case 'CLICK_AND_SCRAPE_DETAIL':
            return sendResponse(await clickAndScrapeDetail(msg));
          case 'SCRAPE_DETAIL':
            return sendResponse({ ok: true, data: await scrapeDetailWhenReady() });
          default:
            return sendResponse({ ok: false, error: 'unknown message' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true; // jawaban async
  });
})();
