/* Helper export yang dipakai bersama oleh popup dan dashboard.
 * Satu sumber kebenaran supaya format CSV/TSV tidak melenceng antar-halaman. */
(() => {
  const COLUMNS = [
    'name', 'category', 'rating', 'reviews', 'address', 'phone',
    'website', 'hasWebsite', 'email', 'emailsAll', 'socials', 'imageUrl', 'hours', 'plusCode',
    'lat', 'lng', 'status', 'note', 'tags', 'url',
  ];

  const has = (v) => v != null && String(v).trim() !== '';

  // Baris dianggap "perlu dilengkapi" kalau telepon atau website masih kosong
  // DAN tempat itu memang sudah pernah dibuka detailnya.
  const needsEnrich = (r) => !has(r.phone) || !has(r.website);

  // Punya website, belum dicek emailnya.
  const needsEmail = (r) => has(r.website) && !has(r.email) && !r.emailCheckedAt;

  const STATUSES = [
    { v: '', label: '—' },
    { v: 'baru', label: 'Baru' },
    { v: 'dihubungi', label: 'Dihubungi' },
    { v: 'followup', label: 'Follow-up' },
    { v: 'deal', label: 'Deal' },
    { v: 'tolak', label: 'Tidak tertarik' },
  ];

  function cell(v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    const s = String(v);
    // Nilai berawalan =+-@ dieksekusi sebagai formula oleh Excel/Sheets.
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  }

  // hasWebsite adalah kolom turunan — dihitung saat export, tidak disimpan.
  function withDerived(r) {
    return {
      ...r,
      hasWebsite: has(r.website) ? 'ya' : 'tidak',
      socials: Array.isArray(r.socials) ? r.socials.join(', ') : r.socials || '',
      tags: Array.isArray(r.tags) ? r.tags.join(', ') : r.tags || '',
    };
  }

  function toCSV(list) {
    const esc = (v) => `"${cell(v).replace(/"/g, '""')}"`;
    const lines = [COLUMNS.join(',')];
    for (const r of list) {
      const d = withDerived(r);
      lines.push(COLUMNS.map((c) => esc(d[c])).join(','));
    }
    return '﻿' + lines.join('\r\n'); // BOM: Excel butuh ini untuk UTF-8
  }

  function toTSV(list) {
    const esc = (v) => cell(v).replace(/[\t\n\r]/g, ' ');
    const lines = [COLUMNS.join('\t')];
    for (const r of list) {
      const d = withDerived(r);
      lines.push(COLUMNS.map((c) => esc(d[c])).join('\t'));
    }
    return lines.join('\n');
  }

  function toExcelTSV(list) {
    // Format khusus TSV dengan BOM untuk pembukaan langsung di Excel
    return '﻿' + toTSV(list).replace(/\n/g, '\r\n');
  }

  function extractEmailList(list) {
    const out = [];
    for (const r of list) {
      if (has(r.email)) out.push(r.email.trim());
      if (has(r.emailsAll)) {
        for (const e of r.emailsAll.split(',')) {
          const trimmed = e.trim();
          if (trimmed && !out.includes(trimmed)) out.push(trimmed);
        }
      }
    }
    return out.join(', ');
  }

  function extractPhoneList(list) {
    const out = [];
    for (const r of list) {
      if (has(r.phone)) {
        const cleaned = String(r.phone).trim();
        if (cleaned && !out.includes(cleaned)) out.push(cleaned);
      }
    }
    return out.join('\n');
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function download(text, filename, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const downloadCSV = (rows) => download(toCSV(rows), `gmaps-${stamp()}.csv`, 'text/csv;charset=utf-8');
  const downloadExcel = (rows) => download(toExcelTSV(rows), `gmaps-${stamp()}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  const downloadJSON = (rows) =>
    download(JSON.stringify(rows.map(withDerived), null, 2), `gmaps-${stamp()}.json`, 'application/json');

  window.MDCExport = {
    COLUMNS, STATUSES, has, needsEnrich, needsEmail, cell, toCSV, toTSV, toExcelTSV,
    extractEmailList, extractPhoneList, stamp, download, downloadCSV, downloadExcel, downloadJSON
  };
})();
