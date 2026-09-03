/* Maps Directory Crawler — Dashboard Pro
 * Lead Intelligence & Outreach Platform.
 * Data dibaca dari background service worker via chrome.runtime.sendMessage.
 * Mendukung antarmuka bilingual (Bahasa Indonesia & English).
 */

const $ = (id) => document.getElementById(id);
const {
  has, needsEnrich, needsEmail, STATUSES, toTSV, downloadCSV, downloadExcel, downloadJSON,
  extractEmailList, extractPhoneList, downloadBackup
} = window.MDCExport;

const {
  OPPORTUNITY_TYPES, calculateLeadScore, getOpportunity
} = window.MDCOpportunity;

const {
  parseCSV, parseJSON, validateAndNormalize
} = window.MDCImport;

const send = (msg) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const err = chrome.runtime.lastError;
      resolve(err ? { ok: false, error: err.message } : res || { ok: false, error: 'tanpa respons' });
    });
  });

const RUNNING = ['collecting', 'detailing', 'enriching', 'emailing'];
const PREFS_KEY = 'mdc_prefs';
const LANG_KEY = 'mdc_lang';

let currentLang = 'id'; // 'id' | 'en'

let rows = [];
let sessions = [];
let view = [];        // baris setelah filter
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

// Pending import state
let stagedImport = null;

const keyOf = (r) => r.key || r.url;

/* ── KAMUS BILINGUAL (I18N) ──────────────────────────────────── */

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
  }
};

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

function updateFilterOptionTexts() {
  const isEn = currentLang === 'en';

  // Sesi
  if ($('session').options[0]) {
    $('session').options[0].textContent = `${isEn ? 'All sessions' : 'Semua sesi'} (${rows.length})`;
  }

  // Peluang
  const oppOpts = [
    ['all', isEn ? 'Opportunity: all' : 'Peluang: semua'],
    ['web-pitch', isEn ? '🌐 Needs Website' : '🌐 Butuh Website'],
    ['reputation-fix', isEn ? '🛡️ Reputation Fix' : '🛡️ Perlu Reputasi'],
    ['high-value', isEn ? '⭐ High Value Lead' : '⭐ High Value Lead'],
    ['outreach-ready', isEn ? '⚡ Outreach Ready' : '⚡ Kontak Siap'],
    ['standard', isEn ? '📍 Standard Lead' : '📍 Standard Lead'],
  ];
  for (let i = 0; i < oppOpts.length; i++) {
    if ($('fOpp').options[i]) $('fOpp').options[i].textContent = oppOpts[i][1];
  }

  // Website
  const webOpts = [
    ['all', isEn ? 'Website: all' : 'Website: semua'],
    ['no', isEn ? 'No website' : 'Tanpa website'],
    ['yes', isEn ? 'Has website' : 'Ada website'],
  ];
  for (let i = 0; i < webOpts.length; i++) {
    if ($('fWebsite').options[i]) $('fWebsite').options[i].textContent = webOpts[i][1];
  }

  // Phone
  const phoneOpts = [
    ['all', isEn ? 'Phone: all' : 'Telepon: semua'],
    ['no', isEn ? 'No phone' : 'Tanpa telepon'],
    ['yes', isEn ? 'Has phone' : 'Ada telepon'],
  ];
  for (let i = 0; i < phoneOpts.length; i++) {
    if ($('fPhone').options[i]) $('fPhone').options[i].textContent = phoneOpts[i][1];
  }

  // Status
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
    if ($('fStatus').options[i]) $('fStatus').options[i].textContent = statusOpts[i][1];
  }

  // Email
  const emailOpts = [
    ['all', isEn ? 'Email: all' : 'Email: semua'],
    ['yes', isEn ? 'Has email' : 'Ada email'],
    ['no', isEn ? 'No email' : 'Tanpa email'],
  ];
  for (let i = 0; i < emailOpts.length; i++) {
    if ($('fEmail').options[i]) $('fEmail').options[i].textContent = emailOpts[i][1];
  }

  // Social
  const socOpts = [
    ['all', isEn ? 'Socials: all' : 'Sosial: semua'],
    ['yes', isEn ? 'Has socials' : 'Ada sosial media'],
    ['no', isEn ? 'No socials' : 'Tanpa sosial media'],
  ];
  for (let i = 0; i < socOpts.length; i++) {
    if ($('fSocial').options[i]) $('fSocial').options[i].textContent = socOpts[i][1];
  }

  // Rating
  const rateOpts = [
    ['all', isEn ? 'Rating: all' : 'Rating: semua'],
    ['lt4', '< 4.0'],
    ['gte4', '≥ 4.0'],
    ['gte45', '≥ 4.5'],
    ['none', isEn ? 'No rating' : 'Tanpa rating'],
  ];
  for (let i = 0; i < rateOpts.length; i++) {
    if ($('fRating').options[i]) $('fRating').options[i].textContent = rateOpts[i][1];
  }

  // Sort
  const sortOpts = [
    ['default', isEn ? 'Default order' : 'Urutan asli'],
    ['score', isEn ? 'Lead Score (High → Low)' : 'Skor Peluang (Tinggi → Rendah)'],
    ['name', isEn ? 'Name A–Z' : 'Nama A–Z'],
    ['rating', isEn ? 'Highest Rating' : 'Rating tertinggi'],
    ['reviews', isEn ? 'Most Reviews' : 'Review terbanyak'],
    ['category', isEn ? 'Category A–Z' : 'Kategori A–Z'],
  ];
  for (let i = 0; i < sortOpts.length; i++) {
    if ($('sort').options[i]) $('sort').options[i].textContent = sortOpts[i][1];
  }

  // Batch status selector
  if ($('batchStatusSel').options[0]) {
    $('batchStatusSel').options[0].textContent = isEn ? 'Bulk update status…' : 'Ubah status massal…';
  }
}

