/* Popup: render state dari background + jalankan export. Tidak menyimpan state sendiri. */

const $ = (id) => document.getElementById(id);

const { toTSV, downloadCSV, downloadExcel, downloadJSON } = window.MDCExport;

const send = (msg) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const err = chrome.runtime.lastError;
      resolve(err ? { ok: false, error: err.message } : res || { ok: false, error: 'tanpa respons' });
    });
  });

let rows = [];

function flash(text, isError = false) {
  const el = $('message');
  el.textContent = text;
  el.style.color = isError ? 'var(--danger)' : '';
}

function render(state) {
  const running = ['collecting', 'detailing', 'enriching', 'emailing'].includes(state.status);

  $('badge').textContent = state.status;
  $('badge').className = 'badge ' + state.status;
  $('count').textContent = `${rows.length} tempat`;
  if (state.message) flash(state.message, state.status === 'error');

  // Fase collect tidak punya total pasti, jadi pakai maxResults sebagai perkiraan.
  let pct = 0;
  if (['detailing', 'enriching', 'emailing'].includes(state.status) && state.detailTotal) {
    pct = (state.detailIndex / state.detailTotal) * 100;
  } else if (state.status === 'collecting') {
    pct = Math.min(100, (state.collected / (state.options?.maxResults || 120)) * 100);
  } else if (state.status === 'done') {
    pct = 100;
  }
  $('fill').style.width = pct + '%';

  $('start').disabled = running;
  $('stop').disabled = !running;
  for (const id of ['csv', 'excel', 'json', 'copy', 'send']) $(id).disabled = rows.length === 0;
  $('clear').disabled = running || rows.length === 0;

  const errs = state.errors || [];
  $('errBox').hidden = errs.length === 0;
  $('errCount').textContent = errs.length;
  const list = $('errList');
  list.textContent = '';
  for (const e of errs.slice(-15)) {
    const li = document.createElement('li');
    li.textContent = e;
    list.appendChild(li);
  }

  if (state.options) {
    if (!$('maxResults').matches(':focus')) $('maxResults').value = state.options.maxResults;
    if (!$('detailDelay').matches(':focus')) $('detailDelay').value = state.options.detailDelayMs;
    $('withDetail').checked = state.options.withDetail !== false;
  }
}

async function refresh() {
  const res = await send({ type: 'GET_STATE' });
  if (!res.ok) return flash(res.error, true);
  if (Array.isArray(res.rows)) rows = res.rows;
  render(res.state);
}

// --- events --------------------------------------------------------------

$('start').addEventListener('click', async () => {
  const options = {
    maxResults: Math.max(1, Math.min(500, parseInt($('maxResults').value, 10) || 120)),
    detailDelayMs: Math.max(400, Math.min(8000, parseInt($('detailDelay').value, 10) || 1200)),
    withDetail: $('withDetail').checked,
  };
  const res = await send({ type: 'START', options });
  if (!res.ok) flash(res.error, true);
  refresh();
});

$('stop').addEventListener('click', async () => {
  await send({ type: 'STOP' });
  refresh();
});

$('clear').addEventListener('click', async () => {
  await send({ type: 'CLEAR' });
  refresh();
});

$('csv').addEventListener('click', () => downloadCSV(rows));
$('excel').addEventListener('click', () => downloadExcel(rows));
$('json').addEventListener('click', () => downloadJSON(rows));

$('dash').addEventListener('click', () => send({ type: 'OPEN_DASHBOARD' }));

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(toTSV(rows));
    flash(`${rows.length} baris disalin — paste ke spreadsheet.`);
  } catch (e) {
    flash('Gagal menyalin: ' + e.message, true);
  }
});

$('send').addEventListener('click', async () => {
  const url = $('webhookUrl').value.trim();
  if (!url) return flash('Isi URL webhook dulu.', true);
  let origin;
  try {
    if (!/^https:\/\//i.test(url)) throw new Error('Webhook harus memakai HTTPS.');
    origin = new URL(url).origin + '/*';
  } catch (e) {
    return flash(e.message || 'URL webhook tidak valid.', true);
  }

  // permissions.request wajib dipanggil dari klik user, jadi harus di popup.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return flash('Izin ke domain webhook ditolak.', true);

  await chrome.storage.local.set({ mdc_webhook: url });
  flash('Mengirim…');
  const res = await send({ type: 'WEBHOOK', url });
  flash(res.ok ? `Terkirim: ${res.count} baris.` : res.error, !res.ok);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'STATE') refresh();
});

chrome.storage.local.get('mdc_webhook').then((o) => {
  if (o.mdc_webhook) $('webhookUrl').value = o.mdc_webhook;
});

// Pesan STATE hilang saat popup tertutup; polling ringan menjaga UI tetap sinkron.
setInterval(refresh, 1000);
refresh();
