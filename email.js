/* Pencari email — disuntikkan ke website milik tempat, bukan ke Google Maps.
 * Dijalankan lewat chrome.scripting.executeScript, jadi berupa satu fungsi
 * yang mengembalikan hasilnya langsung. */
(() => {
  // Email di halaman depan sering berupa alamat pihak ketiga (vendor, CDN,
  // contoh template). Yang jelas bukan milik bisnisnya dibuang.
  const JUNK = /(sentry|wixpress|example|domain|yourmail|email|test|noreply|no-reply|donotreply|godaddy|squarespace|shopify|wordpress|cloudflare|jquery|bootstrap|fontawesome|schema\.org|w3\.org|sentry\.io)/i;
  const BADEXT = /\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?|ttf|mp4|pdf)$/i;
  const RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  function clean(list, host) {
    const out = new Map();
    for (let e of list) {
      e = String(e).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0];
      if (!e || e.length > 90) continue;
      if (JUNK.test(e) || BADEXT.test(e)) continue;
      if (!/^[^@]+@[^@]+\.[a-z]{2,}$/.test(e)) continue;
      // Email berdomain sama dengan websitenya hampir pasti milik bisnis itu.
      const dom = e.split('@')[1] || '';
      const base = (host || '').replace(/^www\./, '');
      const score = dom === base || dom.endsWith('.' + base) ? 2 : 1;
      if (!out.has(e) || out.get(e) < score) out.set(e, score);
    }
    // Skor tinggi dulu, lalu yang terpendek (biasanya info@ / halo@).
    return [...out.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
      .map(([e]) => e);
  }

  function cleanSocials(list) {
    const SOCIAL_PATTERNS = [
      { key: 'instagram', re: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i },
      { key: 'facebook', re: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9_.]+)/i },
      { key: 'whatsapp', re: /(?:https?:\/\/)?(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/)(\+?\d+)/i },
      { key: 'linkedin', re: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_-]+)/i },
      { key: 'tiktok', re: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/i },
      { key: 'twitter', re: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i },
    ];
    const JUNK_SOCIAL = /^(sharer|share|intent|dialog|plugins|home|explore|feed|hashtag|login|signup)$/i;
    const out = [];
    const seen = new Set();
    for (let u of list) {
      if (!u || typeof u !== 'string') continue;
      u = u.trim();
      for (const p of SOCIAL_PATTERNS) {
        const m = p.re.exec(u);
        if (m && !JUNK_SOCIAL.test(m[1])) {
          const formatted = `${p.key}:${m[1]}`;
          if (!seen.has(formatted)) {
            seen.add(formatted);
            out.push(formatted);
          }
        }
      }
    }
    return out;
  }

  const found = [];
  const hrefs = [];

  // mailto: paling tepercaya — itu memang ditulis untuk dihubungi.
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href') || '';
    if (h.startsWith('mailto:')) {
      found.push(h.slice(7));
    } else {
      hrefs.push(a.href);
    }
  }

  // Teks terlihat saja; innerHTML ikut menyeret email dari komentar & script.
  const text = (document.body && document.body.innerText) || '';
  found.push(...(text.match(RE) || []));

  const emails = clean(found, location.hostname);
  const socials = cleanSocials(hrefs);

  return { emails, socials };
})();

