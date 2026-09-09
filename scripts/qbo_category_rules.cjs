'use strict';

const fs = require('fs');
const path = require('path');

const MAP_PATH = path.join(__dirname, 'data', 'qbo_category_recodes.json');

const TARGET_TO_ACCOUNT = {
  government_grants: 'Government grants & contracts',
  foundation_grants: 'Foundation Grants',
  kroger_rebates: 'Retail Partner Rebates',
  laundry: 'Laundry & Sanitation Services',
  merchant_fees: 'Merchant Account Fees',
  software: 'Software & Apps',
};

const REVENUE_TARGETS = new Set(['government_grants', 'foundation_grants', 'kroger_rebates']);

const WEAK_PAYEE_RE = /^(branch deposit batch|humane society of monroe county|irs|shelter operational incurred|public \/ shelter adopters)$/i;

function cents(amount) {
  return Math.round(Number(amount) * 100);
}

function loadRecodeMap(mapPath) {
  const file = mapPath || MAP_PATH;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function indexRecodeMap(mapping) {
  const byTxnAmount = new Map();
  for (const dep of mapping.deposits || []) {
    for (const line of dep.lines || []) {
      const key = `${dep.id}:${cents(line.amount)}`;
      byTxnAmount.set(key, {
        target: line.target,
        payee: dep.payee || line.payee || '',
        reason: dep.reason,
        txnId: String(dep.id),
        amount: line.amount,
      });
    }
  }
  for (const pur of mapping.purchases || []) {
    const key = `${pur.id}:${cents(pur.amount)}`;
    byTxnAmount.set(key, {
      target: pur.target,
      payee: pur.payee || '',
      reason: pur.reason,
      txnId: String(pur.id),
      amount: pur.amount,
    });
  }
  return byTxnAmount;
}

function isWeakPayee(payee) {
  const t = String(payee || '').trim();
  return !t || WEAK_PAYEE_RE.test(t);
}

function memoPayeeFallback(memo) {
  const m = String(memo || '').trim();
  if (!m) return '';
  if (/deposit|first merchants|local business sponsorship|corporate partnership|balance of 20k/i.test(m)) {
    return '';
  }
  const first = m.split(/HUMANE SOCIETY/i)[0].replace(/\/.*/, '').trim();
  if (first && first.length >= 3 && first.length <= 80) return first.replace(/\s+/g, ' ');
  return '';
}

function applyMemoFallbacks(meta, isRev, memo, payee, accountNormalization) {
  const blob = `${memo || ''} ${payee || ''}`;
  if (/THRIVENTGRANT/i.test(blob)) {
    return {
      meta: accountNormalization['Foundation Grants'] || { name: 'Foundation Grants', group: 'Contributed Income' },
      isRev: true,
      payee,
      recode: 'foundation_grants',
    };
  }
  if (/UNV\s*LAUNDRY/i.test(blob)) {
    return {
      meta: accountNormalization['Laundry & Sanitation Services'],
      isRev: false,
      payee: /UNV/i.test(payee || '') ? payee : 'UNV Laundry',
      recode: 'laundry',
    };
  }
  if (/AUTHNET\s*GATEWAY/i.test(blob)) {
    return {
      meta: accountNormalization['Merchant Account Fees'],
      isRev: false,
      payee: payee && !isWeakPayee(payee) ? payee : 'Authorize.Net',
      recode: 'merchant_fees',
    };
  }
  if (/\bCANVA\b/i.test(blob) && /membership/i.test(String(meta && meta.name) + ' ' + blob)) {
    return {
      meta: accountNormalization['Software & Apps'],
      isRev: false,
      payee: payee && !isWeakPayee(payee) ? payee : 'Canva',
      recode: 'software',
    };
  }
  if (/COUNTY\s+(QUARTERLY\s+)?PAYMENT/i.test(blob) || /COUNTY OF MONROE/i.test(blob)) {
    return {
      meta: accountNormalization['Government grants & contracts'],
      isRev: true,
      payee: isWeakPayee(payee) ? 'COUNTY OF MONROE' : payee,
      recode: 'government_grants',
    };
  }
  return { meta, isRev, payee, recode: null };
}

function applyCategoryRules(opts) {
  const {
    meta,
    isRev,
    memo,
    payee,
    txnId,
    amount,
    accountNormalization,
    recodeIndex,
  } = opts;

  if (txnId && recodeIndex) {
    const hit = recodeIndex.get(`${String(txnId)}:${cents(amount)}`);
    if (hit && TARGET_TO_ACCOUNT[hit.target] && accountNormalization[TARGET_TO_ACCOUNT[hit.target]]) {
      let nextPayee = payee;
      if (isWeakPayee(payee)) {
        nextPayee = hit.payee || memoPayeeFallback(memo) || payee;
      }
      return {
        meta: accountNormalization[TARGET_TO_ACCOUNT[hit.target]],
        isRev: REVENUE_TARGETS.has(hit.target),
        payee: nextPayee,
        recode: hit.target,
      };
    }
  }

  return applyMemoFallbacks(meta, isRev, memo, payee, accountNormalization);
}

module.exports = {
  MAP_PATH,
  TARGET_TO_ACCOUNT,
  REVENUE_TARGETS,
  cents,
  loadRecodeMap,
  indexRecodeMap,
  isWeakPayee,
  memoPayeeFallback,
  applyMemoFallbacks,
  applyCategoryRules,
};
