// Uji penyaringan & pemeringkatan email dari email.js
import fs from 'fs';
const src = fs.readFileSync('email.js','utf8');
const i = src.indexOf('const JUNK');
const j = src.indexOf('const found = []');
const clean = eval('(()=>{' + src.slice(i,j) + ';return clean})()');

let pass=0, fail=0;
const eq=(l,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b); ok?pass++:fail++;
  console.log((ok?'  ok  ':'FAIL  ')+l+(ok?'':`  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));};

console.log('buang yang jelas bukan milik bisnis:');
eq('vendor sentry', clean(['x@sentry.io'],'toko.id'), []);
eq('placeholder template', clean(['you@example.com'],'toko.id'), []);
eq('noreply', clean(['noreply@toko.id'],'toko.id'), []);
eq('file gambar terbaca sbg email', clean(['logo@2x.png'],'toko.id'), []);
eq('wixpress', clean(['a@wixpress.com'],'toko.id'), []);

console.log('bentuk tidak valid:');
eq('tanpa TLD', clean(['a@b'],'toko.id'), []);
eq('dua @', clean(['a@b@c.com'],'toko.id'), []);
eq('kosong', clean([''],'toko.id'), []);
eq('terlalu panjang', clean(['a'.repeat(95)+'@toko.id'],'toko.id'), []);

console.log('normalisasi:');
eq('mailto: dibuang', clean(['mailto:Halo@Toko.ID'],'toko.id'), ['halo@toko.id']);
eq('query ?subject dibuang', clean(['mailto:a@toko.id?subject=Hi'],'toko.id'), ['a@toko.id']);
eq('spasi & huruf besar', clean(['  INFO@Toko.id '],'toko.id'), ['info@toko.id']);
eq('duplikat digabung', clean(['a@toko.id','A@TOKO.ID'],'toko.id'), ['a@toko.id']);

console.log('pemeringkatan — domain sendiri menang:');
eq('domain cocok > gmail',
   clean(['owner@gmail.com','info@toko.id'],'toko.id'), ['info@toko.id','owner@gmail.com']);
eq('www. diabaikan saat cocokkan',
   clean(['x@gmail.com','halo@toko.id'],'www.toko.id'), ['halo@toko.id','x@gmail.com']);
eq('subdomain milik sendiri ikut menang',
   clean(['a@gmail.com','b@mail.toko.id'],'toko.id'), ['b@mail.toko.id','a@gmail.com']);
eq('skor sama -> yang terpendek dulu',
   clean(['panjangsekali@gmail.com','ab@gmail.com'],'toko.id'), ['ab@gmail.com','panjangsekali@gmail.com']);

console.log('needsEmail (kapan tombol aktif):');
const has = (v)=> v!=null && String(v).trim()!=='';
const needsEmail = (r)=> has(r.website) && !has(r.email) && !r.emailCheckedAt;
eq('punya web, belum dicek -> perlu', needsEmail({website:'https://a.id'}), true);
eq('tanpa web -> tidak perlu', needsEmail({}), false);
eq('sudah punya email -> tidak perlu', needsEmail({website:'https://a.id',email:'a@a.id'}), false);
eq('sudah dicek tapi nihil -> tidak diulang', needsEmail({website:'https://a.id',emailCheckedAt:1}), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
