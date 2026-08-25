// Anotasi manual (status/catatan) tidak boleh hilang saat crawl ulang.
import fs from 'fs';
const bg = fs.readFileSync('background.js','utf8');
const grab = (name) => {
  const i = bg.indexOf(`function ${name}(`);
  let d=0, st=bg.indexOf('{', i);
  for (let k=st;k<bg.length;k++){ if(bg[k]==='{')d++; else if(bg[k]==='}'){d--; if(!d) return bg.slice(i,k+1);} }
};
const { mergeRows } = eval('(()=>{const filled=(v)=>v!=null&&String(v).trim()!=="";'
  + grab('mergeRows') + ';return {mergeRows}})()');

let pass=0, fail=0;
const eq=(l,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b); ok?pass++:fail++;
  console.log((ok?'  ok  ':'FAIL  ')+l+(ok?'':`  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));};

// Baris yang sudah ditandai user
const tagged = mergeRows([], [{key:'a', name:'Kopi A', phone:'021-1'}], 's1').rows;
tagged[0].status = 'dihubungi';
tagged[0].note   = 'minta ditelpon Senin';

console.log('crawl ulang menemukan tempat yang sama:');
let after = mergeRows(tagged, [{key:'a', name:'Kopi A', phone:'021-1', rating:4.5}], 's2').rows[0];
eq('status bertahan', after.status, 'dihubungi');
eq('catatan bertahan', after.note, 'minta ditelpon Senin');
eq('data crawl tetap diperbarui', after.rating, 4.5);
eq('sesi bertambah', after.sessions, ['s1','s2']);

console.log('enrich menimpa kontak, bukan anotasi:');
let enriched = mergeRows(tagged, [{key:'a', phone:'021-999', website:'https://a.id'}], null).rows[0];
eq('telepon diperbarui', enriched.phone, '021-999');
eq('website terisi', enriched.website, 'https://a.id');
eq('status tetap', enriched.status, 'dihubungi');
eq('catatan tetap', enriched.note, 'minta ditelpon Senin');

console.log('user boleh mengubah / mengosongkan sendiri:');
// SET_FIELD menulis langsung ke array, bukan lewat merge — pastikan tidak dikembalikan.
let rows = JSON.parse(JSON.stringify(tagged));
rows[0].status = 'deal';
rows[0].note = '';
let reMerged = mergeRows(rows, [{key:'a', name:'Kopi A'}], 's3').rows[0];
eq('status baru dipertahankan', reMerged.status, 'deal');
eq('catatan yang dikosongkan tetap kosong', reMerged.note || '', '');

console.log('baris baru tidak terpengaruh:');
let fresh = mergeRows(tagged, [{key:'b', name:'Kopi B'}], 's2').rows.find(r=>r.key==='b');
eq('tanpa status', fresh.status, undefined);
eq('tanpa catatan', fresh.note, undefined);

console.log('kolom export mencakup field baru:');
const ex = fs.readFileSync('export.js','utf8');
for (const c of ['email','emailsAll','status','note'])
  eq(`kolom ${c}`, ex.includes(`'${c}'`), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
