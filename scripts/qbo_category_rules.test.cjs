'use strict';

const assert = require('assert');
const {
  loadRecodeMap,
  indexRecodeMap,
  applyCategoryRules,
  cents,
} = require('./qbo_category_rules.cjs');

const ACCOUNT_NORMALIZATION = {
  'Government grants & contracts': { name: 'Municipal Contracts & Grants', group: 'Contributed Income' },
  'Foundation Grants': { name: 'Foundation Grants', group: 'Contributed Income' },
  'Retail Partner Rebates': { name: 'Retail Partner Rebates (Kroger/Meijer)', group: 'Community Support' },
  'Laundry & Sanitation Services': { name: 'Laundry & Sanitation Services', group: 'Shelter Operations' },
  'Merchant Account Fees': { name: 'Merchant Gateway & Card Fees', group: 'Financial Operations' },
  'Software & Apps': { name: 'Software & Cloud Apps', group: 'Office & Admin' },
  'Quarterly Endowment Distributions': { name: 'Community Foundation Endowment Grants', group: 'Endowment Support' },
  'Corporate Donations': { name: 'Corporate Donations', group: 'Contributed Income' },
};

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const mapping = loadRecodeMap();
const recodeIndex = indexRecodeMap(mapping);

test('recode map indexes county / kroger / thrivent / unv ids', () => {
  assert.strictEqual(mapping.deposits.length > 10, true);
  assert.ok(recodeIndex.get(`5319:${cents(12555.48)}`));
  assert.ok(recodeIndex.get(`5497:${cents(901.99)}`));
  assert.ok(recodeIndex.get(`5100:${cents(375.14)}`));
  assert.ok(recodeIndex.get(`6742:${cents(482)}`));
  assert.ok(recodeIndex.get(`6455:${cents(100)}`));
  assert.strictEqual(recodeIndex.get(`5319:${cents(12555.48)}`).target, 'government_grants');
  assert.strictEqual(recodeIndex.get(`6455:${cents(100)}`).target, 'contract_labor');
});

test('county endowment GL row remaps by deposit id even with blank payee', () => {
  const endowment = ACCOUNT_NORMALIZATION['Quarterly Endowment Distributions'];
  const out = applyCategoryRules({
    meta: endowment,
    isRev: true,
    memo: 'BALANCE OF 20K',
    payee: 'Branch Deposit Batch',
    txnId: '5920',
    amount: 7429.1,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  assert.strictEqual(out.meta.name, 'Municipal Contracts & Grants');
  assert.strictEqual(out.isRev, true);
  assert.strictEqual(out.payee, 'COUNTY OF MONROE');
});

test('kroger corporate GL row remaps by deposit id', () => {
  const corporate = ACCOUNT_NORMALIZATION['Corporate Donations'];
  const out = applyCategoryRules({
    meta: corporate,
    isRev: true,
    memo: 'Local business sponsorship / corporate partnership',
    payee: 'Branch Deposit Batch',
    txnId: '5497',
    amount: 901.99,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  assert.strictEqual(out.meta.name, 'Retail Partner Rebates (Kroger/Meijer)');
  assert.strictEqual(out.payee, 'Kroger');
  assert.strictEqual(out.isRev, true);
});

test('Thrivent 5100 keeps named memo payee and maps both $375.14 lines', () => {
  const individual = { name: 'Individual Donor Contributions', group: 'Contributed Income' };
  const a = applyCategoryRules({
    meta: individual,
    isRev: true,
    memo: 'BARBARA BOSSE',
    payee: 'Branch Deposit Batch',
    txnId: '5100',
    amount: 375.14,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  const b = applyCategoryRules({
    meta: individual,
    isRev: true,
    memo: '',
    payee: 'Branch Deposit Batch',
    txnId: '5100',
    amount: 375.14,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  assert.strictEqual(a.meta.name, 'Foundation Grants');
  assert.strictEqual(a.payee, 'BARBARA BOSSE');
  assert.strictEqual(b.meta.name, 'Foundation Grants');
  assert.strictEqual(mapping.keepBoth && mapping.keepBoth[0].id, '5100');
});

test('Robert Monteer woof lodge $100 remaps to Contract Labor by bill id', () => {
  const repairs = { name: 'Building Repairs & Maintenance', group: 'Shelter Operations' };
  const ACCOUNT_NORMALIZATION_LABOR = {
    ...ACCOUNT_NORMALIZATION,
    'Contract Labor': { name: 'Contract Labor', group: 'Personnel & Staffing' },
  };
  const out = applyCategoryRules({
    meta: repairs,
    isRev: false,
    memo: 'woof lodge  6 hours   20.00 per hour with tools',
    payee: 'Robert Monteer',
    txnId: '6455',
    amount: 100,
    accountNormalization: ACCOUNT_NORMALIZATION_LABOR,
    recodeIndex,
  });
  assert.strictEqual(out.meta.name, 'Contract Labor');
  assert.strictEqual(out.meta.group, 'Personnel & Staffing');
  assert.strictEqual(out.isRev, false);
  assert.strictEqual(out.payee, 'Robert Monteer');
  assert.strictEqual(out.recode, 'contract_labor');
});

test('memo fallback still catches THRIVENTGRANT / UNV / AUTHNET without id', () => {
  const thrivent = applyCategoryRules({
    meta: { name: 'Individual Donor Contributions', group: 'Contributed Income' },
    isRev: true,
    memo: 'THRIVENTGRANT 2929',
    payee: '',
    txnId: '',
    amount: 2929,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  assert.strictEqual(thrivent.meta.name, 'Foundation Grants');
  const laundry = applyCategoryRules({
    meta: { name: 'Directors & Officers Insurance', group: 'Insurance & Risk' },
    isRev: false,
    memo: 'UNV LAUNDRY Hold',
    payee: 'IRS',
    txnId: '',
    amount: 482,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  assert.strictEqual(laundry.meta.name, 'Laundry & Sanitation Services');
  assert.strictEqual(laundry.isRev, false);
  const fees = applyCategoryRules({
    meta: { name: 'Software & Cloud Apps', group: 'Office & Admin' },
    isRev: false,
    memo: 'AUTHNET GATEWAY',
    payee: 'IRS',
    txnId: '',
    amount: 30,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
  assert.strictEqual(fees.meta.name, 'Merchant Gateway & Card Fees');
});
