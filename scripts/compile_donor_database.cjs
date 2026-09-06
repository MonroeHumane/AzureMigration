const fs = require('fs');
const path = require('path');

// Helper to normalize names for deduplication
function normName(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPhone(p) {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return p.trim();
}

function getGivingTier(total) {
  if (total >= 10000) return { id: 'visionary', label: 'Visionary ($10k+)', color: 'purple' };
  if (total >= 5000) return { id: 'benefactor', label: 'Benefactor ($5k–$10k)', color: 'emerald' };
  if (total >= 1000) return { id: 'patron', label: 'Patron ($1k–$5k)', color: 'blue' };
  if (total >= 500) return { id: 'sustainer', label: 'Sustainer ($500–$1k)', color: 'teal' };
  if (total >= 100) return { id: 'friend', label: 'Friend ($100–$500)', color: 'amber' };
  return { id: 'supporter', label: 'Supporter (< $100)', color: 'slate' };
}

console.log('=== HSMC Donor Database Compilation ===');

// Master map: unique donor key -> donor object
const donorMap = new Map();
const emailIndex = new Map();
const nameIndex = new Map();

function findOrCreateDonor(primaryName, email, phone, address) {
  const normN = normName(primaryName);
  const cleanEmail = (email || '').trim().toLowerCase();

  let donor = null;
  if (cleanEmail && emailIndex.has(cleanEmail)) {
    donor = emailIndex.get(cleanEmail);
  } else if (normN && nameIndex.has(normN)) {
    donor = nameIndex.get(normN);
  }

  if (!donor) {
    const id = 'dn_' + Math.random().toString(36).substring(2, 9);
    donor = {
      id,
      name: primaryName || 'Anonymous Donor',
      email: cleanEmail || '',
      phone: cleanPhone(phone),
      address: (address || '').trim(),
      lifetimeTotal: 0,
      transactionsCount: 0,
      firstGiftDate: '',
      latestGiftDate: '',
      platforms: new Set(),
      campaigns: new Set(),
      tributesCount: 0,
      gifts: []
    };
    donorMap.set(id, donor);
  }

  // Enrich donor details if previously missing
  if (primaryName && (!donor.name || donor.name === 'Anonymous Donor' || donor.name.toLowerCase() === donor.name)) {
    donor.name = primaryName;
  }
  if (cleanEmail && !donor.email) {
    donor.email = cleanEmail;
    emailIndex.set(cleanEmail, donor);
  }
  if (phone && !donor.phone) {
    donor.phone = cleanPhone(phone);
  }
  if (address && !donor.address) {
    donor.address = address.trim();
  }

  if (cleanEmail) emailIndex.set(cleanEmail, donor);
  if (normN) nameIndex.set(normN, donor);

  return donor;
}

// 1. Ingest Master Donor Roll with Full Addresses
const masterRollPath = 'C:/Users/Jeff/Downloads/HSMC_Master_Donor_Roll_With_Full_Mailing_Addresses.csv';
if (fs.existsSync(masterRollPath)) {
  console.log('Loading Master Donor Roll from:', masterRollPath);
  const content = fs.readFileSync(masterRollPath, 'utf8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',');

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // parse CSV taking quotes into account
    const cols = [];
    let inQuotes = false;
    let token = '';
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(token);
        token = '';
      } else {
        token += char;
      }
    }
    cols.push(token);

    if (cols.length < 2) continue;
    const norm = cols[0];
    const name = cols[1];
    const email = cols[2];
    const phone = cols[3];
    const lifetimeGiven = parseFloat(cols[4]) || 0;
    const txCount = parseInt(cols[5]) || 0;
    const firstDate = cols[6] ? cols[6].split(' ')[0] : '';
    const lastDate = cols[7] ? cols[7].split(' ')[0] : '';
    const platforms = cols[8] ? cols[8].replace(/"/g, '') : '';
    const campaign = cols[9] ? cols[9].replace(/"/g, '') : '';
    const address = cols[10] ? cols[10].replace(/"/g, '').replace(/\|/g, ', ') : '';

    const donor = findOrCreateDonor(name, email, phone, address);
    donor.baselineLifetime = lifetimeGiven;
    donor.baselineTxs = txCount;
    if (firstDate && (!donor.firstGiftDate || firstDate < donor.firstGiftDate)) donor.firstGiftDate = firstDate;
    if (lastDate && (!donor.latestGiftDate || lastDate > donor.latestGiftDate)) donor.latestGiftDate = lastDate;
    if (platforms) {
      platforms.split(',').map(p => p.trim()).filter(Boolean).forEach(p => donor.platforms.add(p));
    }
    if (campaign) {
      campaign.split(',').map(c => c.trim()).filter(Boolean).forEach(c => donor.campaigns.add(c));
    }
  }
}

// 2. Ingest BetterUnite Contacts for Additional Address/Phone Enrichment
const contactsPath = 'C:/Users/Jeff/Downloads/Contacts Export 2026-09-03.csv';
if (fs.existsSync(contactsPath)) {
  console.log('Enriching from BetterUnite Contacts:', contactsPath);
  const content = fs.readFileSync(contactsPath, 'utf8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',');

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const cols = [];
    let inQuotes = false;
    let token = '';
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { cols.push(token); token = ''; }
      else token += char;
    }
    cols.push(token);

    const fn = (cols[1] || '').trim();
    const ln = (cols[3] || '').trim();
    const fullName = `${fn} ${ln}`.trim();
    const email = (cols[4] || '').trim();
    const phone = (cols[6] || cols[7] || cols[8] || '').trim();
    const street = (cols[9] || '').trim();
    const city = (cols[11] || '').trim();
    const state = (cols[12] || '').trim();
    const zip = (cols[13] || '').trim();

    let fullAddr = '';
    if (street || city) {
      fullAddr = [street, city, state, zip].filter(Boolean).join(', ');
    }

    if (fullName || email) {
      const donor = findOrCreateDonor(fullName, email, phone, fullAddr);
      donor.platforms.add('BetterUnite');
    }
  }
}

// Set of transaction hashes to prevent duplicate gift insertion
const seenTxHashes = new Set();

function addGift(donor, gift) {
  const hash = `${donor.id}_${gift.date}_${gift.amount}_${gift.platform}_${gift.reference || ''}`;
  if (seenTxHashes.has(hash)) return;
  seenTxHashes.add(hash);

  donor.gifts.push(gift);
  donor.platforms.add(gift.platform);
  if (gift.campaign) donor.campaigns.add(gift.campaign);
  if (gift.isTribute) donor.tributesCount++;

  if (!donor.firstGiftDate || (gift.date && gift.date < donor.firstGiftDate)) {
    donor.firstGiftDate = gift.date;
  }
  if (!donor.latestGiftDate || (gift.date && gift.date > donor.latestGiftDate)) {
    donor.latestGiftDate = gift.date;
  }
}

// 3. Ingest BetterUnite Itemized Transactions
const buTxPath = 'C:/Users/Jeff/Downloads/Transactions Export 2026-09-03.csv';
if (fs.existsSync(buTxPath)) {
  console.log('Ingesting itemized BetterUnite transactions:', buTxPath);
  const content = fs.readFileSync(buTxPath, 'utf8');
  const lines = content.split('\n');

  // Skip 12 header notes
  let headerIndex = 12;
  while (headerIndex < lines.length && !lines[headerIndex].includes('Payment Date')) {
    headerIndex++;
  }

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row.trim()) continue;

    const cols = [];
    let inQuotes = false;
    let token = '';
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { cols.push(token); token = ''; }
      else token += char;
    }
    cols.push(token);

    const dateStr = (cols[0] || '').trim();
    const fn = (cols[1] || '').trim();
    const ln = (cols[3] || '').trim();
    const fullName = `${fn} ${ln}`.trim();
    const email = (cols[4] || '').trim();
    const amtStr = (cols[12] || '').trim();
    const itemType = (cols[13] || '').trim();
    const campaign = (cols[19] || '').trim();
    const dedication = (cols[25] || '').trim();
    const note = (cols[26] || '').trim();
    const paymentRef = (cols[35] || cols[33] || '').trim();
    const street = (cols[37] || '').trim();
    const city = (cols[38] || '').trim();
    const state = (cols[39] || '').trim();
    const zip = (cols[40] || '').trim();
    const phone = (cols[43] || '').trim();

    if (!amtStr || itemType === 'Fees paid by Donor') continue;
    const amount = parseFloat(amtStr) || 0;
    if (amount <= 0) continue;

    let cleanDate = dateStr;
    if (dateStr.includes(' ')) {
      const parts = dateStr.split(' ')[0].split('/');
      if (parts.length === 3) {
        cleanDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }

    let fullAddr = '';
    if (street || city) fullAddr = [street, city, state, zip].filter(Boolean).join(', ');

    const donor = findOrCreateDonor(fullName, email, phone, fullAddr);

    const memoText = [dedication, note].filter(Boolean).join(' | ');
    const isTribute = Boolean(dedication || memoText.toLowerCase().includes('in memory') || memoText.toLowerCase().includes('memorial'));

    addGift(donor, {
      date: cleanDate,
      amount,
      platform: 'BetterUnite',
      campaign: campaign || 'General Donation',
      type: campaign.includes('Auction') ? 'Event / Auction' : (isTribute ? 'Memorial & Tribute' : 'Direct Gift'),
      memo: memoText,
      dedication: dedication || '',
      isTribute,
      reference: paymentRef
    });
  }
}

