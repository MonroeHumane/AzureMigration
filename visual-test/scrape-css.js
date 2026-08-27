const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://monroe-humane.org', { waitUntil: 'networkidle' });

  // Get all <link rel="stylesheet"> hrefs
  const styles = await page.$$eval('link[rel="stylesheet"]', links => links.map(l => l.href));
  
  // Get all inline <style> blocks
  const inlineStyles = await page.$$eval('style', styles => styles.map(s => s.id + ':\n' + s.innerHTML));

  fs.writeFileSync('live-styles-info.json', JSON.stringify({ styles, inlineStyles }, null, 2));

  await browser.close();
})();
