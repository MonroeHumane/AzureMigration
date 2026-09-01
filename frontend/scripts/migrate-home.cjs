const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../src/pages/index.astro');
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  // Typography & Layout Wrappers
  ['class="wp-block-group alignwide home-editable-section is-layout-constrained"', 'class="max-w-7xl mx-auto px-4 py-16"'],
  ['class="wp-block-group home-editable-intro-card is-layout-constrained"', 'class="bg-teal-50/50 rounded-3xl p-8 sm:p-12 shadow-sm border border-teal-900/5"'],
  ['class="wp-block-columns are-vertically-aligned-center is-layout-flex"', 'class="flex flex-col lg:flex-row items-center gap-12"'],
  ['class="wp-block-column is-vertically-aligned-center is-layout-flow"', 'class="flex-1"'],
  ['class="wp-block-column is-layout-flow"', 'class="flex-1 w-full"'],
  
  ['class="home-editable-pill wp-block-paragraph"', 'class="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-3"'],
  ['class="wp-block-heading"', 'class="text-4xl font-serif text-teal-900 mb-6 leading-tight"'],
  ['class="wp-block-paragraph"', 'class="text-lg text-gray-700 leading-relaxed mb-8"'],
  
  // Buttons
  ['class="wp-block-buttons is-layout-flex"', 'class="flex flex-wrap gap-4"'],
  ['class="wp-block-button"', 'class=""'],
  ['class="wp-block-button__link has-base-color has-contrast-background-color has-text-color has-background wp-element-button"', 'class="inline-flex items-center justify-center font-bold uppercase tracking-wider px-8 py-4 rounded-full transition-all shadow-md hover:-translate-y-1 bg-teal-900 text-white hover:bg-teal-700"'],
  ['class="wp-block-button__link has-base-color has-vivid-cyan-blue-background-color has-text-color has-background wp-element-button"', 'class="inline-flex items-center justify-center font-bold uppercase tracking-wider px-8 py-4 rounded-full transition-all shadow-md hover:-translate-y-1 bg-teal-700 text-white hover:bg-teal-900"'],
  ['class="wp-block-button__link wp-element-button"', 'class="inline-flex items-center justify-center font-bold uppercase tracking-wider px-8 py-4 rounded-full transition-all border-2 border-teal-700 text-teal-700 hover:-translate-y-1 hover:bg-teal-50"'],
  ['class="wp-block-button is-style-outline"', 'class=""'],
  
  // Stats Grids
  ['class="home-editable-stat-grid"', 'class="grid grid-cols-1 sm:grid-cols-2 gap-4"'],
  ['class:list={[\'home-editable-stat\', { \'is-accent\': s.accent }]}', 'class:list={["bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-start", { "border-l-4 border-l-emerald-500": s.accent }]}'],
  ['<strong>{s.kicker}</strong>', '<strong class="text-xs uppercase tracking-widest text-gray-400 mb-2">{s.kicker}</strong>'],
  ['<h3>{s.title}</h3>', '<h3 class="text-3xl font-serif text-teal-900 mb-2">{s.title}</h3>'],
  ['<p>{s.body}</p>', '<p class="text-sm text-gray-600 leading-relaxed">{s.body}</p>'],

  // Feature Card (Split image/text)
  ['class="wp-block-group home-editable-feature-card is-layout-constrained"', 'class="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100"'],
  ['class="wp-block-columns are-vertically-aligned-stretch is-layout-flex"', 'class="flex flex-col lg:flex-row items-stretch"'],
  ['class="wp-block-column is-vertically-aligned-stretch home-editable-feature-media is-layout-flow"', 'class="w-full lg:w-5/12 bg-gray-100 relative min-h-[300px]"'],
  ['class="wp-block-image size-full"', 'class="absolute inset-0 w-full h-full"'],
  ['<img loading="lazy" decoding="async" src={home.feature_card.image} alt={home.feature_card.image_alt} />', '<img class="w-full h-full object-cover" loading="lazy" decoding="async" src={home.feature_card.image} alt={home.feature_card.image_alt} />'],
  ['class="wp-block-column is-vertically-aligned-center home-editable-feature-copy is-layout-flow"', 'class="w-full lg:w-7/12 p-8 sm:p-12 lg:p-16 flex flex-col justify-center"'],
  ['class="home-editable-section-label wp-block-paragraph"', 'class="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-3"'],

  // Hero Fence
  ['class="hs-feature-widget"', 'class="bg-teal-900 rounded-3xl overflow-hidden shadow-lg flex flex-col lg:flex-row text-white"'],
  ['class="hs-wrap"', 'class="flex flex-col lg:flex-row w-full"'],
  ['class="hs-copy"', 'class="p-8 sm:p-12 lg:p-16 w-full lg:w-1/2 flex flex-col justify-center"'],
  ['class="hs-kicker"', 'class="text-emerald-300 font-bold uppercase tracking-widest text-sm mb-4"'],
  ['id="hs-hero-fence-title"', 'id="hs-hero-fence-title" class="text-4xl sm:text-5xl font-serif mb-6"'],
  ['class="hs-body"', 'class="text-teal-50 text-lg mb-6 leading-relaxed"'],
  ['class="hs-note"', 'class="bg-white/10 p-4 rounded-xl text-sm text-teal-100 mb-8 border border-white/10"'],
  ['class="hs-actions"', 'class="mt-auto"'],
  ['class="hs-btn"', 'class="inline-flex items-center justify-center px-8 py-4 bg-emerald-500 text-teal-900 rounded-full font-bold uppercase tracking-wider transition-all hover:bg-emerald-400 shadow-sm hover:-translate-y-1"'],
  ['class="hs-media"', 'class="w-full lg:w-1/2 relative min-h-[400px]"'],
  ['<img decoding="async" src={home.hero_fence.image} alt={home.hero_fence.image_alt} loading="lazy" />', '<img class="absolute inset-0 w-full h-full object-cover" decoding="async" src={home.hero_fence.image} alt={home.hero_fence.image_alt} loading="lazy" />'],
  
  // Sidebar / Flyers Rail (Left side nav on desktop)
  ['class="home-editable-page-index-shell"', 'class="hidden xl:block fixed top-1/2 -translate-y-1/2 left-8 w-64 z-40 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-gray-100"'],
  ['class="home-editable-page-index home-editable-page-index--mobile"', 'class="xl:hidden w-full bg-white border-b border-gray-200 overflow-x-auto p-4"'],
  ['class="home-editable-page-index home-editable-page-index--desktop"', 'class="mb-8"'],
  ['class="home-editable-page-index__title"', 'class="font-bold text-teal-900 uppercase tracking-widest text-xs mb-4"'],
  ['class="home-editable-page-index__list"', 'class="flex xl:flex-col gap-2"'],
  ['class="home-editable-page-index__item"', 'class="flex-shrink-0"'],
  ['class="home-editable-page-index__link"', 'class="text-sm font-medium text-gray-500 hover:text-teal-700 transition-colors"'],
  ['class="home-editable-flyers-rail"', 'class=""'],
  ['class="home-editable-flyers-rail__title"', 'class="font-bold text-teal-900 uppercase tracking-widest text-xs mb-4"'],
  ['class="home-editable-flyers-rail__items"', 'class="rounded-xl overflow-hidden shadow-sm"'],
  ['class="home-editable-flyers-rail__item"', 'class="block hover:opacity-90 transition-opacity"'],
];

replacements.forEach(([search, replace]) => {
  content = content.split(search).join(replace);
});

// Save it back
fs.writeFileSync(targetFile, content);
console.log('Homepage partially migrated to Tailwind classes via script!');
