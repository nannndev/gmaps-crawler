// Uji ekstraksi sosial media, format Excel, dan helper copy massal dari email.js & export.js
import fs from 'fs';

const emailSrc = fs.readFileSync('email.js', 'utf8');
const iSocial = emailSrc.indexOf('function cleanSocials');
const jSocial = emailSrc.indexOf('const found = []');
const cleanSocials = eval('(()=>{\n' + emailSrc.slice(iSocial, jSocial) + '\nreturn cleanSocials})()');

const exportSrc = fs.readFileSync('export.js', 'utf8');
const exportModule = eval('(()=>{\nlet window={};\n' + exportSrc + '\nreturn window.MDCExport})()');

let pass = 0, fail = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok  ' : 'FAIL  ') + label + (ok ? '' : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`));
};

console.log('ekstraksi link media sosial:');
eq('instagram handle', cleanSocials(['https://www.instagram.com/coffeeprimo/']), ['instagram:coffeeprimo']);
eq('whatsapp number', cleanSocials(['https://wa.me/628123456789']), ['whatsapp:628123456789']);
eq('whatsapp api link', cleanSocials(['https://api.whatsapp.com/send?phone=628123456789']), ['whatsapp:628123456789']);
eq('facebook page', cleanSocials(['https://facebook.com/coffeeprimoid']), ['facebook:coffeeprimoid']);
eq('linkedin company', cleanSocials(['https://linkedin.com/company/coffeeprimo']), ['linkedin:coffeeprimo']);
eq('tiktok handle', cleanSocials(['https://tiktok.com/@coffeeprimo']), ['tiktok:coffeeprimo']);
eq('twitter / x handle', cleanSocials(['https://x.com/coffeeprimo']), ['twitter:coffeeprimo']);
eq('buang share/intent junk link', cleanSocials(['https://facebook.com/sharer/sharer.php']), []);

console.log('export columns & batch copy helpers:');
eq('COLUMNS mencakup socials dan tags',
   exportModule.COLUMNS.includes('socials') && exportModule.COLUMNS.includes('tags'), true);

const sampleData = [
  { name: 'Kafe A', email: 'info@kafea.id', emailsAll: 'admin@kafea.id', phone: '08123456', website: 'kafea.id', socials: ['instagram:kafea'] },
  { name: 'Kafe B', email: 'halo@kafeb.id', phone: '08771122', website: 'kafeb.id', tags: ['VIP'] }
];

eq('extractEmailList gabungkan semua email',
   exportModule.extractEmailList(sampleData), 'info@kafea.id, admin@kafea.id, halo@kafeb.id');

eq('extractPhoneList per baris',
   exportModule.extractPhoneList(sampleData), '08123456\n08771122');

eq('toExcelTSV mengandung BOM dan baris header',
   exportModule.toExcelTSV(sampleData).startsWith('﻿name\tcategory'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
