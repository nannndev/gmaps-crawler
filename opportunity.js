/* Lead Opportunity Scoring Engine
 * Menganalisis profil prospek dan menentukan jenis peluang bisnis serta skor potensi (0-100).
 * Berfungsi di lingkungan browser dan Node.js (test).
 */
(() => {
  const has = (v) => v != null && String(v).trim() !== '';

  const OPPORTUNITY_TYPES = [
    {
      id: 'web-pitch',
      label: 'Butuh Website',
      labelEn: 'Needs Website',
      shortLabel: 'Web Pitch',
      shortLabelEn: 'Web Pitch',
      icon: '🌐',
      cls: 'opp-web',
      desc: 'Bisnis aktif namun belum memiliki website. Target ideal agensi web / digital marketing.',
      descEn: 'Active business with good traction but no website. Ideal target for web/digital agencies.',
    },
    {
      id: 'reputation-fix',
      label: 'Perlu Reputasi',
      labelEn: 'Reputation Fix',
      shortLabel: 'Rep Fix',
      shortLabelEn: 'Rep Fix',
      icon: '🛡️',
      cls: 'opp-rep',
      desc: 'Rating di bawah 4,0 dengan ulasan aktif (≥15). Target konsultan reputasi & kepuasan pelanggan.',
      descEn: 'Rating below 4.0 with active reviews (≥15). Target for reputation & review consultants.',
    },
    {
      id: 'high-value',
      label: 'High Value Lead',
      labelEn: 'High Value Lead',
      shortLabel: 'High Value',
      shortLabelEn: 'High Value',
      icon: '⭐',
      cls: 'opp-high',
      desc: 'Rating prima (≥4,5) dan ulasan banyak (≥50). Bisnis mapan dengan potensi budget besar.',
      descEn: 'Prime rating (≥4.5) and high review count (≥50). Established business with high budget.',
    },
    {
      id: 'outreach-ready',
      label: 'Kontak Siap',
      labelEn: 'Ready to Contact',
      shortLabel: 'Siap Kontak',
      shortLabelEn: 'Outreach Ready',
      icon: '⚡',
      cls: 'opp-ready',
      desc: 'Memiliki nomor telepon dan alamat email terverifikasi. Siap dihubungi secara omnichannel.',
      descEn: 'Verified phone and email found. Ready for immediate omnichannel outreach.',
    },
    {
      id: 'standard',
      label: 'Standard Lead',
      labelEn: 'Standard Lead',
      shortLabel: 'Standard',
      shortLabelEn: 'Standard',
      icon: '📍',
      cls: 'opp-std',
      desc: 'Prospek dengan profil umum.',
      descEn: 'Lead with general business profile.',
    },
  ];

  /**
   * Menghitung Lead Score (0 - 100) berdasarkan kelengkapan dan kredibilitas bisnis.
   */
  function calculateLeadScore(r) {
    if (!r) return 0;
    let score = 0;

    // Kontak (maks 45 poin)
    if (has(r.phone)) score += 20;
    if (has(r.email)) score += 15;
    if (Array.isArray(r.socials) && r.socials.length > 0) score += 10;

    // Kredibilitas & Keaktifan (maks 40 poin)
    const reviews = typeof r.reviews === 'number' ? r.reviews : parseInt(r.reviews, 10) || 0;
    const rating = typeof r.rating === 'number' ? r.rating : parseFloat(String(r.rating).replace(',', '.')) || null;

    if (rating != null) {
      score += 10;
      if (rating >= 4.5) score += 10;
      else if (rating >= 4.0) score += 5;
    }

    if (reviews >= 50) score += 20;
    else if (reviews >= 15) score += 10;
    else if (reviews >= 5) score += 5;

    // Website & Alamat (maks 15 poin)
    if (has(r.website)) score += 10;
    if (has(r.address)) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Menentukan kategori peluang utama untuk baris tempat tertentu.
   */
  function getOpportunity(r) {
    if (!r) return { ...OPPORTUNITY_TYPES[4], score: 0 };

    const reviews = typeof r.reviews === 'number' ? r.reviews : parseInt(r.reviews, 10) || 0;
    const rating = typeof r.rating === 'number' ? r.rating : parseFloat(String(r.rating).replace(',', '.')) || null;
    const score = calculateLeadScore(r);

    // 1. Web Pitch: Belum punya website DAN (ada ulasan >= 10 atau rating >= 4.0)
    const noWebsite = !has(r.website);
    if (noWebsite && (reviews >= 10 || (rating != null && rating >= 4.0))) {
      return { ...OPPORTUNITY_TYPES[0], score };
    }

    // 2. Reputation Fix: Rating < 4.0 dan punya ulasan >= 15
    if (rating != null && rating < 4.0 && reviews >= 15) {
      return { ...OPPORTUNITY_TYPES[1], score };
    }

    // 3. High Value Lead: Rating >= 4.5 dan ulasan >= 50
    if (rating != null && rating >= 4.5 && reviews >= 50) {
      return { ...OPPORTUNITY_TYPES[2], score };
    }

    // 4. Outreach Ready: Punya telepon DAN email
    if (has(r.phone) && has(r.email)) {
      return { ...OPPORTUNITY_TYPES[3], score };
    }

    // 5. Standard
    return { ...OPPORTUNITY_TYPES[4], score };
  }

  const exportObj = {
    OPPORTUNITY_TYPES,
    calculateLeadScore,
    getOpportunity,
  };

  if (typeof window !== 'undefined') {
    window.MDCOpportunity = exportObj;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
})();
