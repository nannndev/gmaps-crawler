/* Maps Directory Crawler — Demo & Standalone Polyfill
 * Otomatis aktif HANYA ketika halaman dibuka di luar extension Chrome (misal untuk preview / screenshot / testing).
 * Mendukung simulasi live crawl, in-page detail click, progress bar, dan manipulasi data interaktif.
 */
(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    return; // Berjalan di dalam extension Chrome asli, jangan polyfill!
  }

  const INITIAL_ROWS = [
    {
      key: 'place_1',
      name: 'Work & Play Coworking & Cafe',
      category: 'Coworking Space',
      rating: 4.8,
      reviews: 245,
      address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
      phone: '+62 21 5208899',
      website: 'https://worknplay.id',
      email: 'hello@worknplay.id',
      emailsAll: 'hello@worknplay.id, info@worknplay.id',
      socials: ['instagram:worknplay.id', 'whatsapp:6281288990011', 'linkedin:worknplay-space'],
      imageUrl: '',
      hours: 'Senin–Jumat: 08:00–22:00 | Sabtu–Minggu: 09:00–20:00',
      plusCode: 'RR3P+8W Senayan, Jakarta',
      lat: -6.2297,
      lng: 106.8074,
      status: 'dihubungi',
      note: 'Sudah dihubungi via WA. Tertarik penawaran paket CRM Q3.',
      tags: ['VIP', 'Target Q3', 'Coworking'],
      scrapedAt: '2026-09-03 16:50:22',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=101',
      enrichedAt: Date.now() - 3600000,
      emailCheckedAt: Date.now() - 1800000,
    },
    {
      key: 'place_2',
      name: 'Kopi Senja Senopati',
      category: 'Kedai Kopi',
      rating: 4.6,
      reviews: 180,
      address: 'Jl. Suryo No. 12, Senopati, Jakarta Selatan',
      phone: '+62 811 2233 4455',
      website: '', // Web Pitch!
      email: '',
      socials: ['instagram:kopisenja.jkt', 'whatsapp:6281122334455'],
      hours: 'Setiap Hari: 07:00–23:00',
      lat: -6.2341,
      lng: 106.8122,
      status: 'baru',
      note: 'Rating tinggi & sangat ramai, butuh website profil & katalog online.',
      tags: ['Web Pitch', 'High Traffic'],
      scrapedAt: '2026-09-03 16:51:10',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=102',
      enrichedAt: Date.now() - 3000000,
    },
    {
      key: 'place_3',
      name: 'Bake & Brew Artisan Bakery',
      category: 'Toko Roti & Bakery',
      rating: 3.8, // Reputation Fix!
      reviews: 92,
      address: 'Jl. Cikajang No. 28, Petogogan, Jakarta Selatan',
      phone: '+62 21 7278910',
      website: 'https://bakeandbrew.co.id',
      email: 'contact@bakeandbrew.co.id',
      socials: ['instagram:bakeandbrew.id'],
      hours: 'Setiap Hari: 07:00–21:00',
      lat: -6.2398,
      lng: 106.8155,
      status: 'followup',
      note: 'Keluhan di ulasan terkait antrean, tawarkan layanan review recovery.',
      tags: ['Reputation Fix', 'Bakery'],
      scrapedAt: '2026-09-03 16:52:05',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=103',
      enrichedAt: Date.now() - 2500000,
      emailCheckedAt: Date.now() - 2000000,
    },
    {
      key: 'place_4',
      name: 'Aroma Nusantara Resto',
      category: 'Restoran Indonesia',
      rating: 4.9, // High Value Lead!
      reviews: 540,
      address: 'Jl. Gunawarman No. 34, Selong, Jakarta Selatan',
      phone: '+62 21 7223344',
      website: 'https://aromanusantara.com',
      email: 'info@aromanusantara.com',
      socials: ['instagram:aromanusantara', 'facebook:aromanusantararesto', 'tiktok:aromanusantara'],
      hours: 'Setiap Hari: 10:00–22:00',
      lat: -6.2365,
      lng: 106.8105,
      status: 'deal',
      note: 'Closing kontrak digital branding & foto menu bulan ini.',
      tags: ['Closed Deal', 'Enterprise'],
      scrapedAt: '2026-09-03 16:53:18',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=104',
      enrichedAt: Date.now() - 2000000,
      emailCheckedAt: Date.now() - 1500000,
    },
    {
      key: 'place_5',
      name: 'Klinik Gigi Senopati Dental Care',
      category: 'Klinik Gigi',
      rating: 4.7,
      reviews: 135,
      address: 'Jl. Wolter Monginsidi No. 18, Kebayoran Baru',
      phone: '+62 21 7201122',
      website: 'https://senopatidental.com',
      email: 'care@senopatidental.com',
      socials: ['instagram:senopatidental', 'whatsapp:628118800112'],
      hours: 'Senin–Sabtu: 09:00–20:00',
      lat: -6.2389,
      lng: 106.8167,
      status: 'baru',
      note: '',
      tags: ['Healthcare', 'Dental'],
      scrapedAt: '2026-09-03 16:54:40',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=105',
      enrichedAt: Date.now() - 1800000,
      emailCheckedAt: Date.now() - 1200000,
    },
    {
      key: 'place_6',
      name: 'Dua Dimensi Creative Studio',
      category: 'Studio Desain & Branding',
      rating: 5.0,
      reviews: 48,
      address: 'Jl. Ciranjang No. 9, Rawa Barat, Jakarta Selatan',
      phone: '+62 813 9988 7766',
      website: 'https://duadimensi.studio',
      email: 'project@duadimensi.studio',
      socials: ['instagram:duadimensi.std', 'linkedin:dua-dimensi-studio'],
      hours: 'Senin–Jumat: 09:00–18:00',
      lat: -6.2372,
      lng: 106.8138,
      status: 'dihubungi',
      note: 'Tertarik kolaborasi project corporate identity.',
      tags: ['Creative', 'Agency'],
      scrapedAt: '2026-09-03 16:55:12',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=106',
      enrichedAt: Date.now() - 1500000,
      emailCheckedAt: Date.now() - 900000,
    },
    {
      key: 'place_7',
      name: 'Law Firm & Partners Hidayat',
      category: 'Kantor Pengacara',
      rating: 4.4,
      reviews: 32,
      address: 'Gedung Graha Niaga Lt. 12, SCBD, Jakarta',
      phone: '+62 21 52901234',
      website: 'https://hidayatlaw.id',
      email: 'advisory@hidayatlaw.id',
      socials: ['linkedin:hidayat-partners-law'],
      hours: 'Senin–Jumat: 08:30–17:30',
      lat: -6.2268,
      lng: 106.8091,
      status: 'baru',
      note: '',
      tags: ['Corporate', 'Legal'],
      scrapedAt: '2026-09-03 16:56:01',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=107',
      enrichedAt: Date.now() - 1200000,
      emailCheckedAt: Date.now() - 700000,
    },
    {
      key: 'place_8',
      name: 'Griya Spa & Reflexology Senopati',
      category: 'Spa & Wellness',
      rating: 4.3,
      reviews: 86,
      address: 'Jl. Suryo No. 40, Senopati, Jakarta Selatan',
      phone: '+62 21 7265544',
      website: '', // Web pitch!
      email: '',
      socials: ['instagram:griyaspa.senopati', 'whatsapp:6281299008811'],
      hours: 'Setiap Hari: 10:00–22:00',
      lat: -6.2348,
      lng: 106.8129,
      status: 'baru',
      note: 'Butuh booking system online & website membership.',
      tags: ['Web Pitch', 'Wellness'],
      scrapedAt: '2026-09-03 16:57:15',
      sessions: ['s_jkt_coworking'],
      url: 'https://maps.google.com/?cid=108',
      enrichedAt: Date.now() - 900000,
    },
  ];

  let mockRows = JSON.parse(JSON.stringify(INITIAL_ROWS));
  let mockVer = 1;
  let mockSessions = [{ id: 's_jkt_coworking', label: 'Coworking Senopati', startedAt: Date.now() - 3600000, count: mockRows.length }];

  const params = new URLSearchParams(window.location.search);
  const isRunningParam = params.get('running') === '1' || params.get('crawl') === '1';

  let mockState = {
    status: isRunningParam ? 'detailing' : 'idle',
    phase: isRunningParam ? 'detail' : null,
    collected: mockRows.length,
    message: isRunningParam ? 'Detail 4/8: Aroma Nusantara Resto (In-page click ⚡)' : 'Siap',
    detailTotal: isRunningParam ? mockRows.length : 0,
    detailIndex: isRunningParam ? 4 : 0,
    activeKey: isRunningParam ? 'place_4' : null,
  };

  let simTimer = null;

  function stopSimulation() {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
    mockState.status = 'idle';
    mockState.message = 'Selesai';
    mockState.activeKey = null;
    mockState.detailTotal = 0;
    mockState.detailIndex = 0;
    mockVer++;
  }

  function runSimulatedEnrich() {
    if (simTimer) clearInterval(simTimer);
    mockState.status = 'detailing';
    mockState.phase = 'detail';
    mockState.detailTotal = mockRows.length;
    mockState.detailIndex = 1;
    mockState.activeKey = mockRows[0].key;
    mockState.message = `Detail 1/${mockRows.length}: ${mockRows[0].name} (In-page click ⚡)`;
    mockVer++;

    let idx = 0;
    simTimer = setInterval(() => {
      idx++;
      if (idx >= mockRows.length) {
        stopSimulation();
        return;
      }
      mockState.detailIndex = idx + 1;
      mockState.activeKey = mockRows[idx].key;
      mockState.message = `Detail ${idx + 1}/${mockRows.length}: ${mockRows[idx].name} (In-page click ⚡ 0.6s)`;
      mockRows[idx].enrichedAt = Date.now();
      mockVer++;
    }, 800);
  }

  function runSimulatedEmails() {
    if (simTimer) clearInterval(simTimer);
    mockState.status = 'emailing';
    mockState.phase = 'email';
    mockState.detailTotal = mockRows.length;
    mockState.detailIndex = 1;
    mockState.activeKey = mockRows[0].key;
    mockState.message = `Mencari email 1/${mockRows.length}: ${mockRows[0].name}…`;
    mockVer++;

    let idx = 0;
    simTimer = setInterval(() => {
      idx++;
      if (idx >= mockRows.length) {
        stopSimulation();
        return;
      }
      mockState.detailIndex = idx + 1;
      mockState.activeKey = mockRows[idx].key;
      mockState.message = `Mencari email ${idx + 1}/${mockRows.length}: ${mockRows[idx].name}…`;
      mockRows[idx].emailCheckedAt = Date.now();
      mockVer++;
    }, 700);
  }

  window.chrome = window.chrome || {};
  window.chrome.storage = window.chrome.storage || {
    local: {
      get: (keys, cb) => {
        const data = { mdc_lang: 'id', mdc_prefs: { mode: 'table', perPage: 50 } };
        if (cb) cb(data);
        return Promise.resolve(data);
      },
      set: (obj, cb) => {
        if (cb) cb();
        return Promise.resolve();
      },
    },
  };

  window.chrome.runtime = window.chrome.runtime || {
    sendMessage: (msg, cb) => {
      if (msg.type === 'GET_STATE') {
        const res = {
          ok: true,
          ver: mockVer,
          rows: mockRows,
          sessions: mockSessions,
          state: mockState,
        };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'ENRICH') {
        runSimulatedEnrich();
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'FIND_EMAILS') {
        runSimulatedEmails();
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'STOP') {
        stopSimulation();
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'SET_FIELD') {
        const target = mockRows.find((r) => (r.key || r.url) === msg.key);
        if (target) {
          target[msg.field] = msg.value;
          mockVer++;
        }
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'DELETE_ROW') {
        mockRows = mockRows.filter((r) => (r.key || r.url) !== msg.key);
        mockVer++;
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'BATCH_SET_STATUS') {
        const setKeys = new Set(msg.keys || []);
        for (const r of mockRows) {
          if (setKeys.has(r.key || r.url)) r.status = msg.status;
        }
        mockVer++;
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'BATCH_DELETE') {
        const setKeys = new Set(msg.keys || []);
        mockRows = mockRows.filter((r) => !setKeys.has(r.key || r.url));
        mockVer++;
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'DEDUPLICATE') {
        const byPhone = new Map();
        let removed = 0;
        const out = [];
        for (const r of mockRows) {
          const raw = (r.phone || '').replace(/[^\d]/g, '');
          if (raw && raw.length >= 7 && byPhone.has(raw)) {
            removed++;
            continue;
          }
          if (raw && raw.length >= 7) byPhone.set(raw, true);
          out.push(r);
        }
        mockRows = out;
        mockVer++;
        const res = { ok: true, removed, count: mockRows.length };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'CLEAR') {
        mockRows = [];
        mockSessions = [];
        mockVer++;
        const res = { ok: true };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'IMPORT_ROWS') {
        mockRows.push(...msg.rows);
        mockVer++;
        const res = { ok: true, added: msg.rows.length };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'RESTORE_BACKUP') {
        mockRows = msg.rows || [];
        mockSessions = msg.sessions || [];
        mockVer++;
        const res = { ok: true, rowsCount: mockRows.length };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      if (msg.type === 'GET_BACKUP') {
        const res = { ok: true, rows: mockRows, sessions: mockSessions };
        if (cb) cb(res);
        return Promise.resolve(res);
      }

      const res = { ok: true };
      if (cb) cb(res);
      return Promise.resolve(res);
    },
    onMessage: { addListener: () => {} },
  };

  // URL parameters untuk otomatis membuka fitur saat screenshot
  window.addEventListener('load', () => {
    if (params.get('analytics') === '1') {
      const p = document.getElementById('analyticsPanel');
      if (p) {
        p.hidden = false;
        if (window.MDCAnalytics && window.MDCAnalytics.renderAnalytics) {
          window.MDCAnalytics.renderAnalytics(mockRows, 'id');
        }
      }
    }
    if (params.get('mode') === 'card') {
      const btn = document.getElementById('viewCard');
      if (btn) btn.click();
    }
    if (params.get('drawer') === '1') {
      if (window.MDCDrawer && mockRows[0]) {
        window.MDCDrawer.openDrawer(mockRows[0]);
      }
    }
    if (params.get('import') === '1') {
      if (window.MDCImportModal) {
        window.MDCImportModal.openImportModal('merge');
      }
    }
  });
})();
