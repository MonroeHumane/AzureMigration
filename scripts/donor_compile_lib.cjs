'use strict';

function normName(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseNameJoiners(s) {
  return String(s || '')
    .replace(/\s*\(deleted\)\s*/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasKey(s) {
  const collapsed = normName(collapseNameJoiners(s))
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const mapped = NAME_ALIAS_DISPLAY[collapsed];
  if (mapped) {
    return normName(mapped)
      .replace(/\band\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return collapsed;
}

const NAME_ALIAS_DISPLAY = {
  'doug kuras': 'DOUGLAS KURAS',
  'douglas kuras': 'DOUGLAS KURAS',
  'kevin and valerie mitchell': 'KEVIN & VALERIE MITCHELL',
  'kevin valerie mitchell': 'KEVIN & VALERIE MITCHELL',
  'county of monroe': 'COUNTY OF MONROE',
  'county of monroe finance department': 'COUNTY OF MONROE',
};

function resolveDonorName(raw) {
  const cleaned = collapseNameJoiners(raw);
  const n = normName(cleaned);
  const ak = aliasKey(cleaned);
  return NAME_ALIAS_DISPLAY[n] || NAME_ALIAS_DISPLAY[ak] || cleaned;
}

function isAggregateName(name) {
  const t = String(name || '').replace(/\s+/g, ' ').trim();
  if (/^(26|202[0-9])\s+AUCTION\b/i.test(t)) return true;
  if (/\bCAR SHOW EVENT\b/i.test(t)) return true;
  if (/^trust fund payment\b/i.test(t)) return true;
  return false;
}

const QBO_CAMPAIGN_MAP = {
  'Donations directed by individuals': 'Individual Donor Contributions',
  'Individual Donor Contributions': 'Individual Donor Contributions',
  'Corporate Donations': 'Corporate Donations',
  'Donation Canisters (Dog Banks)': 'Canister & Community Coin Banks',
  'Canister & Community Coin Banks': 'Canister & Community Coin Banks',
  'Cat Room Expansion Fund': 'Cat Room Expansion Fund',
  'Foundation Grants': 'Foundation Grants',
  FOUNDATION: 'Foundation Grants',
  'FOUNDATION MONEY': 'Foundation Grants',
  'Government grants & contracts': 'Municipal Contracts & Grants',
  'Municipal Contracts & Grants': 'Municipal Contracts & Grants',
  'Municipal / County Contract': 'Municipal / County Contract',
  'Grants from other nonprofits': 'Grants from Other Nonprofits',
  'Grants from Other Nonprofits': 'Grants from Other Nonprofits',
  'Memorial Donations': 'Memorial Donations',
  'Event Donation': 'Event Proceeds & Ticket Donations',
  'Event Proceeds & Ticket Donations': 'Event Proceeds & Ticket Donations',
  'Quarterly Endowment Distributions': 'Community Foundation Endowment Grants',
  'Community Foundation Endowment Grants': 'Community Foundation Endowment Grants',
  'Court Restitution': 'Court Restitution',
  'Retail Partner Rebates': 'Retail Partner Rebates (Kroger/Meijer)',
  'Retail Partner Rebates (Kroger/Meijer)': 'Retail Partner Rebates (Kroger/Meijer)',
};

function campaignFromQboAccount(account, donorName, fallback) {
  if (/county of monroe/i.test(donorName || '')) return 'Municipal / County Contract';
  const raw = String(account || '').trim();
  const leaf = raw.includes(':') ? raw.split(':').pop().trim() : raw;
  if (QBO_CAMPAIGN_MAP[raw]) return QBO_CAMPAIGN_MAP[raw];
  if (QBO_CAMPAIGN_MAP[leaf]) return QBO_CAMPAIGN_MAP[leaf];
  return leaf || fallback || 'Direct Gift';
}

const BANK_PROCESSOR_RE = /^(bank of america|bofa|fifth third( bank)?|wells fargo|jp ?morgan|chase bank|huntington( national)?( bank)?|pnc bank|comerica( bank)?)$/i;

function isBankProcessorName(name) {
  return BANK_PROCESSOR_RE.test(collapseNameJoiners(name));
}

function looksLikeNamedDonor(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (t.length < 5 || t.length > 80) return false;
  const words = t.split(' ');
  if (words.length < 2) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w) || /^(AND|&|OF|THE|SON|FOR)$/i.test(w));
}

function resolveDepositPayor(entityName, description, account) {
  const entity = resolveDonorName(entityName);
  const desc = String(description || '').replace(/\s+/g, ' ').trim();
  const acct = String(account || '');
  if (isBankProcessorName(entity) || isBankProcessorName(entityName)) {
    const trustLike = /trust fund|\btrust\b|estate of/i.test(desc) || /foundation/i.test(acct);
    if (trustLike) {
      if (
        looksLikeNamedDonor(desc)
        && !isBankProcessorName(desc)
        && !/^trust fund payment$/i.test(desc)
      ) {
        return { name: resolveDonorName(desc), aggregate: isAggregateName(desc), via: entity };
      }
      return {
        name: `Trust Fund Payment (via ${entity})`,
        aggregate: true,
        via: entity,
      };
    }
  }
  const resolved = entity || collapseNameJoiners(entityName);
  return { name: resolved, aggregate: isAggregateName(resolved), via: '' };
}

function formatMailingAddress(...inputs) {
  const tokens = [];
  for (const raw of inputs) {
    if (raw == null) continue;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const cityLine = [raw.City, raw.CountrySubDivisionCode, raw.PostalCode]
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .join(' ');
      [raw.Line1, raw.Line2, cityLine].forEach((p) => {
        String(p || '').split(/[|,]/).forEach((bit) => {
          const t = bit.trim();
          if (t) tokens.push(t);
        });
      });
      continue;
    }
    String(raw).split(/[|,]/).forEach((bit) => {
      const t = bit.trim().replace(/\s+/g, ' ');
      if (t) tokens.push(t);
    });
  }
  const out = [];
  for (const t of tokens) {
    if (!out.length || out[out.length - 1].toLowerCase() !== t.toLowerCase()) out.push(t);
  }
  if (!out.length) return '';
  if (out.length === 1 && /^[A-Z]{2}$/i.test(out[0])) return '';
  if (out.length === 1 && /^(MI|[A-Z]{2})\s*$/i.test(out[0])) return '';
  let joined = out.join(', ');
  joined = joined.replace(/^[,\s]+/, '').replace(/[,\s]+$/, '').replace(/\s*,\s*/g, ', ');
  if (/^,\s*MI\b/i.test(joined) || /^MI\s*$/i.test(joined)) return '';
  return joined;
}

function isCompleteMailingAddress(address) {
  const a = formatMailingAddress(address);
  if (!a || a.length < 6) return false;
  if (/^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/i.test(a)) return false;
  if (/^,\s*/.test(a)) return false;
  return true;
}

function assertDonorInvariants(donors) {
  const messages = [];
  const boa = (donors || []).find((d) => aliasKey(d.name) === 'bank of america');
  const trust = (donors || []).find((d) => /^trust fund payment \(via bank of america\)$/i.test(d.name || ''));
  const county = (donors || []).find((d) => aliasKey(d.name) === 'county of monroe');
  const financeSplit = (donors || []).filter((d) => /finance department/i.test(d.name || ''));

  if (boa) {
    const large = (boa.gifts || []).filter((g) => Number(g.amount) > 1000);
    if (large.length) {
      messages.push(`Bank of America still has large gift(s): ${large.map((g) => g.amount).join(', ')}`);
    }
    if ((boa.address || '') && (/^\s*,/.test(boa.address) || /^,?\s*MI\s*$/i.test(boa.address))) {
      messages.push(`Bank of America has junk address: ${JSON.stringify(boa.address)}`);
    }
  } else {
    messages.push('Bank of America card missing (expected $79 BetterUnite leftover)');
  }

  if (!trust) {
    messages.push('Trust Fund Payment (via Bank of America) card missing');
  } else {
    const hit = (trust.gifts || []).find((g) => Math.abs(Number(g.amount) - 50959.75) < 0.05);
    if (!hit) messages.push('Trust Fund Payment card missing $50,959.75');
    else {
      if (hit.campaign !== 'Foundation Grants') messages.push(`Trust gift campaign is ${hit.campaign}, expected Foundation Grants`);
      if (String(hit.checkNumber || '') !== '3422622') messages.push(`Trust gift check is ${hit.checkNumber}`);
      if (!trust.isAggregate) messages.push('Trust Fund Payment card should be isAggregate');
    }
  }

  if (!county) {
    messages.push('COUNTY OF MONROE card missing');
  } else {
    const y2026 = (county.gifts || []).filter((g) => String(g.date).startsWith('2026') && Number(g.amount) > 7000);
    if (y2026.length < 3) messages.push(`County 2026 contract gifts: ${y2026.length} (expected 3)`);
    if (y2026.some((g) => g.campaign !== 'Municipal / County Contract')) {
      messages.push(`County 2026 campaign(s): ${y2026.map((g) => g.campaign).join(' | ')}`);
    }
    if (financeSplit.length) {
      messages.push(`County finance split still present: ${financeSplit.map((d) => d.name).join(', ')}`);
    }
    if ((county.address || '') && (/^\s*,/.test(county.address) || /St\.\s+,/.test(county.address))) {
      messages.push(`County address formatting: ${JSON.stringify(county.address)}`);
    }
  }

  const junk = (donors || []).filter((d) => d.address && (/^\s*,/.test(d.address) || /^,?\s*MI\s*$/i.test(String(d.address).trim())));
  if (junk.length) messages.push(`Junk addresses: ${junk.length} (e.g. ${junk[0].name} ${JSON.stringify(junk[0].address)})`);

  return { ok: messages.length === 0, messages };
}

module.exports = {
  normName,
  collapseNameJoiners,
  aliasKey,
  NAME_ALIAS_DISPLAY,
  resolveDonorName,
  isAggregateName,
  QBO_CAMPAIGN_MAP,
  campaignFromQboAccount,
  isBankProcessorName,
  looksLikeNamedDonor,
  resolveDepositPayor,
  formatMailingAddress,
  isCompleteMailingAddress,
  assertDonorInvariants,
};
