const DIRECTUS_URL =
  (import.meta.env.PUBLIC_DIRECTUS_URL as string | undefined) ||
  'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

const SITE_ORIGIN = 'https://monroe-humane.org';

export type LiveNewsletterIssue = {
  id: number | string;
  title: string;
  slug: string;
  issue_date?: string;
  byline?: string;
  hero_image?: string;
  excerpt?: string;
  pdf_url?: string;
  top_line?: string;
  newsletter_title?: string;
  main_headline?: string;
  featured?: boolean;
  seo_title?: string;
  seo_description?: string;
  lead?: string;
  blocks?: Array<{ id?: string; type?: string; title?: string; body?: string }>;
};

function formatIssueDate(value?: string, fallback = '') {
  if (!value) return fallback;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime())
    ? fallback
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function issueExcerpt(issue: LiveNewsletterIssue, max = 280) {
  const raw = String(issue.excerpt || issue.seo_description || issue.lead || '').trim();
  if (raw) return raw.length > max ? raw.slice(0, max - 1).trimEnd() + '…' : raw;
  const first = storyBlocks(issue)[0];
  const body = String(first?.body || '').replace(/\s+/g, ' ').trim();
  if (!body) return '';
  return body.length > max ? body.slice(0, max - 1).trimEnd() + '…' : body;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchPublishedIssues(): Promise<LiveNewsletterIssue[]> {
  const json = await fetchJson(
    `${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&sort=-issue_date,-id`
  );
  return Array.isArray(json?.data) ? json.data : [];
}

export async function fetchFeaturedIssue(): Promise<LiveNewsletterIssue | null> {
  const featured = await fetchJson(
    `${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&filter[featured][_eq]=true&limit=1`
  );
  if (Array.isArray(featured?.data) && featured.data[0]) return featured.data[0];
  const issues = await fetchPublishedIssues();
  return issues[0] || null;
}

export async function fetchIssueBySlug(slug: string): Promise<LiveNewsletterIssue | null> {
  const encoded = encodeURIComponent(slug);
  const json = await fetchJson(
    `${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&filter[slug][_eq]=${encoded}&limit=1`
  );
  if (Array.isArray(json?.data) && json.data[0]) return json.data[0];
  return null;
}

export function slugFromPath(pathname = window.location.pathname): string {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const idx = parts.lastIndexOf('issue');
  if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== 'open') return parts[idx + 1];
  return parts[parts.length - 1] || '';
}

export async function hydrateHomeNewsletter(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-newsletter-home]');
  if (!root) return;
  const issue = await fetchFeaturedIssue();
  if (issue) {
    const hero = root.querySelector<HTMLImageElement>('[data-nl-hero]');
    if (hero && issue.hero_image) {
      hero.src = issue.hero_image;
      hero.alt = issue.title || 'Latest newsletter';
    }
    const label = document.querySelector('[data-nl-label]');
    if (label && issue.title) label.textContent = issue.title;
    const masthead = document.querySelector('[data-nl-masthead]');
    if (masthead) masthead.textContent = issue.newsletter_title || 'Monroe Humane Society Newsletter';
    const top = root.querySelector('[data-nl-topline]');
    if (top) top.textContent = issue.top_line || 'PO Box 1457 • Monroe, MI';
    const date = root.querySelector('[data-nl-date]');
    if (date) date.textContent = formatIssueDate(issue.issue_date, '');
    const title = root.querySelector('[data-nl-title]');
    if (title) title.textContent = issue.title || title.textContent;
    const byline = root.querySelector('[data-nl-byline]');
    if (byline) byline.textContent = issue.byline || 'by, Jacqueline Monteer';
    const excerpt = root.querySelector('[data-nl-excerpt]');
    if (excerpt) excerpt.textContent = issueExcerpt(issue) || excerpt.textContent;
    const link = root.querySelector<HTMLAnchorElement>('[data-nl-link]');
    if (link && issue.slug) {
      link.href = `/newsletter/issue/${issue.slug}`;
    }
    const pdf = root.querySelector<HTMLAnchorElement>('[data-nl-pdf]');
    if (pdf) {
      if (issue.pdf_url) {
        pdf.href = issue.pdf_url;
        pdf.classList.remove('home-nl__btn--off', 'hidden');
      } else {
        pdf.removeAttribute('href');
        pdf.classList.add('home-nl__btn--off');
      }
    }
    const letterBody = root.querySelector('[data-nl-full-letter]');
    const letterFold = root.querySelector<HTMLDetailsElement>('.home-nl-read');
    const html = renderLetterHtml(issue);
    if (letterBody && html) letterBody.innerHTML = html;
    if (letterFold) letterFold.hidden = !html;
    const letterTitle = root.querySelector('.home-nl-read__title');
    if (letterTitle && issue.title) letterTitle.textContent = issue.title;
    const letterByline = root.querySelector('.home-nl-read__byline');
    if (letterByline) letterByline.textContent = issue.byline || 'by, Jacqueline Monteer';
    const letterDate = root.querySelector('[data-nl-date-letter]');
    if (letterDate) letterDate.textContent = formatIssueDate(issue.issue_date, '');
    const letterKicker = root.querySelector('[data-nl-topline-letter]');
    if (letterKicker) letterKicker.textContent = issue.top_line || 'PO Box 1457 • Monroe, MI';
    const navLabel = document.querySelector('[data-dock-target="Newsletter"] .home-side-dock__text');
    if (navLabel && issue.title) navLabel.textContent = issue.title;
  }
  bindHomeLetterFold(root);
}

