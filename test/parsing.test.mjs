// Ekstrak fungsi murni dari content.js/popup.js dan uji tanpa DOM.
import fs from 'fs';
const src = fs.readFileSync('content.js','utf8');
const grab = (name) => {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error('not found: '+name);
  let d=0, j=src.indexOf('{', i);
  for (let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d) return src.slice(i,k+1);} }
};
const mod = eval('(()=>{' + ['num','intFrom','latLngFrom','keyFrom'].map(grab).join('\n') + ';return {num,intFrom,latLngFrom,keyFrom}})()');

let pass=0, fail=0;
const eq=(label,a,b)=>{ const ok=JSON.stringify(a)===JSON.stringify(b);
  ok?pass++:fail++; console.log((ok?'  ok  ':'FAIL  ')+label+(ok?'':`  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`)); };

console.log('num / rating:');
eq('id-ID "4,5"', mod.num('4,5'), 4.5);
eq('en-US "4.5"', mod.num('4.5'), 4.5);
eq('embedded', mod.num('Rating 3,8 bintang'), 3.8);
eq('none', mod.num('tidak ada'), null);

console.log('intFrom / review count:');
eq('id "1.234"', mod.intFrom('1.234'), 1234);
eq('en "1,234"', mod.intFrom('1,234'), 1234);
eq('paren "(89)"', mod.intFrom('(89)'), 89);
eq('empty', mod.intFrom('ulasan'), null);

console.log('latLngFrom:');
const u='https://www.google.com/maps/place/Kopi/@-6.9,107.6,17z/data=!3m1!4b1!4m6!3m5!1s0x2e68e6:0xabc!8m2!3d-6.914744!4d107.609810';
eq('prefers !3d!4d', mod.latLngFrom(u), {lat:-6.914744, lng:107.609810});
eq('fallback @', mod.latLngFrom('https://www.google.com/maps/@-6.2,106.8,15z'), {lat:-6.2, lng:106.8});
eq('none', mod.latLngFrom('https://www.google.com/maps'), {lat:null,lng:null});

console.log('keyFrom / dedup:');
eq('place id token', mod.keyFrom(u), '0x2e68e6:0xabc');
eq('same place, diff zoom share key',
   mod.keyFrom(u) === mod.keyFrom(u.replace('17z','19z')), true);

// CSV escaping — sekarang ada di export.js (dipakai bersama popup + dashboard)
const psrc = fs.readFileSync('export.js','utf8');
const ci = psrc.indexOf('function cell(');
let d=0, st=psrc.indexOf('{', ci), end=st;
for(let k=st;k<psrc.length;k++){ if(psrc[k]==='{')d++; else if(psrc[k]==='}'){d--; if(!d){end=k+1;break;}} }
const cell = eval('(' + psrc.slice(ci,end).replace('function cell','function') + ')');
console.log('CSV safety:');
eq('formula injection neutralized', cell('=HYPERLINK("evil")').startsWith("'"), true);
eq('leading + escaped', cell('+1 800 555').startsWith("'"), true);
eq('phone with leading 0 untouched', cell('021-555-1234'), '021-555-1234');
eq('null -> empty', cell(null), '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