function applyI18n() {
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

  updateFilterOptionTexts();
}

function setLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'id';
  chrome.storage.local.set({ [LANG_KEY]: currentLang });
  $('langId').classList.toggle('on', currentLang === 'id');
  $('langEn').classList.toggle('on', currentLang === 'en');
  applyI18n();
  lastSig = '';
  draw();
  if (activeDrawerKey) {
    const row = rows.find((r) => keyOf(r) === activeDrawerKey);
    if (row) openDrawer(row);
  }
}

$('langId').addEventListener('click', () => setLang('id'));
$('langEn').addEventListener('click', () => setLang('en'));

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

/* ── PREFERENSI TAMPILAN ─────────────────────────────────────── */

async function loadPrefs() {
  const o = await chrome.storage.local.get([PREFS_KEY, LANG_KEY]);
  const p = o[PREFS_KEY] || {};
  mode = p.mode === 'card' ? 'card' : 'table';
  perPage = [25, 50, 100, 250].includes(p.perPage) ? p.perPage : 50;
  $('perPage').value = String(perPage);

  currentLang = o[LANG_KEY] === 'en' ? 'en' : 'id';
  $('langId').classList.toggle('on', currentLang === 'id');
  $('langEn').classList.toggle('on', currentLang === 'en');
  applyI18n();

  setMode(mode, false);
}

function savePrefs() {
  chrome.storage.local.set({ [PREFS_KEY]: { mode, perPage } });
}

/* ── FILTER & SORT ───────────────────────────────────────────── */

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

    // Filter Peluang
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
  if (sort === 'score') {
    view.sort((a, b) => (getOpportunity(b).score || 0) - (getOpportunity(a).score || 0));
  } else if (sort === 'opp') {
    view.sort((a, b) => {
      const isEn = currentLang === 'en';
      const la = isEn ? (getOpportunity(a).labelEn || getOpportunity(a).label) : getOpportunity(a).label;
      const lb = isEn ? (getOpportunity(b).labelEn || getOpportunity(b).label) : getOpportunity(b).label;
      return la.localeCompare(lb, currentLang === 'en' ? 'en' : 'id');
    });
  } else if (sort === 'name') {
    view.sort((a, b) => (a.name || '').localeCompare(b.name || '', currentLang === 'en' ? 'en' : 'id'));
  } else if (sort === 'rating') {
    view.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'reviews') {
    view.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  } else if (sort === 'category') {
    view.sort((a, b) => (a.category || '').localeCompare(b.category || '', currentLang === 'en' ? 'en' : 'id'));
  }

  $('reset').hidden = !filtersActive();

  const maxPage = Math.max(1, Math.ceil(view.length / perPage));
  if (page > maxPage) page = maxPage;
}

