import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import tailwindcss from '@tailwindcss/vite';

import newslettersData from './src/data/newsletters.json';

const newsletterIssuePages = (newslettersData || [])
  .filter((row) => row && row.status === 'published' && row.slug)
  .map((row) => `https://monroe-humane.org/newsletter/issue/${encodeURIComponent(row.slug)}`);

export default defineConfig({
  site: 'https://monroe-humane.org',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/internal/'),
      customPages: [
        'https://monroe-humane.org/newsletter/rss.xml',
        ...newsletterIssuePages,
      ],
    }),
    partytown(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    // mchsstorage... is where PetSync re-hosts pet photos (cron/src/sync-pets.ts)
    // -- pet.image_url points there directly, not at Directus, so PetCard.astro's
    // <Image> component was silently skipping optimization for every pet photo
    // (Astro passes through unrecognized remote domains unmodified, no build error).
    domains: [
      'mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io',
      'mchsstorage2urwob6xh6j6s.blob.core.windows.net',
      'g.petango.com',
      'images.petango.com',
    ],
  },
});
