'use strict';

const assert = require('assert');
const {
  aliasKey,
  resolveDonorName,
  isAggregateName,
  campaignFromQboAccount,
  isBankProcessorName,
  resolveDepositPayor,
  flattenManualDepositSplits,
  formatMailingAddress,
  isCompleteMailingAddress,
  assertDonorInvariants,
} = require('./donor_compile_lib.cjs');

function test(name, fn) {
  fn();
  console.log('ok', name);
}

test('formatMailingAddress drops leading comma / state-only MI', () => {
  assert.strictEqual(formatMailingAddress(', MI'), '');
  assert.strictEqual(formatMailingAddress('| MI'), '');
  assert.strictEqual(formatMailingAddress('MI'), '');
  assert.strictEqual(formatMailingAddress(' , MI '), '');
});

test('formatMailingAddress cleans pipe master-roll streets', () => {
  assert.strictEqual(
    formatMailingAddress('125 E. Second St. | Monroe, MI 48161'),
    '125 E. Second St., Monroe, MI 48161'
  );
  assert.strictEqual(
    formatMailingAddress('125 E. Second St. ,  Monroe, MI 48161'),
    '125 E. Second St., Monroe, MI 48161'
  );
});

test('formatMailingAddress never emits leading comma', () => {
  const samples = [', MI', '|MI|', ' | , MI , ', '', null, { City: '', CountrySubDivisionCode: 'MI' }];
  for (const s of samples) {
    const out = formatMailingAddress(s);
    assert.ok(!/^\s*,/.test(out), JSON.stringify(s) + ' -> ' + JSON.stringify(out));
    assert.ok(out !== ', MI');
  }
});

test('isCompleteMailingAddress rejects junk and accepts county hall', () => {
  assert.strictEqual(isCompleteMailingAddress(', MI'), false);
  assert.strictEqual(isCompleteMailingAddress('MI'), false);
  assert.strictEqual(isCompleteMailingAddress('125 E. Second St., Monroe, MI 48161'), true);
});

test('name aliases merge Doug and county finance', () => {
  assert.strictEqual(resolveDonorName('Doug Kuras'), 'DOUGLAS KURAS');
  assert.strictEqual(aliasKey('Doug Kuras'), aliasKey('DOUGLAS KURAS'));
  assert.strictEqual(resolveDonorName('County of Monroe Finance Department'), 'COUNTY OF MONROE');
  assert.strictEqual(aliasKey('Kevin and Valerie Mitchell'), aliasKey('KEVIN & VALERIE MITCHELL'));
  assert.strictEqual(resolveDonorName('Kevin and Valerie Mitchell (deleted)'), 'KEVIN & VALERIE MITCHELL');
});

test('campaign labels: FOUNDATION mapped, county not endowment', () => {
  assert.strictEqual(campaignFromQboAccount('FOUNDATION', 'Bank of America'), 'Foundation Grants');
  assert.strictEqual(campaignFromQboAccount('Contributed income:FOUNDATION MONEY', 'X'), 'Foundation Grants');
  assert.strictEqual(
    campaignFromQboAccount('Quarterly Endowment Distributions', 'COUNTY OF MONROE'),
    'Municipal / County Contract'
  );
  assert.strictEqual(
    campaignFromQboAccount('QUARTERLY', 'County of Monroe Finance Department'),
    'Municipal / County Contract'
  );
  assert.strictEqual(
    campaignFromQboAccount('Quarterly Endowment Distributions', 'Community Foundation of Southeast Michigan'),
    'Community Foundation Endowment Grants'
  );
});

test('BoA trust check is reassigned off the bank', () => {
  assert.strictEqual(isBankProcessorName('Bank of America'), true);
  const payor = resolveDepositPayor('Bank of America', 'TRUST FUND PAYMENT', 'FOUNDATION');
  assert.strictEqual(payor.name, 'Trust Fund Payment (via Bank of America)');
  assert.strictEqual(payor.aggregate, true);
  assert.strictEqual(payor.via, 'Bank of America');
  const leftover = resolveDepositPayor('Bank of America', '', 'Contributed income:Donations directed by individuals');
  assert.strictEqual(leftover.name, 'Bank of America');
  assert.strictEqual(leftover.aggregate, false);
});