function pageRows() {
  const start = (page - 1) * perPage;
  return view.slice(start, start + perPage);
}

/* ── ELEMEN UI ───────────────────────────────────────────────── */

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
  const isEn = currentLang === 'en';
  const label = row.enrichedAt ? (isEn ? 'no website' : 'tidak punya') : (isEn ? 'not checked' : 'belum ada');
  return tag(label, row.enrichedAt ? 'dim' : 'none');
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
  
  const isEn = currentLang === 'en';
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

function emailCell(r) {
  const container = document.createElement('div');
  const isEn = currentLang === 'en';
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

  const soc = socialsEl(r.socials);
  if (soc) container.appendChild(soc);
  return container;
}

function delButton(r) {
  const b = document.createElement('button');
  b.className = 'rowdel';
  b.textContent = '×';
  b.title = currentLang === 'en' ? 'Delete this row' : 'Hapus baris ini';
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
  return currentLang === 'en' ? String(r.rating) : String(r.rating).replace('.', ',');
}

/* ── SKELETON LOADING ────────────────────────────────────────── */

function renderSkeleton() {
  const tb = $('tbody');
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

/* ── RENDER TABEL ────────────────────────────────────────────── */

function renderTable(list) {
  const tb = $('tbody');
  tb.textContent = '';
  const frag = document.createDocumentFragment();
  const isEn = currentLang === 'en';

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

    // Peluang Badge (Lead Radar)
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

    // Nama
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

/* ── RENDER KARTU ────────────────────────────────────────────── */

function renderCards(list) {
  const wrap = $('cardWrap');
  wrap.textContent = '';
  const frag = document.createDocumentFragment();
  const isEn = currentLang === 'en';

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

    // Opportunity Row
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
  const isEn = currentLang === 'en';
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
  const isEn = currentLang === 'en';
  showToast(isEn ? `Status updated for ${selectedKeys.size} leads` : `Status ${selectedKeys.size} baris berhasil diperbarui`, 'success');
  $('batchStatusSel').value = '';
  selectedKeys.clear();
  ver = -1;
  lastSig = '';
  refresh();
});

$('batchDelete').addEventListener('click', async () => {
  if (!selectedKeys.size) return;
  const isEn = currentLang === 'en';
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
  const isEn = currentLang === 'en';
  showToast(isEn ? `${selectedRows.length} selected leads exported to CSV` : `${selectedRows.length} tempat terpilih diekspor ke CSV`, 'success');
});

/* ── QUICK DETAIL DRAWER ─────────────────────────────────────── */

function openDrawer(r) {
  activeDrawerKey = keyOf(r);
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
  if (r.rating != null) badges.appendChild(tag(`★ ${ratingText(r)} (${r.reviews || 0})`, 'dim'));
  if (r.category) badges.appendChild(tag(r.category, 'dim'));
  if (!has(r.website)) badges.appendChild(tag(isEn ? 'No Website' : 'Tanpa Website', 'none'));

  // Peluang & Skor
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

  // CRM controls
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

/* ── VISUAL ANALYTICS ────────────────────────────────────────── */

function renderAnalytics() {
  const panel = $('analyticsPanel');
  if (panel.hidden) return;
  const isEn = currentLang === 'en';

  // 1. Radar Peluang Lead
  const oppWrap = $('analyticsOpportunity');
  oppWrap.textContent = '';
  const oppCounts = {};
  for (const ot of OPPORTUNITY_TYPES) oppCounts[ot.id] = 0;
  for (const r of rows) {
    const opp = getOpportunity(r);
    oppCounts[opp.id] = (oppCounts[opp.id] || 0) + 1;
  }
  for (const ot of OPPORTUNITY_TYPES) {
    const cnt = oppCounts[ot.id] || 0;
    const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    const label = isEn ? (ot.shortLabelEn || ot.shortLabel) : ot.shortLabel;
    row.innerHTML = `
      <div class="chart-bar-label"><span>${ot.icon} ${label}</span><span>${cnt} (${pct}%)</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
    `;
    oppWrap.appendChild(row);
  }

  // 2. CRM Funnel
  const funnelWrap = $('analyticsFunnel');
  funnelWrap.textContent = '';
  const statusCounts = { baru: 0, dihubungi: 0, followup: 0, deal: 0, tolak: 0, none: 0 };
  for (const r of rows) {
    const s = r.status || 'none';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  const statusLabels = {
    '': '—',
    'baru': isEn ? 'New Lead' : 'Baru',
    'dihubungi': isEn ? 'Contacted' : 'Dihubungi',
    'followup': 'Follow-up',
    'deal': isEn ? 'Closed Deal' : 'Deal',
    'tolak': isEn ? 'Not Interested' : 'Tidak tertarik',
  };

  for (const st of STATUSES) {
    const key = st.v || 'none';
    const cnt = statusCounts[key] || 0;
    const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    const label = statusLabels[st.v] || st.label;
    row.innerHTML = `
      <div class="chart-bar-label"><span>${label}</span><span>${cnt} (${pct}%)</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
    `;
    funnelWrap.appendChild(row);
  }

  // 3. Top Categories
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

  // 4. Completeness
  const compWrap = $('analyticsCompleteness');
  compWrap.textContent = '';
  const nPhone = rows.filter((r) => has(r.phone)).length;
  const nSite = rows.filter((r) => has(r.website)).length;
  const nEmail = rows.filter((r) => has(r.email)).length;
  const nSocial = rows.filter((r) => Array.isArray(r.socials) && r.socials.length > 0).length;

  const compList = isEn
    ? [['Phone', nPhone], ['Website', nSite], ['Email', nEmail], ['Socials', nSocial]]
    : [['Telepon', nPhone], ['Website', nSite], ['Email', nEmail], ['Sosial', nSocial]];

  for (const [label, cnt] of compList) {
    const pct = rows.length ? Math.round((cnt / rows.length) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <div class="chart-bar-label"><span>${label}</span><span>${cnt} (${pct}%)</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
    `;
    compWrap.appendChild(row);
  }

  // 5. Rating Distribution
  const rateWrap = $('analyticsRating');
  rateWrap.textContent = '';
  const rHigh = rows.filter((r) => r.rating != null && r.rating >= 4.5).length;
  const rMid = rows.filter((r) => r.rating != null && r.rating >= 4.0 && r.rating < 4.5).length;
  const rLow = rows.filter((r) => r.rating != null && r.rating < 4.0).length;

  for (const [label, cnt] of [['≥ 4.5 Star', rHigh], ['4.0 - 4.4 Star', rMid], ['< 4.0 Star', rLow]]) {
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

/* ── PAGINATION & DRAW ───────────────────────────────────────── */

function renderPager() {
  const total = view.length;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  $('pager').hidden = total === 0;
  if (!total) return;

  const isEn = currentLang === 'en';
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

/* ── STATISTIK & PROGRESS ────────────────────────────────────── */

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
  const isEn = currentLang === 'en';

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
  const isEn = currentLang === 'en';
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

/* ── REFRESH DATA ────────────────────────────────────────────── */

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

/* ── MODAL IMPORT & RESTORE LOGIC ────────────────────────────── */

function openImportModal(initialMode = 'merge') {
  stagedImport = null;
  $('importFileInput').value = '';
  $('importPreview').hidden = true;
  $('btnDoImport').disabled = true;
  const radios = document.getElementsByName('importMode');
  for (const r of radios) {
    r.checked = r.value === initialMode;
  }
  $('importOverlay').hidden = false;
}

function closeImportModal() {
  $('importOverlay').hidden = true;
  stagedImport = null;
}

$('btnOpenImport').addEventListener('click', () => openImportModal('merge'));
$('btnMenuImport').addEventListener('click', () => openImportModal('merge'));
$('btnMenuRestore').addEventListener('click', () => openImportModal('restore'));
$('importClose').addEventListener('click', closeImportModal);
$('btnCancelImport').addEventListener('click', closeImportModal);

const dropzone = $('importDropzone');
const fileInput = $('importFileInput');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleImportFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleImportFile(e.target.files[0]);
  }
});

function handleImportFile(file) {
  const reader = new FileReader();
  const isEn = currentLang === 'en';
  reader.onload = () => {
    try {
      const text = reader.result;
      const isJson = file.name.endsWith('.json');
      let valid = [];
      let rejected = 0;
      let backupSessions = [];
      let isBackup = false;

      if (isJson) {
        const parsed = parseJSON(text);
        if (parsed.type === 'backup') {
          isBackup = true;
          backupSessions = parsed.sessions || [];
          valid = parsed.rows || [];
        } else {
          valid = parsed.rows || [];
        }
      } else {
        const raw = parseCSV(text);
        const res = validateAndNormalize(raw);
        valid = res.valid;
        rejected = res.rejected;
      }

      if (!valid.length) {
        showToast(isEn ? 'No valid leads found in this file.' : 'Tidak ditemukan data tempat yang valid di file ini.', 'error');
        return;
      }

      stagedImport = {
        fileName: file.name,
        rows: valid,
        sessions: backupSessions,
        isBackup,
      };

      $('impFileName').textContent = file.name;
      $('impFileType').textContent = isBackup ? 'BACKUP JSON' : (isJson ? 'JSON' : 'CSV');
      $('impValidCount').textContent = valid.length;
      $('impInvalidCount').textContent = rejected;
      $('impInvalidWrap').hidden = rejected === 0;

      // Default jika file backup: sarankan restore
      if (isBackup) {
        const rRestore = document.querySelector('input[name="importMode"][value="restore"]');
        if (rRestore) rRestore.checked = true;
      }

      $('importPreview').hidden = false;
      $('btnDoImport').disabled = false;
    } catch (err) {
      showToast((isEn ? 'Failed to read file: ' : 'Gagal membaca file: ') + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

$('btnDoImport').addEventListener('click', async () => {
  if (!stagedImport || !stagedImport.rows.length) return;
  const isEn = currentLang === 'en';

  const modeRadio = document.querySelector('input[name="importMode"]:checked');
  const selectedMode = modeRadio ? modeRadio.value : 'merge';

  if (selectedMode === 'restore') {
    const confirmMsg = isEn
      ? `This action will REPLACE your entire database with ${stagedImport.rows.length} leads from this file. Continue?`
      : `Tindakan ini akan MENGGANTIKAN seluruh database lama dengan ${stagedImport.rows.length} tempat dari file. Lanjutkan?`;
    if (!confirm(confirmMsg)) return;

    const res = await send({
      type: 'RESTORE_BACKUP',
      rows: stagedImport.rows,
      sessions: stagedImport.sessions,
    });
    if (res.ok) {
      showToast(isEn ? `Restore successful! ${res.rowsCount} leads restored.` : `Restore berhasil! ${res.rowsCount} tempat dipulihkan.`, 'success');
      closeImportModal();
      ver = -1;
      page = 1;
      selectedKeys.clear();
      lastSig = '';
      refresh();
    } else {
      showToast((isEn ? 'Failed to restore: ' : 'Gagal memulihkan database: ') + res.error, 'error');
    }
  } else {
    // Mode Merge
    const res = await send({
      type: 'IMPORT_ROWS',
      rows: stagedImport.rows,
      sessionLabel: `${isEn ? 'Import' : 'Impor'} (${stagedImport.fileName})`,
    });
    if (res.ok) {
      showToast(
        isEn
          ? `Successfully imported ${stagedImport.rows.length} leads (${res.added} new added).`
          : `Berhasil mengimpor ${stagedImport.rows.length} tempat (${res.added} tempat baru ditambahkan).`,
        'success'
      );
      closeImportModal();
      ver = -1;
      lastSig = '';
      refresh();
    } else {
      showToast((isEn ? 'Import failed: ' : 'Gagal mengimpor: ') + res.error, 'error');
    }
  }
});

/* ── BACKUP DATABASE ACTION ──────────────────────────────────── */

$('btnBackup').addEventListener('click', async () => {
  const isEn = currentLang === 'en';
  const res = await send({ type: 'GET_BACKUP' });
  if (res && res.ok) {
    downloadBackup(res.rows, res.sessions);
    showToast(isEn ? `Database backup (${res.rows.length} leads) downloaded!` : `File backup database (${res.rows.length} tempat) berhasil diunduh!`, 'success');
  } else {
    showToast((isEn ? 'Backup failed: ' : 'Gagal membuat backup: ') + (res ? res.error : 'tanpa respons'), 'error');
  }
});

/* ── EVENTS FILTER ───────────────────────────────────────────── */

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
    closeDrawer();
    closeImportModal();
  }
});

$('enrich').addEventListener('click', async () => {
  const isEn = currentLang === 'en';
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
  const isEn = currentLang === 'en';
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
  const isEn = currentLang === 'en';
  await send({ type: 'STOP' });
  showToast(isEn ? 'Crawl stopped.' : 'Crawl dihentikan.', 'info');
  refresh();
});

$('clear').addEventListener('click', async () => {
  const isEn = currentLang === 'en';
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
  const isEn = currentLang === 'en';
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

// Exports & Copies
$('csv').addEventListener('click', () => {
  downloadCSV(view);
  const isEn = currentLang === 'en';
  showToast(isEn ? `${view.length} leads exported to CSV` : `${view.length} baris diekspor ke CSV`, 'success');
});
$('excel').addEventListener('click', () => {
  downloadExcel(view);
  const isEn = currentLang === 'en';
  showToast(isEn ? `${view.length} leads exported to Excel (.xls)` : `${view.length} baris diekspor ke Excel (.xls)`, 'success');
});
$('json').addEventListener('click', () => {
  downloadJSON(view);
  const isEn = currentLang === 'en';
  showToast(isEn ? `${view.length} leads exported to JSON` : `${view.length} baris diekspor ke JSON`, 'success');
});
$('copy').addEventListener('click', async () => {
  const isEn = currentLang === 'en';
  try {
    await navigator.clipboard.writeText(toTSV(view));
    showToast(isEn ? `${view.length} leads copied to clipboard!` : `${view.length} baris disalin ke clipboard!`, 'success');
  } catch (_) {}
});
$('copyEmails').addEventListener('click', async () => {
  const isEn = currentLang === 'en';
  const list = extractEmailList(view);
  if (!list) return showToast(isEn ? 'No emails found to copy in this filter.' : 'Tidak ada email untuk disalin pada filter ini.', 'error');
  await navigator.clipboard.writeText(list);
  showToast(isEn ? 'Email list copied to clipboard!' : 'Daftar email berhasil disalin ke clipboard!', 'success');
});
$('copyPhones').addEventListener('click', async () => {
  const isEn = currentLang === 'en';
  const list = extractPhoneList(view);
  if (!list) return showToast(isEn ? 'No phone numbers found to copy in this filter.' : 'Tidak ada nomor telepon untuk disalin pada filter ini.', 'error');
  await navigator.clipboard.writeText(list);
  showToast(isEn ? 'Phone list copied to clipboard!' : 'Daftar nomor telepon berhasil disalin ke clipboard!', 'success');
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