// 4. Ingest 2026 PayPal Reconciled Donations
const ppPath = 'C:/Users/Jeff/Downloads/HSMC_2026_PayPal_Reconciled_Donations.csv';
if (fs.existsSync(ppPath)) {
  console.log('Ingesting 2026 PayPal reconciled donations:', ppPath);
  const content = fs.readFileSync(ppPath, 'utf8');
  const lines = content.trim().split('\n');

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const cols = [];
    let inQuotes = false;
    let token = '';
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { cols.push(token); token = ''; }
      else token += char;
    }
    cols.push(token);

    const dateStr = (cols[0] || '').trim();
    const fullName = (cols[3] || '').trim();
    const type = (cols[4] || '').trim();
    const grossStr = (cols[7] || '').trim();
    const feeStr = (cols[8] || '').trim();
    const netStr = (cols[9] || '').trim();
    const email = (cols[10] || '').trim();
    const txnId = (cols[12] || '').trim();
    const itemTitle = (cols[14] || '').trim();
    const phone = (cols[27] || '').trim();
    const note = (cols[29] || '').trim();

    const gross = parseFloat(grossStr) || 0;
    if (gross <= 0) continue;

    let cleanDate = dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      cleanDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }

    const donor = findOrCreateDonor(fullName, email, phone, '');

    const isTribute = Boolean(note.toLowerCase().includes('in memory') || note.toLowerCase().includes('memorial') || itemTitle.toLowerCase().includes('memorial'));

    addGift(donor, {
      date: cleanDate,
      amount: gross,
      platform: 'PayPal',
      campaign: itemTitle || 'PayPal General Fund',
      type: type.includes('Subscription') ? 'Monthly Recurring' : (isTribute ? 'Memorial & Tribute' : 'Direct Gift'),
      memo: note || '',
      dedication: isTribute ? note : '',
      isTribute,
      reference: txnId
    });
  }
}

