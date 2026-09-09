const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  normName,
  aliasKey,
  resolveDonorName,
  isAggregateName,
  campaignFromQboAccount,
  resolveDepositPayor,
  flattenManualDepositSplits,
  formatMailingAddress,
  isCompleteMailingAddress,
  assertDonorInvariants,
} = require('./donor_compile_lib.cjs');

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

const existingDonorsPath = path.join(__dirname, '..', 'api', 'data', 'donor_database.json');
const existingIdByKey = new Map();
if (fs.existsSync(existingDonorsPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(existingDonorsPath, 'utf8'));
    for (const d of prev.donors || []) {
      const email = (d.email || '').trim().toLowerCase();
      const n = normName(d.name);
      const ak = aliasKey(d.name);
      if (email) existingIdByKey.set('e:' + email, d.id);
      if (n) existingIdByKey.set('n:' + n, d.id);
      if (ak) existingIdByKey.set('n:' + ak, d.id);
    }
    console.log('Reusing stable IDs from existing donor database');
  } catch (err) {
    console.warn('Could not read existing donor IDs:', err.message);
  }
}

function stableDonorId(name, email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const n = normName(name);
  const ak = aliasKey(name);
  if (cleanEmail && existingIdByKey.has('e:' + cleanEmail)) return existingIdByKey.get('e:' + cleanEmail);
  if (n && existingIdByKey.has('n:' + n)) return existingIdByKey.get('n:' + n);
  if (ak && existingIdByKey.has('n:' + ak)) return existingIdByKey.get('n:' + ak);
  return 'dn_' + crypto.createHash('sha1').update(`${ak || n}|${cleanEmail}`).digest('hex').slice(0, 7);
}

function namesAreCompatible(a, b) {
  const ka = aliasKey(a);
  const kb = aliasKey(b);
  if (!ka || !kb) return true;
  return ka === kb;
}

