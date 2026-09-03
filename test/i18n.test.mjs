// Uji kamus dan konsistensi modul i18n
import test from 'node:test';
import assert from 'node:assert/strict';
import i18nModule from '../i18n.js';

test('i18n Module — Dictionary Consistency & Completeness', async (t) => {
  const { I18N, LANG_KEY } = i18nModule;

  await t.test('LANG_KEY is mdc_lang', () => {
    assert.equal(LANG_KEY, 'mdc_lang');
  });

  await t.test('kamus id dan en keduanya terdefinisi', () => {
    assert.ok(I18N.id, 'kamus id harus ada');
    assert.ok(I18N.en, 'kamus en harus ada');
    assert.ok(Object.keys(I18N.id).length > 20, 'kamus id harus memiliki banyak entri');
    assert.ok(Object.keys(I18N.en).length > 20, 'kamus en harus memiliki banyak entri');
  });

  await t.test('setiap key di kamus ID memiliki pasangan di kamus EN', () => {
    const idKeys = Object.keys(I18N.id);
    const enKeys = new Set(Object.keys(I18N.en));

    const missingInEn = idKeys.filter((k) => !enKeys.has(k));
    assert.deepEqual(missingInEn, [], 'semua key ID harus ada di EN');
  });

  await t.test('setiap key di kamus EN memiliki pasangan di kamus ID', () => {
    const enKeys = Object.keys(I18N.en);
    const idKeys = new Set(Object.keys(I18N.id));

    const missingInId = enKeys.filter((k) => !idKeys.has(k));
    assert.deepEqual(missingInId, [], 'semua key EN harus ada di ID');
  });
});
