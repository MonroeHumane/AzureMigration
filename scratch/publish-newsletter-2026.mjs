import fs from 'node:fs';
import path from 'node:path';

const DIRECTUS = process.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';
const email = process.env.ADMIN_EMAIL || 'admin@monroe-humane.org';
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('missing ADMIN_PASSWORD');
  process.exit(1);
}

const repo = 'C:\\Users\\Jeff\\Documents\\AzureMigration';
const payloadPath = path.join(repo, 'scratch', 'newsletter-2026-issue.json');
const pdfPath = 'C:\\Users\\Jeff\\Downloads\\newsletter 2026.pdf';
const heroPath = path.join(repo, 'scratch', 'newsletter-2026-merch.png');

async function upload(token, filePath, filename, type) {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), filename);
  const res = await fetch(`${DIRECTUS}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.id) {
    throw new Error(`upload ${filename} failed ${res.status}`);
  }
  return json.data.id;
}

const login = await fetch(`${DIRECTUS}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginJson = await login.json().catch(() => ({}));
if (!login.ok || !loginJson?.data?.access_token) {
  throw new Error(`login failed ${login.status}`);
}
const token = loginJson.data.access_token;
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const existing = await fetch(
  `${DIRECTUS}/items/newsletter_issues?filter[slug][_eq]=september-2026&fields=id,slug,status,featured&limit=5`,
  { headers: auth }
);
const existingJson = await existing.json().catch(() => ({}));
const clash = Array.isArray(existingJson?.data) ? existingJson.data[0] : null;
if (clash) {
  console.log(`exists id=${clash.id} status=${clash.status} featured=${clash.featured}`);
  process.exit(0);
}

const pdfId = await upload(token, pdfPath, 'newsletter-2026.pdf', 'application/pdf');
const heroId = await upload(token, heroPath, 'newsletter-2026-merch.png', 'image/png');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
payload.pdf_url = `${DIRECTUS}/assets/${pdfId}`;
payload.hero_image = `${DIRECTUS}/assets/${heroId}`;

const created = await fetch(`${DIRECTUS}/items/newsletter_issues`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify(payload),
});
const createdJson = await created.json().catch(() => ({}));
if (!created.ok || !createdJson?.data?.id) {
  throw new Error(`create failed ${created.status} ${JSON.stringify(createdJson)}`);
}
const row = createdJson.data;
console.log(`created id=${row.id} slug=${row.slug} status=${row.status} featured=${row.featured}`);
console.log(`hero=/assets/${heroId}`);
console.log(`pdf=/assets/${pdfId}`);