function findOrCreateDonor(primaryName, email, phone, address) {
  const resolved = resolveDonorName(primaryName);
  const normN = aliasKey(resolved) || aliasKey(primaryName);
  const cleanEmail = (email || '').trim().toLowerCase();

  let donor = null;
  if (normN && nameIndex.has(normN)) {
    donor = nameIndex.get(normN);
  } else if (cleanEmail && emailIndex.has(cleanEmail)) {
    const byEmail = emailIndex.get(cleanEmail);
    if (namesAreCompatible(byEmail.name, resolved || primaryName)) {
      donor = byEmail;
    }
  }

  if (!donor) {
    const id = stableDonorId(resolved || primaryName, cleanEmail);
    donor = {
      id,
      name: resolved || primaryName || 'Anonymous Donor',
      email: '',
      phone: cleanPhone(phone),
      address: formatMailingAddress(address),
      lifetimeTotal: 0,
      itemizedTotal: 0,
      isAggregate: isAggregateName(resolved || primaryName),
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

  // Keep the first real display name (master-roll runs first).
  if (resolved && (!donor.name || donor.name === 'Anonymous Donor')) {
    donor.name = resolved;
  }
  if (isAggregateName(resolved || primaryName) || isAggregateName(donor.name)) {
    donor.isAggregate = true;
  }
  if (cleanEmail && !donor.email) {
    const owner = emailIndex.get(cleanEmail);
    if (!owner || owner === donor) {
      donor.email = cleanEmail;
    }
  }
  if (phone && !donor.phone) {
    donor.phone = cleanPhone(phone);
  }
  const formattedAddress = formatMailingAddress(address);
  if (formattedAddress && !donor.address) {
    donor.address = formattedAddress;
  }

  if (donor.email) emailIndex.set(donor.email, donor);
  if (normN) nameIndex.set(normN, donor);
  const rawKey = aliasKey(primaryName);
  if (rawKey && namesAreCompatible(donor.name, primaryName)) nameIndex.set(rawKey, donor);

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
    const address = formatMailingAddress(cols[10] ? cols[10].replace(/"/g, '') : '');

    const donor = findOrCreateDonor(name, email, phone, address);
    donor.baselineLifetime = lifetimeGiven;
    donor.baselineTxs = txCount;
    if (firstDate && (!donor.firstGiftDate || firstDate < donor.firstGiftDate)) donor.firstGiftDate = firstDate;
    if (lastDate && (!donor.latestGiftDate || lastDate > donor.latestGiftDate)) donor.latestGiftDate = lastDate;
    if (platforms) {
      platforms.split(',').map(p => p.trim()).filter(Boolean).forEach(p => donor.platforms.add(p));
    }
    if (campaign) {
      campaign.split(',').map(c => c.trim()).filter(Boolean).forEach(c => {
        donor.campaigns.add(campaignFromQboAccount(c, donor.name, c));
      });
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

    let fullAddr = formatMailingAddress(street, city, state, zip);

    if (fullName || email) {
      const donor = findOrCreateDonor(fullName, email, phone, fullAddr);
      donor.platforms.add('BetterUnite');
    }
  }
}

// Set of transaction hashes to prevent duplicate gift insertion
const seenTxHashes = new Set();

function mergeGiftFields(target, src) {
  const fillKeys = [
    'checkNumber', 'paymentMethod', 'qboClass', 'description', 'privateNote',
    'memo', 'account', 'qboType', 'entityType', 'entityId', 'glCategory', 'source'
  ];
  for (const k of fillKeys) {
    if (!target[k] && src[k]) target[k] = src[k];
  }
  if ((!target.reference || String(target.reference).length < String(src.reference || '').length) && src.reference) {
    if (!target.reference) target.reference = src.reference;
  }
  if ((!target.description || /^DEPOSIT$/i.test(String(target.description))) && src.description && !/^DEPOSIT$/i.test(String(src.description))) {
    target.description = src.description;
  }
}

function addGift(donor, gift) {
  const hash = `${donor.id}_${gift.date}_${gift.amount}_${gift.platform}_${gift.reference || ''}`;
  const loose = `${donor.id}_${gift.date}_${Number(gift.amount).toFixed(2)}`;
  if (seenTxHashes.has(hash) || seenTxHashes.has(loose)) {
    const existing = donor.gifts.find((g) =>
      g.date === gift.date && Number(g.amount).toFixed(2) === Number(gift.amount).toFixed(2)
    );
    if (existing) mergeGiftFields(existing, gift);
    return;
  }
  seenTxHashes.add(hash);
  seenTxHashes.add(loose);

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

    const fullAddr = formatMailingAddress(street, city, state, zip);

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

// 5. Ingest 2026 QBO revenue lines (paper checks, named deposits, sales receipts)
const PLATFORM_PAYEES = new Set([
  'BETTER UNITE', 'BetterUnite', 'Paypal', 'PayPal', 'SQUARE', 'Square Inc', 'INTUIT *',
  'Branch Deposit Batch', 'Public / Shelter Adopters', 'QuickBooks Journal Adjustment',
  'Zeffy', 'ZEFFY', 'Zeffy Inc'
]);
const SKIP_REVENUE_CAT = /Adoption Fees|Cremation|Merchandise|Swag|Recycling Proceeds/i;
const SKIP_MEMO_RE = /square|paypal|betterunite|authnet|cash drawer|teller check|gala:|car show|ticket sales|raffle|register cash|\bzeffy\b/i;
const MEMO_DONOR_ALIASES = [
  { re: /COUNTY\s+(QUARTERLY\s+)?PAYMENT/i, name: 'COUNTY OF MONROE' },
  { re: /BALANCE OF 20K/i, name: 'COUNTY OF MONROE' },
];

function looksLikeNamedDonor(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (t.length < 5 || t.length > 80) return false;
  if (SKIP_MEMO_RE.test(t)) return false;
  const words = t.split(' ');
  if (words.length < 2) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w) || /^(AND|&|OF|THE|SON|FOR)$/i.test(w));
}

function resolveQboDonorName(payee, memo) {
  const m = String(memo || '').trim();
  // BetterUnite payouts are already itemized from the platform CSV.
  if (/Donor:\s*/i.test(m)) return '';
  if (payee && !PLATFORM_PAYEES.has(payee) && !/^Memorial:/i.test(payee)) return payee;
  for (const alias of MEMO_DONOR_ALIASES) {
    if (alias.re.test(m)) return alias.name;
  }
  const cleaned = m.replace(/\s*TY SENT\s*/ig, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || /^DEPOSIT$/i.test(cleaned) || SKIP_MEMO_RE.test(cleaned)) return '';
  if (looksLikeNamedDonor(cleaned)) return cleaned;
  return '';
}

function isPlatformPayee(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (PLATFORM_PAYEES.has(n)) return true;
  return /better\s*unite|paypal|square(\s+inc)?$|^intuit\b|\bzeffy\b|branch deposit batch/i.test(n);
}

function platformFromQbo(payee, txnType) {
  if (/BETTER\s*UNITE/i.test(payee || '')) return 'BetterUnite';
  if (/paypal/i.test(payee || '')) return 'PayPal';
  if (/square/i.test(payee || '')) return 'Square';
  if (/zeffy/i.test(payee || '')) return 'Zeffy';
  if ((txnType || '') === 'Deposit' || (txnType || '') === 'Sales Receipt' || (txnType || '') === 'Check') {
    return 'Physical Paper Check';
  }
  return 'Physical Paper Check';
}

function isTributeGift(memo, account) {
  return /memorial|in memory|memory of|\bmemory\b|in honor|dedication/i.test(`${memo || ''} ${account || ''}`);
}

function giftPlatform(g) {
  if (/^cash$/i.test(g.paymentMethod || '')) return 'Cash';
  return platformFromQbo(g.donorName, g.qboType);
}

function giftType(g, isTribute) {
  if (isTribute) return 'Memorial & Tribute';
  if (/^cash$/i.test(g.paymentMethod || '')) return 'Cash';
  return (g.qboType === 'Deposit' ? 'Physical Paper Check' : (g.qboType || 'Direct Check'));
}

function ingestDepositEntityGifts(gifts, fillFromDirectory) {
  const fill = typeof fillFromDirectory === 'function' ? fillFromDirectory : function () {};
  let entityGiftCount = 0;
  for (const g of gifts || []) {
    const donorName = String(g.donorName || '').trim();
    if (!donorName || isPlatformPayee(donorName)) continue;
    const desc = String(g.description || '').trim();
    const note = String(g.privateNote || '').trim();
    const memo = String(g.memo || '').trim() || desc;
    const payor = resolveDepositPayor(donorName, memo, g.account);
    if (!payor.name || isPlatformPayee(payor.name)) continue;
    const donor = findOrCreateDonor(payor.name, '', '', '');
    if (payor.aggregate) donor.isAggregate = true;
    if (!payor.via) fill(donor, g.entityType, g.entityId, donorName);
    else fill(donor, '', '', payor.name);
    const isTribute = isTributeGift(memo, g.account);
    const campaign = campaignFromQboAccount(g.account, payor.name, g.account || 'Direct Gift');
    const checkNumber = String(g.checkNum || '').trim();
    addGift(donor, {
      date: g.date,
      amount: g.amount,
      platform: giftPlatform(g),
      campaign,
      type: giftType(g, isTribute),
      memo,
      description: desc,
      privateNote: note,
      dedication: isTribute ? memo : '',
      isTribute,
      reference: checkNumber || g.reference || g.parentId || '',
      checkNumber,
      paymentMethod: String(g.paymentMethod || '').trim(),
      qboClass: String(g.qboClass || '').trim(),
      entityType: String(g.entityType || '').trim(),
      entityId: String(g.entityId || '').trim(),
      qboType: g.qboType || '',
      account: g.account || '',
      glCategory: g.account || '',
      source: g.source || 'QuickBooks Online',
      parentId: g.parentId || '',
      lineId: g.lineId || '',
    });
    entityGiftCount += 1;
  }
  return entityGiftCount;
}

const drilldownCandidates = [
  path.join(__dirname, '..', 'frontend', 'src', 'data', 'monthly_drilldown_2026.json'),
  path.join(__dirname, '..', 'api', 'data', 'monthly_drilldown_2026.json'),
];
const drilldownPath = drilldownCandidates.find((p) => fs.existsSync(p));
if (drilldownPath) {
  console.log('Ingesting 2026 QBO check/deposit donors from:', drilldownPath);
  const drilldownData = JSON.parse(fs.readFileSync(drilldownPath, 'utf8'));
  const months = drilldownData.months || {};
  let qboGiftCount = 0;

  for (const [monthKey, monthObj] of Object.entries(months)) {
    if (!monthObj || monthKey === 'all_ytd') continue;
    const cats = monthObj.revenueCategories || monthObj.categories || [];
    for (const cat of cats) {
      if (SKIP_REVENUE_CAT.test(cat.name || '') || SKIP_REVENUE_CAT.test(cat.group || '')) continue;
      for (const payee of (cat.payees || [])) {
        for (const tx of (payee.transactions || [])) {
          const donorName = resolveQboDonorName(payee.name, tx.memo);
          if (!donorName) continue;
          if (isPlatformPayee(donorName) || isPlatformPayee(payee.name)) continue;
          const memo = (tx.memo || '').trim();
          const payor = resolveDepositPayor(donorName, memo, cat.name);
          if (!payor.name || isPlatformPayee(payor.name)) continue;

          const donor = findOrCreateDonor(payor.name, '', '', '');
          if (payor.aggregate) donor.isAggregate = true;
          const isTribute = cat.name === 'Memorial Donations'
            || /in memory|memorial|in honor|dedication/i.test(memo);
          const campaign = campaignFromQboAccount(cat.name, payor.name, cat.name);
          addGift(donor, {
            date: tx.date,
            amount: tx.amount,
            platform: platformFromQbo(payee.name, tx.type),
            campaign,
            type: isTribute ? 'Memorial & Tribute' : ((tx.type || 'Deposit') === 'Deposit' ? 'Physical Paper Check' : (tx.type || 'Direct Check')),
            memo,
            description: memo,
            dedication: isTribute ? memo : '',
            isTribute,
            reference: tx.num || '',
            checkNumber: tx.num || '',
            paymentMethod: /check/i.test(tx.type || '') ? 'Check' : '',
            qboClass: '',
            qboType: tx.type || '',
            account: tx.split || '',
            glCategory: cat.name,
            source: 'QuickBooks Online'
          });
          qboGiftCount += 1;
        }
      }
    }
  }
  console.log('QBO-attributed gift lines considered:', qboGiftCount);
} else {
  console.warn('monthly_drilldown_2026.json not found; paper checks will not be itemized');
}

// 5b. QBO Deposit / SalesReceipt entities (GL often blanks Name/Memo on batches)
{
  const { spawnSync } = require('child_process');
  const os = require('os');
  const extractScript = path.join(__dirname, 'extract_qbo_deposit_gifts.py');
  const extractOut = path.join(os.tmpdir(), 'qbo_named_gifts_2026.json');
  if (fs.existsSync(extractScript)) {
    console.log('Ingesting QBO Deposit/SalesReceipt entity lines from local mirror');
    const extracted = spawnSync('python', [extractScript, extractOut], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (extracted.status !== 0) {
      console.warn('QBO entity extract failed:', (extracted.stderr || extracted.stdout || '').slice(0, 500));
    } else if (fs.existsSync(extractOut)) {
      const payload = JSON.parse(fs.readFileSync(extractOut, 'utf8'));
      const directory = payload.directory || { customers: [], vendors: [] };
      const dirById = new Map();
      const dirByNameCustomer = new Map();
      const dirByNameVendor = new Map();

      function indexDirEntry(entry, type, nameMap) {
        if (!entry) return;
        const id = String(entry.id || '').trim();
        if (id) dirById.set(`${type}:${id}`, entry);
        const k = aliasKey(entry.displayName);
        if (k && !nameMap.has(k)) nameMap.set(k, entry);
      }
      for (const cust of directory.customers || []) indexDirEntry(cust, 'CUSTOMER', dirByNameCustomer);
      for (const vend of directory.vendors || []) indexDirEntry(vend, 'VENDOR', dirByNameVendor);

      function fillFromDirectory(donor, entityType, entityId, donorName) {
        const type = String(entityType || '').toUpperCase();
        const id = String(entityId || '').trim();
        const nameKey = aliasKey(donorName || donor.name);
        const fromId = type && id ? dirById.get(`${type}:${id}`) : null;
        const fromCust = nameKey ? dirByNameCustomer.get(nameKey) : null;
        const fromVend = nameKey ? dirByNameVendor.get(nameKey) : null;
        const order = [];
        if (fromId && type === 'CUSTOMER') order.push(fromId);
        if (fromCust) order.push(fromCust);
        if (fromId && type === 'VENDOR') order.push(fromId);
        if (fromVend) order.push(fromVend);
        for (const entry of order) {
          if (!donor.email && entry.email) {
            const em = String(entry.email).trim().toLowerCase();
            const owner = emailIndex.get(em);
            if (!owner || owner === donor) {
              donor.email = em;
              emailIndex.set(em, donor);
            }
          }
          if (!donor.phone && entry.phone) donor.phone = cleanPhone(entry.phone);
          if (!donor.address && entry.address) {
            const formatted = formatMailingAddress(entry.address);
            if (formatted) donor.address = formatted;
          }
        }
      }

      const entityGiftCount = ingestDepositEntityGifts(payload.gifts, fillFromDirectory);

      // Fill remaining blanks from Customer, then Vendor, by display name.
      let filledContacts = 0;
      for (const donor of donorMap.values()) {
        const before = `${donor.email}|${donor.phone}|${donor.address}`;
        fillFromDirectory(donor, '', '', donor.name);
        const after = `${donor.email}|${donor.phone}|${donor.address}`;
        if (after !== before) filledContacts += 1;
      }
      console.log('QBO entity/description gift lines considered:', entityGiftCount);
      console.log('QBO directory fill-blank contacts:', filledContacts);
    }
  } else {
    console.warn('extract_qbo_deposit_gifts.py not found; batch deposit names will be skipped');
  }
}

// 5c. Staff-photographed split deposits (QBO-style: one line per payer + cash)
{
  const manualPath = path.join(__dirname, 'data', 'manual_deposit_splits.json');
  if (fs.existsSync(manualPath)) {
    const manual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
    const gifts = flattenManualDepositSplits(manual);
    const n = ingestDepositEntityGifts(gifts);
    console.log('Manual split-deposit gift lines considered:', n);
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
  donor.itemizedTotal = Math.round(itemizedSum * 100) / 100;
  donor.lifetimeTotal = Math.max(itemizedSum, baseline);
  donor.transactionsCount = Math.max(donor.gifts.length, donor.baselineTxs || 0);
  donor.isAggregate = Boolean(donor.isAggregate) || isAggregateName(donor.name);

  // Skip zero/negative or systemic artifacts
  if (donor.lifetimeTotal <= 0 && donor.transactionsCount === 0) continue;
  if (donor.name.toLowerCase().includes('square inc') || donor.name.toLowerCase() === 'deposit') continue;

  const tier = getGivingTier(donor.lifetimeTotal);
  donor.givingTier = tier.label;
  donor.tierId = tier.id;
  donor.tierColor = tier.color;

  donor.platformsList = Array.from(donor.platforms);
  donor.campaignsList = Array.from(new Set(Array.from(donor.campaigns).map((c) => campaignFromQboAccount(c, donor.name, c))));
  donor.address = formatMailingAddress(donor.address);
  donor.hasMailingAddress = isCompleteMailingAddress(donor.address);

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

const compileAssert = assertDonorInvariants(finalDonors);
for (const msg of compileAssert.messages) console.warn('[compile-assert]', msg);
if (compileAssert.ok) {
  const boa = finalDonors.find((d) => aliasKey(d.name) === 'bank of america');
  const trust = finalDonors.find((d) => /^trust fund payment \(via bank of america\)$/i.test(d.name));
  const county = finalDonors.find((d) => aliasKey(d.name) === 'county of monroe');
  console.log('[compile-assert] Bank of America lifetime', boa && boa.lifetimeTotal, 'gifts', boa && boa.gifts.length, 'address', JSON.stringify(boa && boa.address));
  console.log('[compile-assert] Trust Fund Payment gifts', trust && trust.gifts.map((g) => `${g.date} $${g.amount} ${g.campaign} #${g.checkNumber}`).join('; '), 'aggregate', trust && trust.isAggregate);
  const y2026 = (county && county.gifts || []).filter((g) => String(g.date).startsWith('2026') && g.amount > 7000);
  console.log('[compile-assert] COUNTY OF MONROE 2026 contracts', y2026.map((g) => `${g.date} $${g.amount} ${g.campaign} #${g.checkNumber}`).join('; '), 'address', JSON.stringify(county && county.address));
} else {
  console.warn('[compile-assert] FAILED', compileAssert.messages.length, 'issue(s)');
}

// Server-side only. Do not write frontend/src/data — Astro SSG would bake PII into public HTML.
const targetApi = 'api/data/donor_database.json';

if (!fs.existsSync('api/data')) fs.mkdirSync('api/data', { recursive: true });
fs.writeFileSync(targetApi, JSON.stringify(databasePayload), 'utf8');
console.log('Wrote api dataset:', targetApi, `(${(fs.statSync(targetApi).size / (1024 * 1024)).toFixed(2)} MB)`);

console.log('Compilation Complete!');