// 5. Ingest 2026 QBO Check Donations from monthly_drilldown_2026.json
const drilldownPath = 'frontend/src/data/monthly_drilldown_2026.json';
if (fs.existsSync(drilldownPath)) {
  console.log('Ingesting 2026 QBO check donors from:', drilldownPath);
  const drilldownData = JSON.parse(fs.readFileSync(drilldownPath, 'utf8'));

  for (const [monthKey, monthObj] of Object.entries(drilldownData)) {
    for (const cat of (monthObj.categories || [])) {
      if (cat.group === 'Contributed Income' || cat.name.includes('Donation')) {
        for (const payee of (cat.payees || [])) {
          const pName = payee.name;
          if (pName === 'BETTER UNITE' || pName === 'Paypal' || pName === 'Branch Deposit Batch' || pName === 'SQUARE') continue;

          for (const tx of (payee.transactions || [])) {
            const donor = findOrCreateDonor(pName, '', '', '');
            const isTribute = cat.name === 'Memorial Donations' || (tx.memo && (tx.memo.toLowerCase().includes('in memory') || tx.memo.toLowerCase().includes('memorial')));

            addGift(donor, {
              date: tx.date,
              amount: tx.amount,
              platform: 'Paper Check / In-Person',
              campaign: cat.name,
              type: isTribute ? 'Memorial & Tribute' : 'Direct Check',
              memo: tx.memo || '',
              dedication: isTribute ? tx.memo : '',
              isTribute,
              reference: tx.num || ''
            });
          }
        }
      }
    }
  }
}

