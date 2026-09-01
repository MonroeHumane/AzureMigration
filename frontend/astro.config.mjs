import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://monroe-humane.org',
  output: 'static',
  integrations: [sitemap(), partytown()],

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    domains: ['mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io'],
  },
});