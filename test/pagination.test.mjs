// Uji aritmetika pagination + interaksinya dengan data yang tumbuh live.
let pass=0, fail=0;
const eq=(l,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b); ok?pass++:fail++;
  console.log((ok?'  ok  ':'FAIL  ')+l+(ok?'':`  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`));};

// Cermin dari logika dashboard.js
const maxPage = (total, per) => Math.max(1, Math.ceil(total / per));
const clamp   = (p, total, per) => Math.min(Math.max(1, p), maxPage(total, per));
const slice   = (arr, page, per) => arr.slice((page-1)*per, (page-1)*per + per);
const info    = (page, per, total) => {
  const from = (page-1)*per + 1, to = Math.min(page*per, total);
  return `${from}–${to} dari ${total}`;
};

const mk = (n) => Array.from({length:n}, (_,i)=>({key:'k'+i}));

console.log('maxPage:');
eq('kosong -> tetap 1', maxPage(0, 50), 1);
eq('pas sebagian', maxPage(120, 50), 3);
eq('pas habis (tanpa halaman kosong)', maxPage(100, 50), 2);
eq('satu baris', maxPage(1, 50), 1);

console.log('slice halaman:');
eq('hal 1 dari 120', slice(mk(120),1,50).length, 50);
eq('hal 3 sisa 20', slice(mk(120),3,50).length, 20);
eq('hal 1 mulai k0', slice(mk(120),1,50)[0].key, 'k0');
eq('hal 2 mulai k50', slice(mk(120),2,50)[0].key, 'k50');
eq('di luar rentang -> kosong', slice(mk(10),5,50).length, 0);

console.log('info range:');
eq('hal 1', info(1,50,120), '1–50 dari 120');
eq('hal terakhir dipotong ke total', info(3,50,120), '101–120 dari 120');
eq('satu baris', info(1,50,1), '1–1 dari 1');

console.log('clamp saat data menyusut (hapus baris / ganti filter):');
eq('hal 3 dari 120 -> 120 tersisa 30', clamp(3, 30, 50), 1);
eq('hal 5 dari 400 -> tersisa 120', clamp(5, 120, 50), 3);
eq('hal 1 selalu valid', clamp(1, 0, 50), 1);
eq('negatif dinaikkan ke 1', clamp(-2, 120, 50), 1);

console.log('halaman stabil saat data TUMBUH live (crawl berjalan):');
// Ini yang penting: baris baru masuk di akhir, jadi user di hal 2 tidak boleh terlempar.
let page = 2;
eq('sebelum: hal 2 dari 120', clamp(page,120,50), 2);
eq('setelah tumbuh jadi 300, tetap hal 2', clamp(page,300,50), 2);
eq('isi hal 2 tidak bergeser', slice(mk(300),2,50)[0].key, slice(mk(120),2,50)[0].key);

console.log('ganti perPage:');
eq('50->100 maxPage turun', maxPage(120,100), 2);
eq('hal 3 di per=50 di-clamp saat per=100', clamp(3,120,100), 2);
eq('per=25 pada 120', maxPage(120,25), 5);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