// 6. Compute Final Lifetime Totals & Tiers for each Donor
const finalDonors = [];
for (const donor of donorMap.values()) {
  // Sort gifts chronologically descending
  donor.gifts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Calculate lifetime total: sum of itemized gifts, or fallback to baseline if larger
  const itemizedSum = donor.gifts.reduce((sum, g) => sum + g.amount, 0);
  const baseline = donor.baselineLifetime || 0;
  donor.lifetimeTotal = Math.max(itemizedSum, baseline);
  donor.transactionsCount = Math.max(donor.gifts.length, donor.baselineTxs || 0);

  // Skip zero/negative or systemic artifacts
  if (donor.lifetimeTotal <= 0 && donor.transactionsCount === 0) continue;
  if (donor.name.toLowerCase().includes('square inc') || donor.name.toLowerCase() === 'deposit') continue;

  const tier = getGivingTier(donor.lifetimeTotal);
  donor.givingTier = tier.label;
  donor.tierId = tier.id;
  donor.tierColor = tier.color;

  donor.platformsList = Array.from(donor.platforms);
  donor.campaignsList = Array.from(donor.campaigns);
  donor.hasMailingAddress = Boolean(donor.address && donor.address.length > 5);

  delete donor.platforms;
  delete donor.campaigns;
  delete donor.baselineLifetime;
  delete donor.baselineTxs;

  finalDonors.push(donor);
}

// Sort all donors by Lifetime Total descending
finalDonors.sort((a, b) => b.lifetimeTotal - a.lifetimeTotal);

// Summary KPIs
const totalRaised = finalDonors.reduce((sum, d) => sum + d.lifetimeTotal, 0);
const totalDonors = finalDonors.length;
const totalWithAddress = finalDonors.filter(d => d.hasMailingAddress).length;
const majorDonors = finalDonors.filter(d => d.lifetimeTotal >= 1000).length;
const active2026 = finalDonors.filter(d => (d.latestGiftDate || '').startsWith('2026')).length;
const totalTributes = finalDonors.reduce((sum, d) => sum + d.tributesCount, 0);

const databasePayload = {
  meta: {
    compiled_at: new Date().toISOString(),
    total_donors: totalDonors,
    total_lifetime_volume: Math.round(totalRaised * 100) / 100,
    total_with_address: totalWithAddress,
    major_donors_count: majorDonors,
    active_2026_count: active2026,
    total_tributes_count: totalTributes,
    tiers_breakdown: {
      visionary: finalDonors.filter(d => d.tierId === 'visionary').length,
      benefactor: finalDonors.filter(d => d.tierId === 'benefactor').length,
      patron: finalDonors.filter(d => d.tierId === 'patron').length,
      sustainer: finalDonors.filter(d => d.tierId === 'sustainer').length,
      friend: finalDonors.filter(d => d.tierId === 'friend').length,
      supporter: finalDonors.filter(d => d.tierId === 'supporter').length
    }
  },
  donors: finalDonors
};

console.log('\nCompilation Summary:');
console.log('Total Deduplicated Donors:', totalDonors);
console.log('Total Lifetime Volume: $' + totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2 }));
console.log('Donors with Full Mailing Address:', totalWithAddress, `(${((totalWithAddress/totalDonors)*100).toFixed(1)}%)`);
console.log('Major Donors ($1,000+):', majorDonors);
console.log('Active 2026 Donors:', active2026);

// Server-side only. Do not write frontend/src/data — Astro SSG would bake PII into public HTML.
const targetApi = 'api/data/donor_database.json';

if (!fs.existsSync('api/data')) fs.mkdirSync('api/data', { recursive: true });
fs.writeFileSync(targetApi, JSON.stringify(databasePayload), 'utf8');
console.log('Wrote api dataset:', targetApi, `(${(fs.statSync(targetApi).size / (1024 * 1024)).toFixed(2)} MB)`);

console.log('Compilation Complete!');
