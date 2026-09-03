/* Import & Restore Module
 * Parser CSV / JSON, validasi schema, dan normalisasi data import.
 * Berfungsi di lingkungan browser dan Node.js (test).
 */
(() => {
  /**
   * RFC 4180 compliant CSV parser.
   * Mendukung sel multiline, kutip ganda ter-escape (""), koma, dan strip BOM.
   */
  function parseCSV(text) {
    if (!text || typeof text !== 'string') return [];

    // Hapus BOM UTF-8 jika ada
    let str = text.replace(/^\uFEFF/, '');
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;
    const len = str.length;

    while (i < len) {
      const char = str[i];
      const nextChar = str[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentCell += '"';
            i += 2;
            continue;
          } else {
            // End of quoted cell
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentCell += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          currentRow.push(currentCell.trim());
          currentCell = '';
          i++;
          continue;
        } else if (char === '\r' || char === '\n') {
          currentRow.push(currentCell.trim());
          currentCell = '';
          if (char === '\r' && nextChar === '\n') i++; // CRLF
          if (currentRow.some((c) => c !== '')) rows.push(currentRow);
          currentRow = [];
          i++;
          continue;
        } else {
          currentCell += char;
          i++;
          continue;
        }
      }
    }

    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) rows.push(currentRow);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/^['"]|['"]$/g, ''));
    const results = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const val = row[c] != null ? row[c] : '';
        // Unescape leading formula escape '
        obj[headers[c]] = val.startsWith("'") ? val.slice(1) : val;
      }
      results.push(obj);
    }

    return results;
  }

  /**
   * Normalisasi data baris dari CSV / JSON mentah ke format schema internal gmaps-crawler.
   */
  function normalizeRow(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // Mapping sinonim header (Indonesia / Inggris)
    const name = raw.name || raw.nama || raw.title || raw['business name'] || '';
    if (!name && !raw.url && !raw.key) return null;

    let rating = raw.rating != null ? raw.rating : (raw.skor || raw.bintang);
    if (rating != null && rating !== '') {
      if (typeof rating === 'string') rating = parseFloat(rating.replace(',', '.'));
      if (isNaN(rating)) rating = null;
    } else {
      rating = null;
    }

    let reviews = raw.reviews != null ? raw.reviews : (raw.ulasan || raw['review count']);
    if (reviews != null && reviews !== '') {
      if (typeof reviews === 'string') reviews = parseInt(reviews.replace(/[^\d]/g, ''), 10);
      if (isNaN(reviews)) reviews = null;
    } else {
      reviews = null;
    }

    // Normalisasi array tags
    let tags = [];
    if (Array.isArray(raw.tags)) {
      tags = raw.tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof raw.tags === 'string' && raw.tags.trim()) {
      tags = raw.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    // Normalisasi array socials
    let socials = [];
    if (Array.isArray(raw.socials)) {
      socials = raw.socials.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof raw.socials === 'string' && raw.socials.trim()) {
      socials = raw.socials.split(',').map((s) => s.trim()).filter(Boolean);
    }

    let lat = raw.lat != null && raw.lat !== '' ? parseFloat(String(raw.lat).replace(',', '.')) : null;
    let lng = raw.lng != null && raw.lng !== '' ? parseFloat(String(raw.lng).replace(',', '.')) : null;
    if (isNaN(lat)) lat = null;
    if (isNaN(lng)) lng = null;

    const phone = raw.phone != null ? String(raw.phone).trim() : (raw.telepon != null ? String(raw.telepon).trim() : '');
    const website = raw.website != null ? String(raw.website).trim() : (raw.web != null ? String(raw.web).trim() : '');

    return {
      key: raw.key || raw.url || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: String(name).trim(),
      category: raw.category || raw.kategori || '',
      rating,
      reviews,
      address: raw.address || raw.alamat || '',
      phone,
      website,
      email: raw.email != null ? String(raw.email).trim() : '',
      emailsAll: raw.emailsAll != null ? String(raw.emailsAll).trim() : '',
      socials,
      imageUrl: raw.imageUrl || raw.foto || '',
      hours: raw.hours || raw.jam || '',
      plusCode: raw.plusCode || raw.pluscode || '',
      lat,
      lng,
      status: raw.status || '',
      note: raw.note || raw.catatan || '',
      tags,
      scrapedAt: raw.scrapedAt || (raw.savedAt ? (typeof raw.savedAt === 'number' ? new Date(raw.savedAt).toISOString().replace('T', ' ').slice(0, 19) : String(raw.savedAt)) : ''),
      savedAt: raw.savedAt || null,
      url: raw.url || '',
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    };
  }

  /**
   * Parse teks JSON: bisa berupa array baris atau objek backup database lengkap.
   */
  function parseJSON(text) {
    if (!text || typeof text !== 'string') throw new Error('Konten JSON kosong');
    const parsed = JSON.parse(text);

    // Kasus 1: Format Full Backup Database
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.rows)) {
      return {
        type: 'backup',
        version: parsed.version || '1.3.0',
        exportedAt: parsed.exportedAt || null,
        rows: parsed.rows.map(normalizeRow).filter(Boolean),
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    }

    // Kasus 2: Format Array Baris
    if (Array.isArray(parsed)) {
      return {
        type: 'rows',
        rows: parsed.map(normalizeRow).filter(Boolean),
        sessions: [],
      };
    }

    throw new Error('Struktur JSON tidak dikenali. Harap unggah file array tempat atau file backup database.');
  }

  /**
   * Validasi dan persiapkan baris untuk di-merge ke background.
   */
  function validateAndNormalize(rawList) {
    if (!Array.isArray(rawList)) return { valid: [], rejected: 0 };
    const valid = [];
    let rejected = 0;

    for (const item of rawList) {
      const norm = normalizeRow(item);
      if (norm && norm.name) {
        valid.push(norm);
      } else {
        rejected++;
      }
    }

    return { valid, rejected };
  }

  const exportObj = {
    parseCSV,
    parseJSON,
    normalizeRow,
    validateAndNormalize,
  };

  if (typeof window !== 'undefined') {
    window.MDCImport = exportObj;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
})();
