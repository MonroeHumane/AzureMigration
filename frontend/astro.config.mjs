import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import tailwindcss from '@tailwindcss/vite';

const DIRECTUS_URL =
  process.env.PUBLIC_DIRECTUS_URL ||
  'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

async function publishedNewsletterPages() {
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&fields=slug&limit=-1`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (Array.isArray(json.data) ? json.data : [])
      .map((row) => row && row.slug)
      .filter(Boolean)
      .map((slug) => `https://monroe-humane.org/newsletter/issue/${encodeURIComponent(slug)}`);
  } catch {
    return [];
  }
}

const newsletterIssuePages = await publishedNewsletterPages();

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
    domains: ['mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io'],
  },
});
