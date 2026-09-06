const fs = require('fs');
const path = require('path');

const distEvents = path.resolve(__dirname, '..', 'frontend', 'dist', 'events', 'index.html');
const distMembership = path.resolve(__dirname, '..', 'frontend', 'dist', 'membership', 'index.html');

console.log('--- AUDITING EVENTS PAGE ---');
const eventsHtml = fs.readFileSync(distEvents, 'utf-8');

// 1. Check Calendar element
const hasCalendar = eventsHtml.includes('id="Calendar"') || eventsHtml.includes('id="calendar"');
const hasPrevMonth = eventsHtml.includes('id="cal-prev-month"');
const hasNextMonth = eventsHtml.includes('id="cal-next-month"');
const hasTodayBtn = eventsHtml.includes('id="cal-today-btn"');
const hasMonthTitle = eventsHtml.includes('id="cal-month-title"');
const hasDaysGrid = eventsHtml.includes('id="calendar-days-grid"');
console.log('1. Calendar container & nav elements:', { hasCalendar, hasPrevMonth, hasNextMonth, hasTodayBtn, hasMonthTitle, hasDaysGrid });

// 2. Check Staff Portal integration
const hasStaffBanner = eventsHtml.includes('id="staff-event-banner"');
const hasStaffFlyersBtn = eventsHtml.includes('id="staff-edit-flyers-btn"');
const hasStaffSyncBtn = eventsHtml.includes('id="staff-reload-sync-btn"');
const hasStaffDeepLink = eventsHtml.includes('/internal/content#pane-flyers');
console.log('2. Staff portal integration elements:', { hasStaffBanner, hasStaffFlyersBtn, hasStaffSyncBtn, hasStaffDeepLink });

// 3. Check Date Filter Banner
const hasDateBanner = eventsHtml.includes('id="cal-filter-banner"');
const hasClearDateBtn = eventsHtml.includes('id="btn-clear-date-filter"');
console.log('3. Date filter banner:', { hasDateBanner, hasClearDateBtn });

// 4. Check Pet Scroller
const hasPetScrollerBadge = eventsHtml.includes('Shelter Pets Supported');
const hasPetLinks = eventsHtml.includes('/adopt/') && eventsHtml.includes('Meet pet');
console.log('4. Active Pet Scroller:', { hasPetScrollerBadge, hasPetLinks });

// 5. Check Sync modal
const hasSyncModal = eventsHtml.includes('id="calendar-sync-modal"');
const hasOpenSyncModal = eventsHtml.includes('id="btn-open-sync-modal"');
console.log('5. Sync modal:', { hasSyncModal, hasOpenSyncModal });

console.log('\n--- AUDITING MEMBERSHIP PAGE ---');
const membershipHtml = fs.readFileSync(distMembership, 'utf-8');

// 1. Check no prices exist
const prices = ['$15', '$25', '$40', '$500', '$100', 'Senior / Student', 'Most Popular', 'Annual Member Shirt for Life'];
const foundPrices = prices.filter(p => membershipHtml.includes(p));
console.log('1. Pricing tiers removed:', foundPrices.length === 0, foundPrices);

// 2. Check work in progress message
const hasWip = membershipHtml.includes('Work in Progress');
const hasDetailsNotDecided = membershipHtml.includes('not yet been decided') || membershipHtml.includes('Details Not Decided');
console.log('2. Work in progress messaging:', { hasWip, hasDetailsNotDecided });

// 3. Check wayfinding links
const hasDonateLink = membershipHtml.includes('href="/donate"');
const hasNewsletterLink = membershipHtml.includes('href="/newsletter"');
const hasResourcesLink = membershipHtml.includes('href="/resources"');
console.log('3. Key wayfinding links:', { hasDonateLink, hasNewsletterLink, hasResourcesLink });

console.log('\nALL CHECKS COMPLETE.');
