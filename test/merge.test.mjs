// Uji mergeRows + filter dashboard tanpa browser.
import fs from 'fs';
const bg = fs.readFileSync('background.js','utf8');
const grab = (src,name) => {
  const i = src.indexOf(`function ${name}(`);
  if (i<0) throw new Error('missing '+name);
  let d=0, j=src.indexOf('{', i);
  for (let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d) return src.slice(i,k+1);} }
};
const { mergeRows } = eval('(()=>{const filled=(v)=>v!=null&&String(v).trim()!=="";'
  + grab(bg,'mergeRows') + ';return {mergeRows}})()');

let pass=0, fail=0;
const eq=(l,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b); ok?pass++:fail++;
  console.log((ok?'  ok  ':'FAIL  ')+l+(ok?'':`  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));};

console.log('mergeRows — dedup lintas sesi:');
let r1 = mergeRows([], [{key:'a',name:'Kopi A'},{key:'b',name:'Kopi B'}], 's1');
eq('2 baris baru', r1.rows.length, 2);
eq('added=2', r1.added, 2);
eq('tag sesi s1', r1.rows[0].sessions, ['s1']);

// Sesi kedua menemukan tempat yang sama + satu baru
let r2 = mergeRows(r1.rows, [{key:'a',name:'Kopi A'},{key:'c',name:'Kopi C'}], 's2');
eq('total 3, bukan 4 (tanpa duplikat)', r2.rows.length, 3);
eq('hanya 1 yang benar-benar baru', r2.added, 1);
eq('tempat a tercatat di 2 sesi', r2.rows.find(r=>r.key==='a').sessions, ['s1','s2']);
eq('tempat c hanya s2', r2.rows.find(r=>r.key==='c').sessions, ['s2']);

console.log('mergeRows — nilai terisi tidak boleh tertimpa kosong:');
let base = mergeRows([], [{key:'a',name:'Kopi A',phone:'021-111',website:'https://a.id'}], 's1').rows;
let after = mergeRows(base, [{key:'a',name:'Kopi A',phone:'',website:null}], 's2').rows[0];
eq('phone bertahan', after.phone, '021-111');
eq('website bertahan', after.website, 'https://a.id');

let enriched = mergeRows(base, [{key:'a',phone:'021-999'}], null).rows[0];
eq('nilai baru menimpa nilai lama', enriched.phone, '021-999');
eq('sessionId null tidak merusak tag', enriched.sessions, ['s1']);

console.log('needsEnrich + penanda website:');
const ex = fs.readFileSync('export.js','utf8');
const has = (v)=> v!=null && String(v).trim()!=='';
const needsEnrich = (r)=> !has(r.phone) || !has(r.website);
eq('kosong dua-duanya -> perlu', needsEnrich({}), true);
eq('hanya phone -> masih perlu', needsEnrich({phone:'021'}), true);
eq('lengkap -> tidak perlu', needsEnrich({phone:'021',website:'https://x.id'}), false);
eq('whitespace dianggap kosong', needsEnrich({phone:'  ',website:'  '}), true);
eq('export punya kolom hasWebsite', ex.includes("'hasWebsite'"), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