function bindHomeLetterFold(root: HTMLElement) {
  const fold = root.querySelector<HTMLDetailsElement>('.home-nl-read');
  if (!fold || fold.dataset.bound === '1') return;
  fold.dataset.bound = '1';
  fold.addEventListener('toggle', () => {
    if (!fold.open) return;
    const panel = fold.querySelector<HTMLElement>('.home-nl-read__panel');
    requestAnimationFrame(() => {
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  fold.querySelector('[data-nl-letter-close]')?.addEventListener('click', () => {
    fold.open = false;
  });
}

export async function hydrateNewsletterArchive(): Promise<void> {
  const list = document.querySelector<HTMLElement>('[data-newsletter-archive]');
  if (!list) return;
  const issues = await fetchPublishedIssues();
  const thumb =
    list.getAttribute('data-fallback-thumb') ||
    '/assets/recovered/images/monroe-humane.org/wp-content/uploads/2026/05/0dcb5211-4496-4c57-9b4a-73f5f856a667.png';
  if (!issues.length) {
    list.innerHTML = '<li class="text-center text-gray-600 col-span-full">No published issues yet.</li>';
    return;
  }
  list.innerHTML = issues
    .map((issue) => {
      const badge = issue.featured
        ? '<span class="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider rounded-full mb-3">On homepage</span>'
        : '';
      const img = issue.hero_image || thumb;
      const title = escapeHtml(issue.title || 'Untitled issue');
      const slug = encodeURIComponent(issue.slug || '');
      const date = formatIssueDate(issue.issue_date);
      const excerpt = escapeHtml(issueExcerpt(issue, 160));
      const meta = date
        ? `<p class="text-sm text-gray-500 mt-2">${escapeHtml(date)}</p>`
        : '';
      const blurb = excerpt ? `<p class="text-sm text-gray-600 mt-3 leading-relaxed">${excerpt}</p>` : '';
      return `<li>
        <a class="block group h-full bg-white rounded-3xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-shadow" href="/newsletter/issue/${slug}">
          <div class="aspect-[2/1] overflow-hidden bg-gray-100">
            <img width="561" height="280" src="${escapeAttr(img)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="${title}" loading="lazy" decoding="async" />
          </div>
          <div class="p-6">${badge}<h3 class="text-xl font-serif text-teal-900 group-hover:text-teal-700 transition-colors">${title}</h3>${meta}${blurb}</div>
        </a>
      </li>`;
    })
    .join('');
}

function storyBlocks(issue: Pick<LiveNewsletterIssue, 'blocks'> | null | undefined) {
  return (issue?.blocks || []).filter((block) => !block.type || block.type === 'story');
}

function paragraphsFromBody(body: string) {
  return String(body || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function letterBlockHtml(title: string, body: string, classPrefix = 'home-nl-read') {
  const heading = title.trim()
    ? `<h3 class="${classPrefix}__heading">${escapeHtml(title.trim())}</h3>`
    : '';
  const paras = paragraphsFromBody(body)
    .map((para) => `<p>${escapeHtml(para)}</p>`)
    .join('');
  if (!heading && !paras) return '';
  return `<section class="${classPrefix}__section">${heading}${paras}</section>`;
}

export function hasLetterBody(issue: Pick<LiveNewsletterIssue, 'blocks' | 'lead' | 'excerpt'> | null | undefined) {
  if (!issue) return false;
  if (storyBlocks(issue).some((block) => String(block.body || '').trim() || String(block.title || '').trim())) {
    return true;
  }
  return Boolean(String(issue.lead || issue.excerpt || '').trim());
}

export function renderLetterHtml(issue: Pick<LiveNewsletterIssue, 'blocks' | 'lead' | 'excerpt'> | null | undefined) {
  const blocks = storyBlocks(issue);
  const fromBlocks = blocks.map((block) => letterBlockHtml(String(block.title || ''), String(block.body || ''))).join('');
  if (fromBlocks.trim()) return fromBlocks;
  const fallback = String(issue?.lead || issue?.excerpt || '').trim();
  return fallback ? letterBlockHtml('', fallback) : '';
}

function useTwoColumnIssueLayout(issue: LiveNewsletterIssue) {
  const blocks = storyBlocks(issue);
  return blocks.length >= 2 && blocks.every((block) => String(block.body || '').length < 500);
}

export function renderIssueInto(root: HTMLElement, issue: LiveNewsletterIssue): void {
  const hero = root.querySelector<HTMLImageElement>('[data-nl-hero]');
  if (hero && issue.hero_image) {
    hero.src = issue.hero_image;
    hero.alt = issue.title || '';
  }
  const top = root.querySelector('[data-nl-topline]');
  if (top) top.textContent = issue.top_line || 'PO Box 1457 • Monroe, MI';
  const h1 = root.querySelector('[data-nl-headline]');
  if (h1) h1.textContent = issue.main_headline || issue.title || '';
  const masthead = root.querySelector('[data-nl-masthead]');
  if (masthead) masthead.textContent = issue.newsletter_title || 'Monroe Humane Society Newsletter';
  const byline = root.querySelector('[data-nl-byline]');
  if (byline) byline.textContent = issue.byline || 'Humane Society of Monroe County';
  const pdf = root.querySelector<HTMLAnchorElement>('[data-nl-pdf]');
  if (pdf) {
    if (issue.pdf_url) {
      pdf.href = issue.pdf_url;
      pdf.classList.remove('hidden');
    } else {
      pdf.removeAttribute('href');
      pdf.classList.add('hidden');
    }
  }
  const body = root.querySelector('[data-nl-blocks]');
  if (body) {
    const blocks = storyBlocks(issue);
    body.className = useTwoColumnIssueLayout(issue)
      ? 'grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12'
      : 'grid grid-cols-1 gap-8 max-w-3xl mx-auto';
    body.innerHTML = blocks
      .map((block) => {
        const paras = paragraphsFromBody(String(block.body || ''))
          .map((para) => `<p class="text-gray-700 leading-relaxed mb-4">${escapeHtml(para)}</p>`)
          .join('');
        const heading = block.title
          ? `<h3 class="text-2xl font-serif text-teal-900 mb-6">${escapeHtml(block.title)}</h3>`
          : '';
        return `<div class="prose prose-teal max-w-none">${heading}${paras}</div>`;
      })
      .join('');
  }
}

function setMetaContent(selector: string, value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', value);
}

function applyIssueSeo(issue: LiveNewsletterIssue | null, missing = false) {
  if (missing || !issue) {
    const pageTitle = 'Issue not found | 734-243-3669';
    const description = 'That newsletter is not published, or the link is out of date.';
    document.title = pageTitle;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', pageTitle);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', pageTitle);
    setMetaContent('meta[name="twitter:description"]', description);
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
    document.getElementById('nl-newsarticle-jsonld')?.remove();
    return;
  }

  const pageTitle = `${issue.seo_title || issue.title || 'Newsletter'} | 734-243-3669`;
  const description =
    issue.seo_description || issueExcerpt(issue, 160) || `Monroe Humane Society Newsletter — ${issue.title || ''}`.trim();
  document.title = pageTitle;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', pageTitle);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', pageTitle);
  setMetaContent('meta[name="twitter:description"]', description);
  if (issue.hero_image) {
    setMetaContent('meta[property="og:image"]', issue.hero_image);
    setMetaContent('meta[name="twitter:image"]', issue.hero_image);
  }
  const robots = document.querySelector('meta[name="robots"]');
  if (robots) robots.setAttribute('content', 'index, follow');

  document.getElementById('nl-newsarticle-jsonld')?.remove();
  const script = document.createElement('script');
  script.id = 'nl-newsarticle-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: issue.seo_title || issue.main_headline || issue.title,
    description,
    image: issue.hero_image ? [issue.hero_image] : undefined,
    datePublished: issue.issue_date || undefined,
    author: {
      '@type': 'Organization',
      name: issue.byline || 'Humane Society of Monroe County',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Humane Society of Monroe County',
      url: SITE_ORIGIN,
    },
    mainEntityOfPage: issue.slug ? `${SITE_ORIGIN}/newsletter/issue/${issue.slug}` : `${SITE_ORIGIN}/newsletter/`,
  });
  document.head.appendChild(script);
}

export async function hydrateIssuePage(slug = slugFromPath()): Promise<boolean> {
  const root = document.querySelector<HTMLElement>('[data-newsletter-issue]');
  if (!root || !slug) {
    applyIssueSeo(null, true);
    return false;
  }
  const issue = await fetchIssueBySlug(slug);
  if (!issue) {
    applyIssueSeo(null, true);
    return false;
  }
  applyIssueSeo(issue, false);
  renderIssueInto(root, issue);
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
