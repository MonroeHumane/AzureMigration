// Test calendar math and filtering logic from events/index.astro
const assert = require('assert');

// Test data
const sampleEvents = [
  {
    title: 'Dine to Donate: Dirty Birdie Grill',
    event_date: '2026-09-08',
    category: 'dine-to-donate'
  },
  {
    title: 'Golf Outing',
    event_date: '2026-09-19',
    category: 'golf-sports'
  },
  {
    title: 'Casa de Margarita',
    event_date: '2026-10-06',
    category: 'dine-to-donate'
  }
];

function buildEventsMap(events) {
  const map = {};
  events.forEach(ev => {
    if (ev.event_date) {
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    }
  });
  return map;
}

const eventsMap = buildEventsMap(sampleEvents);
assert.strictEqual(eventsMap['2026-09-08'].length, 1);
assert.strictEqual(eventsMap['2026-09-19'].length, 1);
assert.strictEqual(eventsMap['2026-10-06'].length, 1);
assert.strictEqual(eventsMap['2026-09-01'], undefined);

// Test calendar grid generation for September 2026
// Sept 1 2026 is a Tuesday (index 2)
// Total days in Sept = 30
const year = 2026;
const month = 8; // September (0-indexed)

const firstDayIndex = new Date(year, month, 1).getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const daysInPrevMonth = new Date(year, month, 0).getDate();

console.log('Sept 2026:', { firstDayIndex, daysInMonth, daysInPrevMonth });
assert.strictEqual(firstDayIndex, 2); // Tuesday
assert.strictEqual(daysInMonth, 30);
assert.strictEqual(daysInPrevMonth, 31); // August has 31 days

// Total cells = leading + daysInMonth + trailing
const leadingDays = firstDayIndex;
const trailingDays = (7 - ((firstDayIndex + daysInMonth) % 7)) % 7;
const totalCells = leadingDays + daysInMonth + trailingDays;

console.log('Grid calculation:', { leadingDays, trailingDays, totalCells });
assert.strictEqual(totalCells % 7, 0, 'Grid must be a multiple of 7');

// Test month navigation boundary (Dec -> Jan)
let d = new Date(2026, 11, 1); // Dec 2026
d.setMonth(d.getMonth() + 1);
assert.strictEqual(d.getFullYear(), 2027);
assert.strictEqual(d.getMonth(), 0); // Jan

// Test month navigation boundary (Jan -> Dec)
d.setMonth(d.getMonth() - 1);
assert.strictEqual(d.getFullYear(), 2026);
assert.strictEqual(d.getMonth(), 11); // Dec

console.log('All calendar math assertions PASSED!');
