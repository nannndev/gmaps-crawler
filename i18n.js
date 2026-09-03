/* Maps Directory Crawler — i18n Module
 * Manajemen kamus dwibahasa (Bahasa Indonesia & English) dan lokalisasi UI.
 */
(() => {
  const LANG_KEY = 'mdc_lang';
  let currentLang = 'id';

  const I18N = {
    id: {
      brandSub: 'Lead Intelligence & Outreach Platform',
      viewTable: 'Tabel',
      viewCard: 'Kartu',
      analyticsBtn: '📊 Analitik',
      enrichBtn: '⚡ Enrich Kontak',
      emailsBtn: '🔍 Cari Email & Sosmed',
      importBtn: '📥 Import',
      stopBtn: 'Berhenti',
      exportMenu: 'Export ▾',
      exportCsv: 'Export CSV',
      exportExcel: 'Export Excel (.xls)',
      exportJson: 'Export JSON',
      exportTsv: 'Salin (TSV)',
      copyEmails: 'Salin Semua Email',
      copyPhones: 'Salin Semua Telepon',
      toolsMenu: 'Alat ⚙ ▾',
      menuImport: '📥 Import CSV / JSON…',
      menuBackup: '💾 Backup Database (.json)',
      menuRestore: '🔄 Restore Database…',
      menuDedupe: '🧹 Merge Duplikat',
      menuClear: '🗑️ Kosongkan Semua Data',

      // Stats
      statTotal: 'Total Leads',
      statWebPitch: 'Butuh Website',
      statReady: 'Kontak Siap',
      statPhone: 'Ada Telepon',
      statSite: 'Ada Website',
      statEmail: 'Ada Email',
      statSocial: 'Ada Sosmed',
      statIncomplete: 'Belum Lengkap',

      // Filters
      searchPlaceholder: 'Cari nama, alamat, kategori, telepon, email, tag…',
      sessionAll: 'Semua sesi',
      oppAll: 'Peluang: semua',
      webAll: 'Website: semua',
      webNo: 'Tanpa website',
      webYes: 'Ada website',
      phoneAll: 'Telepon: semua',
      phoneNo: 'Tanpa telepon',
      phoneYes: 'Ada telepon',
      statusAll: 'Status: semua',
      statusNone: 'Belum ditandai',
      statusNew: 'Baru',
      statusContacted: 'Dihubungi',
      statusFollowup: 'Follow-up',
      statusDeal: 'Deal',
      statusReject: 'Tidak tertarik',
      emailAll: 'Email: semua',
      emailYes: 'Ada email',
      emailNo: 'Tanpa email',
      socialAll: 'Sosmed: semua',
      socialYes: 'Ada sosmed',
      socialNo: 'Tanpa sosmed',
      ratingAll: 'Rating: semua',
      ratingLt4: '< 4,0',
      ratingGte4: '≥ 4,0',
      ratingGte45: '≥ 4,5',
      ratingNone: 'Tanpa rating',
      sortDefault: 'Urutan asli',
      sortScore: 'Skor Peluang (Tinggi → Rendah)',
      sortName: 'Nama A–Z',
      sortRating: 'Rating tertinggi',
      sortReviews: 'Review terbanyak',
      sortCategory: 'Kategori A–Z',
      resetFilter: 'Reset filter',

      // Table Headers
      thOpp: 'Peluang',
      thName: 'Nama',
      thCat: 'Kategori',
      thRating: 'Rating',
      thAddr: 'Alamat',
      thPhone: 'Telepon',
      thSite: 'Website',
      thEmail: 'Email & Sosmed',
      thStatus: 'Status',
      thNote: 'Catatan & Tag',

      // Analytics
      analyticsOpp: 'Radar Peluang Lead',
      analyticsFunnel: 'Funnel CRM Status',
      analyticsCat: 'Kategori Terbanyak',
      analyticsComp: 'Kelengkapan Kontak',
      analyticsRate: 'Distribusi Rating',

      // Batch bar
      batchUpdateStatus: 'Ubah status massal…',
      batchExport: 'Export Terpilih',
      batchDelete: 'Hapus Terpilih',
      batchCancel: 'Batal',
      batchSelected: 'terpilih',

      // Drawer
      drawerOpp: 'Radar Peluang & Skor',
      drawerContact: 'Informasi Kontak',
      drawerLocation: 'Lokasi & Jam Buka',
      drawerCrm: 'Manajemen CRM',
      drawerAddr: 'Alamat:',
      drawerPhone: 'Telepon:',
      drawerSite: 'Website:',
      drawerEmail: 'Email:',
      drawerSocial: 'Media Sosial:',
      drawerPlusCode: 'Plus Code:',
      drawerCoords: 'Koordinat:',
      drawerHours: 'Jam Buka:',
      drawerScrapedAt: 'Waktu Scrape:',
      drawerStatus: 'Status:',
      drawerNote: 'Catatan:',
      drawerNotePlaceholder: 'Tulis catatan prospek di sini…',
      drawerTags: 'Tag Kustom:',
      drawerTagsPlaceholder: 'Pisahkan dengan koma (mis: VIP, Target Q3)',

      // Import Modal
      modalImportTitle: 'Import & Restore Data',
      modalImportSub: 'Unggah file CSV atau file backup database JSON',
      dropzoneMain: 'Pilih file CSV atau JSON',
      dropzoneSub: 'atau seret ke sini',
      dropzoneHint: 'Mendukung format CSV hasil export atau JSON database backup',
      impValidText: 'tempat valid ditemukan',
      impInvalidText: 'baris diabaikan (tanpa nama)',
      modeMergeTitle: 'Gabungkan (Merge)',
      modeMergeDesc: 'Tambahkan tempat baru ke database tanpa menghapus data atau catatan CRM lama.',
      modeRestoreTitle: 'Ganti Semua (Restore Database)',
      modeRestoreDesc: 'Hapus database lama dan gantikan sepenuhnya dengan isi file cadangan.',
      btnCancelImport: 'Batal',
      btnDoImport: 'Mulai Impor',

      // Empty & Pager
      emptyFiltered: 'Tidak ada baris yang cocok dengan filter atau kata kunci pencarian.',
      emptyNone: 'Belum ada data. Buka Google Maps, cari sesuatu, lalu klik Mulai di popup atau Impor file CSV/JSON.',
      pagerOf: 'dari',
      pagerHal: 'hal',
      pagerPrev: '‹ Sebelumnya',
      pagerNext: 'Berikutnya ›',
    },
    en: {
      brandSub: 'Lead Intelligence & Outreach Platform',
      viewTable: 'Table',
      viewCard: 'Cards',
      analyticsBtn: '📊 Analytics',
      enrichBtn: '⚡ Enrich Contacts',
      emailsBtn: '🔍 Find Email & Socials',
      importBtn: '📥 Import',
      stopBtn: 'Stop',
      exportMenu: 'Export ▾',
      exportCsv: 'Export CSV',
      exportExcel: 'Export Excel (.xls)',
      exportJson: 'Export JSON',
      exportTsv: 'Copy (TSV)',
      copyEmails: 'Copy All Emails',
      copyPhones: 'Copy All Phone Numbers',
      toolsMenu: 'Tools ⚙ ▾',
      menuImport: '📥 Import CSV / JSON…',
      menuBackup: '💾 Backup Database (.json)',
      menuRestore: '🔄 Restore Database…',
      menuDedupe: '🧹 Deduplicate Leads',
      menuClear: '🗑️ Clear All Data',

      // Stats
      statTotal: 'Total Leads',
      statWebPitch: 'Needs Website',
      statReady: 'Outreach Ready',
      statPhone: 'Has Phone',
      statSite: 'Has Website',
      statEmail: 'Has Email',
      statSocial: 'Has Socials',
      statIncomplete: 'Incomplete',

      // Filters
      searchPlaceholder: 'Search leads by name, address, category, phone, email, tags…',
      sessionAll: 'All sessions',
      oppAll: 'Opportunity: all',
      webAll: 'Website: all',
      webNo: 'No website',
      webYes: 'Has website',
      phoneAll: 'Phone: all',
      phoneNo: 'No phone',
      phoneYes: 'Has phone',
      statusAll: 'Status: all',
      statusNone: 'Unassigned',
      statusNew: 'New Lead',
      statusContacted: 'Contacted',
      statusFollowup: 'Follow-up',
      statusDeal: 'Closed Deal',
      statusReject: 'Not Interested',
      emailAll: 'Email: all',
      emailYes: 'Has email',
      emailNo: 'No email',
      socialAll: 'Socials: all',
      socialYes: 'Has socials',
      socialNo: 'No socials',
      ratingAll: 'Rating: all',
      ratingLt4: '< 4.0',
      ratingGte4: '≥ 4.0',
      ratingGte45: '≥ 4.5',
      ratingNone: 'No rating',
      sortDefault: 'Default order',
      sortScore: 'Lead Score (High → Low)',
      sortName: 'Name A–Z',
      sortRating: 'Highest Rating',
      sortReviews: 'Most Reviews',
      sortCategory: 'Category A–Z',
      resetFilter: 'Reset filters',

      // Table Headers
      thOpp: 'Opportunity',
      thName: 'Name',
      thCat: 'Category',
      thRating: 'Rating',
      thAddr: 'Address',
      thPhone: 'Phone',
      thSite: 'Website',
      thEmail: 'Email & Socials',
      thStatus: 'Status',
      thNote: 'Notes & Tags',

      // Analytics
      analyticsOpp: 'Lead Opportunity Radar',
      analyticsFunnel: 'CRM Status Funnel',
      analyticsCat: 'Top Categories',
      analyticsComp: 'Contact Completeness',
      analyticsRate: 'Rating Distribution',

      // Batch bar
      batchUpdateStatus: 'Bulk update status…',
      batchExport: 'Export Selected',
      batchDelete: 'Delete Selected',
      batchCancel: 'Cancel',
      batchSelected: 'selected',

      // Drawer
      drawerOpp: 'Opportunity Radar & Score',
      drawerContact: 'Contact Details',
      drawerLocation: 'Location & Hours',
      drawerCrm: 'CRM Management',
      drawerAddr: 'Address:',
      drawerPhone: 'Phone:',
      drawerSite: 'Website:',
      drawerEmail: 'Email:',
      drawerSocial: 'Social Media:',
      drawerPlusCode: 'Plus Code:',
      drawerCoords: 'Coordinates:',
      drawerHours: 'Opening Hours:',
      drawerScrapedAt: 'Scraped At:',
      drawerStatus: 'Status:',
      drawerNote: 'Notes:',
      drawerNotePlaceholder: 'Write prospect notes here…',
      drawerTags: 'Custom Tags:',
      drawerTagsPlaceholder: 'Comma separated (e.g. VIP, Q3 Target)',

      // Import Modal
      modalImportTitle: 'Import & Restore Leads',
      modalImportSub: 'Upload CSV or JSON database backup file',
      dropzoneMain: 'Choose CSV or JSON file',
      dropzoneSub: 'or drag & drop here',
      dropzoneHint: 'Supports exported CSV format or full JSON database backup',
      impValidText: 'valid leads found',
      impInvalidText: 'rows ignored (missing name)',
      modeMergeTitle: 'Merge Leads',
      modeMergeDesc: 'Add new leads to database without overwriting existing data or CRM notes.',
      modeRestoreTitle: 'Replace All (Restore Database)',
      modeRestoreDesc: 'Wipe current database and replace completely with uploaded backup file.',
      btnCancelImport: 'Cancel',
      btnDoImport: 'Start Import',

      // Empty & Pager
      emptyFiltered: 'No leads match the current filters.',
      emptyNone: 'No leads yet. Open Google Maps, search for something, then click Start in popup or Import leads.',
      pagerOf: 'of',
      pagerHal: 'page',
      pagerPrev: '‹ Previous',
      pagerNext: 'Next ›',
    },
  };

  const $ = (id) => document.getElementById(id);

  function getLang() {
    return currentLang;
  }

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || key;
  }

  function updateFilterOptionTexts(totalRows = 0) {
    const isEn = currentLang === 'en';

    if ($('session') && $('session').options[0]) {
      $('session').options[0].textContent = `${isEn ? 'All sessions' : 'Semua sesi'} (${totalRows})`;
    }

    const oppOpts = [
      ['all', isEn ? 'Opportunity: all' : 'Peluang: semua'],
      ['web-pitch', isEn ? '🌐 Needs Website' : '🌐 Butuh Website'],
      ['reputation-fix', isEn ? '🛡️ Reputation Fix' : '🛡️ Perlu Reputasi'],
      ['high-value', isEn ? '⭐ High Value Lead' : '⭐ High Value Lead'],
      ['outreach-ready', isEn ? '⚡ Outreach Ready' : '⚡ Kontak Siap'],
      ['standard', isEn ? '📍 Standard Lead' : '📍 Standard Lead'],
    ];
    for (let i = 0; i < oppOpts.length; i++) {
      if ($('fOpp') && $('fOpp').options[i]) $('fOpp').options[i].textContent = oppOpts[i][1];
    }

    const webOpts = [
      ['all', isEn ? 'Website: all' : 'Website: semua'],
      ['no', isEn ? 'No website' : 'Tanpa website'],
      ['yes', isEn ? 'Has website' : 'Ada website'],
    ];
    for (let i = 0; i < webOpts.length; i++) {
      if ($('fWebsite') && $('fWebsite').options[i]) $('fWebsite').options[i].textContent = webOpts[i][1];
    }

    const phoneOpts = [
      ['all', isEn ? 'Phone: all' : 'Telepon: semua'],
      ['no', isEn ? 'No phone' : 'Tanpa telepon'],
      ['yes', isEn ? 'Has phone' : 'Ada telepon'],
    ];
    for (let i = 0; i < phoneOpts.length; i++) {
      if ($('fPhone') && $('fPhone').options[i]) $('fPhone').options[i].textContent = phoneOpts[i][1];
    }

    const statusOpts = [
      ['all', isEn ? 'Status: all' : 'Status: semua'],
      ['none', isEn ? 'Unassigned' : 'Belum ditandai'],
      ['baru', isEn ? 'New Lead' : 'Baru'],
      ['dihubungi', isEn ? 'Contacted' : 'Dihubungi'],
      ['followup', 'Follow-up'],
      ['deal', isEn ? 'Closed Deal' : 'Deal'],
      ['tolak', isEn ? 'Not Interested' : 'Tidak tertarik'],
    ];
    for (let i = 0; i < statusOpts.length; i++) {
      if ($('fStatus') && $('fStatus').options[i]) $('fStatus').options[i].textContent = statusOpts[i][1];
    }

    const emailOpts = [
      ['all', isEn ? 'Email: all' : 'Email: semua'],
      ['yes', isEn ? 'Has email' : 'Ada email'],
      ['no', isEn ? 'No email' : 'Tanpa email'],
    ];
    for (let i = 0; i < emailOpts.length; i++) {
      if ($('fEmail') && $('fEmail').options[i]) $('fEmail').options[i].textContent = emailOpts[i][1];
    }

    const socOpts = [
      ['all', isEn ? 'Socials: all' : 'Sosial: semua'],
      ['yes', isEn ? 'Has socials' : 'Ada sosial media'],
      ['no', isEn ? 'No socials' : 'Tanpa sosial media'],
    ];
    for (let i = 0; i < socOpts.length; i++) {
      if ($('fSocial') && $('fSocial').options[i]) $('fSocial').options[i].textContent = socOpts[i][1];
    }

    const rateOpts = [
      ['all', isEn ? 'Rating: all' : 'Rating: semua'],
      ['lt4', '< 4.0'],
      ['gte4', '≥ 4.0'],
      ['gte45', '≥ 4.5'],
      ['none', isEn ? 'No rating' : 'Tanpa rating'],
    ];
    for (let i = 0; i < rateOpts.length; i++) {
      if ($('fRating') && $('fRating').options[i]) $('fRating').options[i].textContent = rateOpts[i][1];
    }

    const sortOpts = [
      ['default', isEn ? 'Default order' : 'Urutan asli'],
      ['score', isEn ? 'Lead Score (High → Low)' : 'Skor Peluang (Tinggi → Rendah)'],
      ['name', isEn ? 'Name A–Z' : 'Nama A–Z'],
      ['rating', isEn ? 'Highest Rating' : 'Rating tertinggi'],
      ['reviews', isEn ? 'Most Reviews' : 'Review terbanyak'],
      ['category', isEn ? 'Category A–Z' : 'Kategori A–Z'],
    ];
    for (let i = 0; i < sortOpts.length; i++) {
      if ($('sort') && $('sort').options[i]) $('sort').options[i].textContent = sortOpts[i][1];
    }

    if ($('batchStatusSel') && $('batchStatusSel').options[0]) {
      $('batchStatusSel').options[0].textContent = isEn ? 'Bulk update status…' : 'Ubah status massal…';
    }
  }

  function applyI18n(totalRows = 0) {
    const dict = I18N[currentLang];
    if (!dict) return;

    // Header & Tools
    if ($('lblBrandSub')) $('lblBrandSub').textContent = dict.brandSub;
    if ($('lblViewTable')) $('lblViewTable').textContent = dict.viewTable;
    if ($('lblViewCard')) $('lblViewCard').textContent = dict.viewCard;
    if ($('lblAnalyticsBtn')) $('lblAnalyticsBtn').textContent = dict.analyticsBtn;
    if ($('lblEnrichBtn')) $('lblEnrichBtn').textContent = dict.enrichBtn;
    if ($('lblEmailsBtn')) $('lblEmailsBtn').textContent = dict.emailsBtn;
    if ($('lblImportBtn')) $('lblImportBtn').textContent = dict.importBtn;
    if ($('lblStopBtn')) $('lblStopBtn').textContent = dict.stopBtn;
    if ($('lblExportMenu')) $('lblExportMenu').textContent = dict.exportMenu;
    if ($('lblExportCsv')) $('lblExportCsv').textContent = dict.exportCsv;
    if ($('lblExportExcel')) $('lblExportExcel').textContent = dict.exportExcel;
    if ($('lblExportJson')) $('lblExportJson').textContent = dict.exportJson;
    if ($('lblExportTsv')) $('lblExportTsv').textContent = dict.exportTsv;
    if ($('lblCopyEmails')) $('lblCopyEmails').textContent = dict.copyEmails;
    if ($('lblCopyPhones')) $('lblCopyPhones').textContent = dict.copyPhones;
    if ($('lblToolsMenu')) $('lblToolsMenu').textContent = dict.toolsMenu;
    if ($('lblMenuImport')) $('lblMenuImport').textContent = dict.menuImport;
    if ($('lblMenuBackup')) $('lblMenuBackup').textContent = dict.menuBackup;
    if ($('lblMenuRestore')) $('lblMenuRestore').textContent = dict.menuRestore;
    if ($('lblMenuDedupe')) $('lblMenuDedupe').textContent = dict.menuDedupe;
    if ($('lblMenuClear')) $('lblMenuClear').textContent = dict.menuClear;

    // Stats labels
    if ($('lblStatTotal')) $('lblStatTotal').textContent = dict.statTotal;
    if ($('lblStatWebPitch')) $('lblStatWebPitch').textContent = dict.statWebPitch;
    if ($('lblStatReady')) $('lblStatReady').textContent = dict.statReady;
    if ($('lblStatPhone')) $('lblStatPhone').textContent = dict.statPhone;
    if ($('lblStatSite')) $('lblStatSite').textContent = dict.statSite;
    if ($('lblStatEmail')) $('lblStatEmail').textContent = dict.statEmail;
    if ($('lblStatSocial')) $('lblStatSocial').textContent = dict.statSocial;
    if ($('lblStatIncomplete')) $('lblStatIncomplete').textContent = dict.statIncomplete;

    // Search & Filter
    if ($('q')) $('q').placeholder = dict.searchPlaceholder;
    if ($('reset')) $('reset').textContent = dict.resetFilter;

    // Table Headers
    const sortIcon = '<span class="sort-icon"></span>';
    if ($('thOpp')) $('thOpp').innerHTML = dict.thOpp + ' ' + sortIcon;
    if ($('thName')) $('thName').innerHTML = dict.thName + ' ' + sortIcon;
    if ($('thCat')) $('thCat').innerHTML = dict.thCat + ' ' + sortIcon;
    if ($('thRating')) $('thRating').innerHTML = dict.thRating + ' ' + sortIcon;
    if ($('thAddr')) $('thAddr').textContent = dict.thAddr;
    if ($('thPhone')) $('thPhone').textContent = dict.thPhone;
    if ($('thSite')) $('thSite').textContent = dict.thSite;
    if ($('thEmail')) $('thEmail').textContent = dict.thEmail;
    if ($('thStatus')) $('thStatus').innerHTML = dict.thStatus + ' ' + sortIcon;
    if ($('thNote')) $('thNote').textContent = dict.thNote;

    // Analytics
    if ($('lblAnalyticsOpp')) $('lblAnalyticsOpp').textContent = dict.analyticsOpp;
    if ($('lblAnalyticsFunnel')) $('lblAnalyticsFunnel').textContent = dict.analyticsFunnel;
    if ($('lblAnalyticsCat')) $('lblAnalyticsCat').textContent = dict.analyticsCat;
    if ($('lblAnalyticsComp')) $('lblAnalyticsComp').textContent = dict.analyticsComp;
    if ($('lblAnalyticsRate')) $('lblAnalyticsRate').textContent = dict.analyticsRate;

    // Drawer
    if ($('lblDrawerOpp')) $('lblDrawerOpp').textContent = dict.drawerOpp;
    if ($('lblDrawerContact')) $('lblDrawerContact').textContent = dict.drawerContact;
    if ($('lblDrawerLocation')) $('lblDrawerLocation').textContent = dict.drawerLocation;
    if ($('lblDrawerCrm')) $('lblDrawerCrm').textContent = dict.drawerCrm;
    if ($('lblDAddr')) $('lblDAddr').textContent = dict.drawerAddr;
    if ($('lblDPhone')) $('lblDPhone').textContent = dict.drawerPhone;
    if ($('lblDWebsite')) $('lblDWebsite').textContent = dict.drawerSite;
    if ($('lblDEmail')) $('lblDEmail').textContent = dict.drawerEmail;
    if ($('lblDSocials')) $('lblDSocials').textContent = dict.drawerSocial;
    if ($('lblDPlusCode')) $('lblDPlusCode').textContent = dict.drawerPlusCode;
    if ($('lblDCoords')) $('lblDCoords').textContent = dict.drawerCoords;
    if ($('lblDHours')) $('lblDHours').textContent = dict.drawerHours;
    if ($('lblDScrapedAt')) $('lblDScrapedAt').textContent = dict.drawerScrapedAt;
    if ($('lblDStatus')) $('lblDStatus').textContent = dict.drawerStatus;
    if ($('lblDNote')) $('lblDNote').textContent = dict.drawerNote;
    if ($('dNote')) $('dNote').placeholder = dict.drawerNotePlaceholder;
    if ($('lblDTags')) $('lblDTags').textContent = dict.drawerTags;
    if ($('dTags')) $('dTags').placeholder = dict.drawerTagsPlaceholder;

    // Batch bar
    if ($('lblBatchExport')) $('lblBatchExport').textContent = dict.batchExport;
    if ($('lblBatchDelete')) $('lblBatchDelete').textContent = dict.batchDelete;
    if ($('lblBatchCancel')) $('lblBatchCancel').textContent = dict.batchCancel;

    // Import Modal
    if ($('lblModalImportTitle')) $('lblModalImportTitle').textContent = dict.modalImportTitle;
    if ($('lblModalImportSub')) $('lblModalImportSub').textContent = dict.modalImportSub;
    if ($('lblDropzoneMain')) $('lblDropzoneMain').textContent = dict.dropzoneMain;
    if ($('lblDropzoneSub')) $('lblDropzoneSub').textContent = dict.dropzoneSub;
    if ($('lblDropzoneHint')) $('lblDropzoneHint').textContent = dict.dropzoneHint;
    if ($('lblImpValidText')) $('lblImpValidText').textContent = dict.impValidText;
    if ($('lblImpInvalidText')) $('lblImpInvalidText').textContent = dict.impInvalidText;
    if ($('lblModeMergeTitle')) $('lblModeMergeTitle').textContent = dict.modeMergeTitle;
    if ($('lblModeMergeDesc')) $('lblModeMergeDesc').textContent = dict.modeMergeDesc;
    if ($('lblModeRestoreTitle')) $('lblModeRestoreTitle').textContent = dict.modeRestoreTitle;
    if ($('lblModeRestoreDesc')) $('lblModeRestoreDesc').textContent = dict.modeRestoreDesc;
    if ($('lblBtnCancelImport')) $('lblBtnCancelImport').textContent = dict.btnCancelImport;
    if ($('lblBtnDoImport')) $('lblBtnDoImport').textContent = dict.btnDoImport;

    // Pager
    if ($('pPrev')) $('pPrev').textContent = dict.pagerPrev;
    if ($('pNext')) $('pNext').textContent = dict.pagerNext;

    updateFilterOptionTexts(totalRows);
  }

  function setLang(lang, onChangeCallback) {
    currentLang = lang === 'en' ? 'en' : 'id';
    chrome.storage.local.set({ [LANG_KEY]: currentLang });
    if ($('langId')) $('langId').classList.toggle('on', currentLang === 'id');
    if ($('langEn')) $('langEn').classList.toggle('on', currentLang === 'en');
    applyI18n();
    if (typeof onChangeCallback === 'function') onChangeCallback(currentLang);
  }

  function initI18n(initialLang, onChangeCallback) {
    currentLang = initialLang === 'en' ? 'en' : 'id';
    if ($('langId')) {
      $('langId').classList.toggle('on', currentLang === 'id');
      $('langId').addEventListener('click', () => setLang('id', onChangeCallback));
    }
    if ($('langEn')) {
      $('langEn').classList.toggle('on', currentLang === 'en');
      $('langEn').addEventListener('click', () => setLang('en', onChangeCallback));
    }
    applyI18n();
  }

  const api = {
    LANG_KEY,
    I18N,
    getLang,
    t,
    setLang,
    initI18n,
    applyI18n,
    updateFilterOptionTexts,
  };

  if (typeof window !== 'undefined') window.MDCI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
