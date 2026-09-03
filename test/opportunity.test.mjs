import test from 'node:test';
import assert from 'node:assert/strict';
import opportunityPkg from '../opportunity.js';
const { OPPORTUNITY_TYPES, calculateLeadScore, getOpportunity } = opportunityPkg;

test('Lead Opportunity Scoring — Engine & Klasifikasi', async (t) => {
  await t.test('web-pitch: tanpa website tapi bisnis aktif', () => {
    const lead1 = {
      name: 'Kedai Kopi Mantap',
      website: '',
      reviews: 35,
      rating: 4.6,
    };
    const opp1 = getOpportunity(lead1);
    assert.equal(opp1.id, 'web-pitch');
    assert.equal(opp1.label, 'Butuh Website');

    const lead2 = {
      name: 'Bengkel Maju',
      website: null,
      reviews: 0,
      rating: 4.2, // rating >= 4.0
    };
    const opp2 = getOpportunity(lead2);
    assert.equal(opp2.id, 'web-pitch');
  });

  await t.test('reputation-fix: rating < 4.0 dengan review aktif', () => {
    const lead = {
      name: 'Resto Kurang Enak',
      website: 'https://restokurangenak.com',
      rating: 3.6,
      reviews: 24,
    };
    const opp = getOpportunity(lead);
    assert.equal(opp.id, 'reputation-fix');
    assert.equal(opp.label, 'Perlu Reputasi');
  });

  await t.test('high-value: rating prima dan ulasan banyak', () => {
    const lead = {
      name: 'Hotel Bintang Lima',
      website: 'https://hotelbintang5.com',
      rating: 4.8,
      reviews: 320,
      phone: '0812345678',
    };
    const opp = getOpportunity(lead);
    assert.equal(opp.id, 'high-value');
    assert.equal(opp.label, 'High Value Lead');
  });

  await t.test('outreach-ready: kontak lengkap telepon & email', () => {
    const lead = {
      name: 'Kantor Konsultan',
      website: 'https://konsultan.co.id',
      phone: '021-99887766',
      email: 'halo@konsultan.co.id',
      rating: 4.2,
      reviews: 8,
    };
    const opp = getOpportunity(lead);
    assert.equal(opp.id, 'outreach-ready');
    assert.equal(opp.label, 'Kontak Siap');
  });

  await t.test('standard lead: profil umum', () => {
    const lead = {
      name: 'Toko Kelontong Baru',
      website: 'https://kelontong.id',
      phone: '0812345678',
      rating: 4.1,
      reviews: 4,
    };
    const opp = getOpportunity(lead);
    assert.equal(opp.id, 'standard');
    assert.equal(opp.label, 'Standard Lead');
  });

  await t.test('calculateLeadScore: rentang 0-100 dan kalkulasi skor', () => {
    const emptyScore = calculateLeadScore({});
    assert.equal(emptyScore, 0);

    const fullLead = {
      name: 'Super Biz',
      phone: '08123',
      email: 'biz@mail.com',
      socials: ['instagram:biz'],
      rating: 4.9,
      reviews: 250,
      website: 'https://biz.com',
      address: 'Jl. Merdeka 10',
    };
    const score = calculateLeadScore(fullLead);
    assert.ok(score >= 80 && score <= 100);
  });
});
