import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import partytown from '@astrojs/partytown';

export default defineConfig({
  site: 'https://monroe-humane.org',
  output: 'static', 
  integrations: [sitemap(), partytown()],
});