test('aggregate vs person', () => {
  assert.strictEqual(isAggregateName('26 AUCTION SILENT AUCTION'), true);
  assert.strictEqual(isAggregateName('CAR SHOW EVENT 2026'), true);
  assert.strictEqual(isAggregateName('Trust Fund Payment (via Bank of America)'), true);
  assert.strictEqual(isAggregateName('Branch Cash Deposit'), true);
  assert.strictEqual(isAggregateName('DOUGLAS KURAS'), false);
  assert.strictEqual(isAggregateName('COUNTY OF MONROE'), false);
});

test('assertDonorInvariants catches BoA visionary mis-attribution', () => {
  const bad = assertDonorInvariants([
    {
      name: 'Bank of America',
      address: ', MI',
      gifts: [{ amount: 50959.75, campaign: 'FOUNDATION', checkNumber: '3422622', date: '2025-09-18' }],
    },
  ]);
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.messages.some((m) => /large gift/i.test(m)));
  assert.ok(bad.messages.some((m) => /junk address/i.test(m)));
});

test('assertDonorInvariants passes corrected BoA + county', () => {
  const good = assertDonorInvariants([
    { name: 'Bank of America', address: '', gifts: [{ amount: 79.17, campaign: 'Donate', date: '2020-04-21' }] },
    {
      name: 'Trust Fund Payment (via Bank of America)',
      isAggregate: true,
      gifts: [{ amount: 50959.75, campaign: 'Foundation Grants', checkNumber: '3422622', date: '2025-09-18' }],
    },
    {
      name: 'COUNTY OF MONROE',
      address: '125 E. Second St., Monroe, MI 48161',
      gifts: [
        { date: '2026-08-02', amount: 8479.38, campaign: 'Municipal / County Contract', checkNumber: '598522' },
        { date: '2026-05-14', amount: 7429.1, campaign: 'Municipal / County Contract', checkNumber: '596594' },
        { date: '2026-01-27', amount: 12555.48, campaign: 'Municipal / County Contract', checkNumber: '593999' },
      ],
    },
  ]);
  assert.strictEqual(good.ok, true, good.messages.join('\n'));
});

test('Sep 7 slip is one split deposit: 11 named checks + listed cash + uncounted cash', () => {
  const slip = require('./data/manual_deposit_splits.json');
  const gifts = flattenManualDepositSplits(slip);
  const checks = gifts.filter((g) => g.paymentMethod === 'Check');
  const cash = gifts.filter((g) => g.paymentMethod === 'Cash');
  const sum = (rows) => Math.round(rows.reduce((s, g) => s + Number(g.amount), 0) * 100) / 100;
  assert.strictEqual(gifts.length, 13);
  assert.strictEqual(checks.length, 11);
  assert.strictEqual(cash.length, 2);
  assert.strictEqual(sum(checks), 2492.17);
  assert.strictEqual(sum(cash), 1025);
  assert.strictEqual(sum(gifts), 3517.17);
  assert.ok(gifts.every((g) => g.parentId === '7952' && g.date === '2026-09-07'));
  assert.strictEqual(new Set(checks.map((g) => g.checkNum)).size, 11);
  assert.ok(checks.every((g) => g.donorName && g.checkNum));
  assert.ok(cash.every((g) => g.donorName === 'Branch Cash Deposit'));
  assert.strictEqual(isAggregateName('Branch Cash Deposit'), true);
  const listedCash = cash.find((g) => g.amount === 1002);
  const extraCash = cash.find((g) => g.amount === 23);
  assert.ok(listedCash && /listed on deposit slip/i.test(listedCash.description));
  assert.ok(extraCash && /not counted/i.test(extraCash.description));
  assert.strictEqual(aliasKey('David J. Durchman'), aliasKey('Dave Durchman'));
  assert.strictEqual(resolveDonorName('David J. Durchman'), 'Dave Durchman');
  const kroger = checks.find((g) => g.checkNum === '504892405');
  assert.strictEqual(kroger.donorName, 'Kroger');
  assert.strictEqual(kroger.description, 'Colin L. Fike');
  assert.strictEqual(campaignFromQboAccount(kroger.account), 'Retail Partner Rebates (Kroger/Meijer)');
});

console.log('All donor_compile tests passed');
