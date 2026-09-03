import test from 'node:test';
import assert from 'node:assert/strict';
import importPkg from '../import.js';
const { parseCSV, parseJSON, normalizeRow, validateAndNormalize } = importPkg;

test('Import Module — CSV & JSON Parser & Validator', async (t) => {
  await t.test('parseCSV: parsing baris sederhana & formula injection stripping', () => {
    const csv = 'name,category,rating,reviews,phone\r\n"Kafe Santai","Kafe",4.5,120,"\'=1+2"';
    const parsed = parseCSV(csv);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Kafe Santai');
    assert.equal(parsed[0].category, 'Kafe');
    assert.equal(parsed[0].rating, '4.5');
    assert.equal(parsed[0].reviews, '120');
    assert.equal(parsed[0].phone, '=1+2'); // single quote formula escape removed
  });

  await t.test('parseCSV: penanganan kutip ter-escape dan multiline cell', () => {
    const csv = 'name,note,address\r\n"Klinik ""Sehat""","Baris 1\nBaris 2","Jl. Melati No. 5"';
    const parsed = parseCSV(csv);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Klinik "Sehat"');
    assert.equal(parsed[0].note, 'Baris 1\nBaris 2');
    assert.equal(parsed[0].address, 'Jl. Melati No. 5');
  });

  await t.test('parseCSV: strip UTF-8 BOM secara otomatis', () => {
    const csvWithBom = '\uFEFFname,phone\r\n"Toko ABC","08123456"';
    const parsed = parseCSV(csvWithBom);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Toko ABC');
    assert.equal(parsed[0].phone, '08123456');
  });

  await t.test('parseJSON: membaca format array baris tempat', () => {
    const json = JSON.stringify([
      { name: 'Tempat A', rating: 4.5, phone: '081' },
      { name: 'Tempat B', rating: 3.8, website: 'https://b.com' },
    ]);
    const res = parseJSON(json);
    assert.equal(res.type, 'rows');
    assert.equal(res.rows.length, 2);
    assert.equal(res.rows[0].name, 'Tempat A');
    assert.equal(res.rows[0].rating, 4.5);
  });

  await t.test('parseJSON: membaca format Full Backup Database', () => {
    const backup = JSON.stringify({
      version: '1.3.0',
      exportedAt: '2026-09-03T16:00:00Z',
      sessions: [{ id: 's1', label: 'kafe bandung' }],
      rows: [
        { name: 'Kopi Enak', phone: '08999', tags: ['VIP', 'Kopi'] },
      ],
    });
    const res = parseJSON(backup);
    assert.equal(res.type, 'backup');
    assert.equal(res.version, '1.3.0');
    assert.equal(res.sessions.length, 1);
    assert.equal(res.rows.length, 1);
    assert.deepEqual(res.rows[0].tags, ['VIP', 'Kopi']);
  });

  await t.test('normalizeRow & validateAndNormalize: pembersihan dan penolakan data tanpa nama', () => {
    const rawList = [
      { nama: 'Toko Sukses', telepon: '08111', bintang: '4,7', ulasan: '1.200' },
      { category: 'Hanya Kategori Tanpa Nama' }, // should be rejected
      { name: 'Hotel Sentosa', rating: '4.2', tags: 'VIP, Promo' },
    ];
    const { valid, rejected } = validateAndNormalize(rawList);
    assert.equal(valid.length, 2);
    assert.equal(rejected, 1);
    assert.equal(valid[0].name, 'Toko Sukses');
    assert.equal(valid[0].phone, '08111');
    assert.equal(valid[0].rating, 4.7);
    assert.equal(valid[0].reviews, 1200);
    assert.deepEqual(valid[1].tags, ['VIP', 'Promo']);
  });
});
