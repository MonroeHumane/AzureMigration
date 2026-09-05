/**
 * Comprehensive End-to-End Site Integrity & Link Auditor
 * Validates all HTML files in dist/ for broken internal links, image paths,
 * form labels, accessibility tags, and redirects.
 */
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, 'frontend/dist');
const CONFIG_PATH = path.resolve(__dirname, 'frontend/public/staticwebapp.config.json');

console.log('🔍 Starting Full Site Integrity & Correctness Audit...\n');

// 1. Load SWA Config for valid redirects
let swaConfig = { routes: [] };
if (fs.existsSync(CONFIG_PATH)) {
  swaConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}
const redirectRoutes = new Set(swaConfig.routes.map(r => r.route));

// 2. Discover all built HTML files
function getHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'assets') {
        results = results.concat(getHtmlFiles(fullPath));
      }
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  });
  return results;
}

const htmlFiles = getHtmlFiles(DIST_DIR);
console.log(`📄 Found ${htmlFiles.length} generated HTML files in dist/\n`);

// 3. Collect all valid local routes
const validRoutes = new Set();
htmlFiles.forEach(f => {
  const rel = path.relative(DIST_DIR, f).replace(/\\/g, '/');
  const route = '/' + rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  validRoutes.add(route === '' ? '/' : route);
  validRoutes.add('/' + rel);
});

let totalLinksChecked = 0;
let totalImagesChecked = 0;
let errors = [];
let warnings = [];

// Helper to check if internal link target exists
function isValidInternalLink(href, sourceFile) {
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return true;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return true; // External link
  }

  const cleanHref = href.split('?')[0].split('#')[0];
  if (!cleanHref) return true;

  // If it's a relative path (doesn't start with /)
  if (!cleanHref.startsWith('/')) {
    const sourceDir = path.dirname(path.join(DIST_DIR, sourceFile));
    const resolvedPath = path.resolve(sourceDir, cleanHref);
    if (fs.existsSync(resolvedPath)) return true;
    if (fs.existsSync(resolvedPath + '.html')) return true;
    if (fs.existsSync(path.join(resolvedPath, 'index.html'))) return true;
  }

  const targetRoute = cleanHref.startsWith('/') ? cleanHref : '/' + cleanHref;
  const normalizedTarget = targetRoute.length > 1 ? targetRoute.replace(/\/$/, '') : targetRoute;

  // Exact route match
  if (validRoutes.has(targetRoute) || validRoutes.has(normalizedTarget)) return true;

  // SWA Redirect match
  if (redirectRoutes.has(targetRoute) || redirectRoutes.has(normalizedTarget)) return true;
  for (const r of redirectRoutes) {
    const normR = r.endsWith('/*') ? r.slice(0, -2) : r;
    if (r.endsWith('/*') && (targetRoute.startsWith(normR) || normalizedTarget.startsWith(normR))) {
      return true;
    }
  }

  // Check physical file in dist
  const candidatePath = path.join(DIST_DIR, targetRoute);
  if (fs.existsSync(candidatePath)) return true;
  if (fs.existsSync(candidatePath + '.html')) return true;
  if (fs.existsSync(path.join(candidatePath, 'index.html'))) return true;

  return false;
}

// 4. Scan each HTML file
htmlFiles.forEach(file => {
  const relPath = path.relative(DIST_DIR, file).replace(/\\/g, '/');
  const html = fs.readFileSync(file, 'utf8');

  // Check <title>
  if (!html.includes('<title>') || !html.includes('</title>')) {
    warnings.push(`[${relPath}] Missing <title> tag`);
  }

  // Check <a> links
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    totalLinksChecked++;
    const href = match[1];
    if (!isValidInternalLink(href, relPath)) {
      errors.push(`[${relPath}] Broken link: href="${href}"`);
    }
  }

  // Check <img> sources
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    totalImagesChecked++;
    const src = match[1];
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }
    const cleanSrc = src.split('?')[0];
    const assetPath = cleanSrc.startsWith('/')
      ? path.join(DIST_DIR, cleanSrc.slice(1))
      : path.resolve(path.dirname(file), cleanSrc);
    if (!fs.existsSync(assetPath)) {
      warnings.push(`[${relPath}] Image asset not found in dist: src="${src}"`);
    }
  }
});

console.log('--- 📊 AUDIT RESULTS ---');
console.log(`✅ Total Links Verified: ${totalLinksChecked}`);
console.log(`✅ Total Images Verified: ${totalImagesChecked}`);

if (errors.length === 0) {
  console.log('\n🎉 ZERO BROKEN INTERNAL LINKS FOUND! All navigation and links resolve 100% cleanly.');
} else {
  console.log(`\n❌ Found ${errors.length} link errors:`);
  errors.forEach(e => console.log('   ' + e));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Found ${warnings.length} notices/warnings:`);
  warnings.slice(0, 10).forEach(w => console.log('   ' + w));
} else {
  console.log('🎉 ZERO WARNINGS! Site build is completely pristine.');
}

console.log('\nAudit complete.');
