const fs = require('fs');
let text = fs.readFileSync('src/pages/index.astro', 'utf8');

const target = `<div class="hidden xl:block fixed top-1/2 -translate-y-1/2 left-8 w-64 z-40 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-gray-100">
    <nav class="xl:hidden w-full bg-white border-b border-gray-200 overflow-x-auto p-4" aria-label="Jump to section">
      <ul class="flex xl:flex-col gap-2">
        {home.page_index.map((id) => (
          <li class="flex-shrink-0">
            <a class="text-sm font-medium text-gray-500 hover:text-teal-700 transition-colors" href={\`#\${id}\`}>{indexLabels[id] ?? id}</a>
          </li>
        ))}
      </ul>
    </nav>

    <div class="home-editable-side-rail">
      <nav class="mb-8" aria-label="On this page">
        <p class="font-bold text-teal-900 uppercase tracking-widest text-xs mb-4">On this page</p>
        <ul class="flex xl:flex-col gap-2">
          {home.page_index.map((id) => (
            <li class="flex-shrink-0">
              <a class="text-sm font-medium text-gray-500 hover:text-teal-700 transition-colors" href={\`#\${id}\`}>{indexLabels[id] ?? id}</a>
            </li>
          ))}
        </ul>
      </nav>

      <aside class="" aria-label="Flyers">
        <p class="font-bold text-teal-900 uppercase tracking-widest text-xs mb-4">{home.flyers_rail.title}</p>
        <div class="rounded-xl overflow-hidden shadow-sm">
          <a class="block hover:opacity-90 transition-opacity" href="/events">
            <img src={home.flyers_rail.flyer_image} alt={home.flyers_rail.flyer_alt} loading="lazy" decoding="async" />
          </a>
        </div>
      </aside>
    </div>
  </div>`;

const replacement = `  <!-- Mobile Sticky TOC -->
  <nav class="xl:hidden sticky top-[52px] z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-200 overflow-x-auto p-3 shadow-sm" aria-label="Jump to section">
    <ul class="flex gap-4 min-w-max">
      {home.page_index.map((id) => (
        <li>
          <a class="text-xs font-bold uppercase tracking-widest text-teal-900 hover:text-emerald-600 transition-colors" href={\`#\${id}\`}>{indexLabels[id] ?? id}</a>
        </li>
      ))}
    </ul>
  </nav>

  <!-- Desktop Fixed TOC -->
  <div class="hidden xl:flex flex-col gap-8 fixed top-32 left-8 w-64 z-40 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-gray-100 max-h-[calc(100vh-10rem)] overflow-y-auto">
    <nav aria-label="On this page">
      <p class="font-bold text-teal-900 uppercase tracking-widest text-xs mb-4">On this page</p>
      <ul class="flex flex-col gap-2">
        {home.page_index.map((id) => (
          <li class="flex-shrink-0">
            <a class="text-sm font-medium text-gray-500 hover:text-teal-700 transition-colors" href={\`#\${id}\`}>{indexLabels[id] ?? id}</a>
          </li>
        ))}
      </ul>
    </nav>

    <aside aria-label="Flyers">
      <p class="font-bold text-teal-900 uppercase tracking-widest text-xs mb-4">{home.flyers_rail.title}</p>
      <div class="rounded-xl overflow-hidden shadow-sm">
        <a class="block hover:opacity-90 transition-opacity" href="/events">
          <img src={home.flyers_rail.flyer_image} alt={home.flyers_rail.flyer_alt} loading="lazy" decoding="async" />
        </a>
      </div>
    </aside>
  </div>`;

if (text.includes(target)) {
    text = text.replace(target, replacement);
    fs.writeFileSync('src/pages/index.astro', text, 'utf8');
    console.log('Fixed index.astro TOC');
} else {
    console.log('Target not found in index.astro');
}