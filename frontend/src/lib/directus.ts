import bundledPets from '../data/shelter-pets.json';
import bundledArchivedPets from '../data/archived-pets.json';
import eventFlyersData from '../data/event-flyers.json';
import memorialTributesData from '../data/memorial-tributes.json';
import boardGovernanceData from '../data/board-governance.json';

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';
const DIRECTUS_STATIC_TOKEN = import.meta.env.DIRECTUS_STATIC_TOKEN || '';

export interface Pet {
  id: string;
  name: string;
  type: string;
  species_label?: string;
  breed: string;
  age: string;
  age_display?: string;
  size?: string;
  color?: string;
  gender: string;
  location?: string;
  image?: string;
  image_url?: string;
  url: string;
  description?: string;
  intake_date?: string;
  declawed?: string;
  housetrained?: string;
  stage?: string;
  archived_at?: string | null;
}

export interface EventFlyer {
  id: number;
  title: string;
  event_date?: string;
  link_url?: string;
  description?: string;
  image?: string;
  sort_order?: number;
}

export interface MemorialTribute {
  id: number;
  title: string;
  line_key: string;
  variant: string;
  year?: string;
  created_at?: string;
}

export interface NewsletterIssue {
  id: number | string;
  title: string;
  slug: string;
  issue_date?: string;
  heading?: string;
  lead?: string;
  byline?: string;
  hero_image?: string;
  excerpt?: string;
  pdf_url?: string;
  top_line?: string;
  newsletter_title?: string;
  main_headline?: string;
  blocks?: Array<{ id: string; type?: string; title: string; body: string }>;
  featured?: boolean;
  status?: string;
  seo_title?: string;
  seo_description?: string;
  publish_at?: string;
}

export interface SiteSettings {
  // Verified 2025 shelter outcomes (MDARD report, confirmed 2026-08-27).
  adoptions_count: number;
  return_to_owner_count: number;
  intakes_count: number;
  emergency_phone: string;
}

let cachedPets: Pet[] | null = null;
export async function getPets(): Promise<Pet[]> {
  if (cachedPets) return cachedPets;

  try {
    const headers: Record<string, string> = {};
    if (DIRECTUS_STATIC_TOKEN) {
      headers['Authorization'] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
    }
    const res = await fetch(`${DIRECTUS_URL}/items/pets?filter[archived_at][_null]=true&limit=-1`, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        cachedPets = data.data.map((p: any) => ({
          ...p,
          image: p.image_url || p.image || '/assets/recovered/images/placeholder.svg',
        }));
        return cachedPets!;
      }
    }
  } catch (err) {
    console.warn('[Directus] Live API unavailable or warming up, using bundled pet fallback data.');
  }

  cachedPets = (bundledPets as Pet[]).map((p) => ({
    ...p,
    image: p.image || p.image_url || '/assets/recovered/images/placeholder.svg',
  }));
  return cachedPets;
}

export interface StaffPetRecord extends Pet {
  first_seen_at?: string;
  last_seen_at?: string;
  archived_at?: string | null;
  stage?: string;
  color?: string;
  location?: string;
}

export interface PetSyncSummary {
  lastSyncTimestamp: string;
  activeCount: number;
  archivedCount: number;
  totalCount: number;
  pets: StaffPetRecord[];
}

let cachedStaffPetSync: PetSyncSummary | null = null;
export async function getStaffPetSyncData(): Promise<PetSyncSummary> {
  if (cachedStaffPetSync) return cachedStaffPetSync;

  try {
    const headers: Record<string, string> = {};
    if (DIRECTUS_STATIC_TOKEN) {
      headers['Authorization'] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
    }
    const res = await fetch(`${DIRECTUS_URL}/items/pets?limit=-1&sort=-last_seen_at`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const pets: StaffPetRecord[] = data.data.map((p: any) => ({
          ...p,
          image: p.image_url || p.image || '/assets/recovered/images/placeholder.svg',
        }));
        const activeCount = pets.filter((p) => !p.archived_at).length;
        const archivedCount = pets.filter((p) => !!p.archived_at).length;
        const lastSyncTimestamp = pets[0]?.last_seen_at || new Date().toISOString();

        cachedStaffPetSync = {
          lastSyncTimestamp,
          activeCount,
          archivedCount,
          totalCount: pets.length,
          pets,
        };
        return cachedStaffPetSync;
      }
    }
  } catch (err) {
    console.warn('[Directus] Live pet sync query unavailable, falling back to bundled data.');
  }

  // Fallback using bundled active and archived pets
  const fallbackActive: StaffPetRecord[] = (bundledPets as any[]).map((p) => ({
    ...p,
    image: p.image || p.image_url || '/assets/recovered/images/placeholder.svg',
    first_seen_at: p.first_seen_at || '2026-08-28T09:19:22',
    last_seen_at: p.last_seen_at || '2026-09-04T22:30:10',
    archived_at: null,
    stage: p.stage || 'Available',
  }));

  const fallbackArchived: StaffPetRecord[] = (bundledArchivedPets as any[]).map((p) => ({
    ...p,
    image: p.image || p.image_url || '/assets/recovered/images/placeholder.svg',
    first_seen_at: p.first_seen_at || '2025-05-28T19:52:49',
    last_seen_at: p.last_seen_at || '2026-09-03T17:00:16',
    archived_at: p.archived_at || '2026-09-03T17:30:13',
    stage: p.stage || 'Adopted',
  }));

  const fallbackAll: StaffPetRecord[] = [...fallbackActive, ...fallbackArchived];

  cachedStaffPetSync = {
    lastSyncTimestamp: fallbackActive[0]?.last_seen_at || '2026-09-04T22:30:10',
    activeCount: fallbackActive.length,
    archivedCount: fallbackArchived.length,
    totalCount: fallbackAll.length,
    pets: fallbackAll,
  };
  return cachedStaffPetSync;
}

let cachedFlyers: EventFlyer[] | null = null;
export async function getEventFlyers(): Promise<EventFlyer[]> {
  if (cachedFlyers) return cachedFlyers;

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/event_flyers?filter[status][_eq]=published&sort=sort_order`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        cachedFlyers = data.data;
        return cachedFlyers!;
      }
    }
  } catch (e) {
    // Fallback: the 13 real flyers (mirror-sourced).
  }
  cachedFlyers = eventFlyersData as EventFlyer[];
  return cachedFlyers;
}

let cachedTributes: MemorialTribute[] | null = null;
export async function getMemorialTributes(): Promise<MemorialTribute[]> {
  if (cachedTributes) return cachedTributes;

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/memorial_tributes?filter[status][_eq]=published&sort=-id`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        cachedTributes = data.data;
        return cachedTributes!;
      }
    }
  } catch (e) {
    // Fallback: the 111 real tributes (mirror-sourced).
  }
  cachedTributes = (memorialTributesData as Array<{ variant: string; line: string; name: string; year?: string }>).map(
    (t, i) => ({
      id: i + 1,
      title: t.name,
      line_key: t.line.toLowerCase().replace(/ & | /g, '_').replace(/_+/g, '_'),
      variant: t.variant,
      year: t.year,
    })
  );
  return cachedTributes;
}

let cachedIssues: NewsletterIssue[] | null = null;
const NEWSLETTER_STUB: NewsletterIssue = {
  id: 'stub',
  title: 'Monroe Humane Society Newsletter',
  slug: '2025-in-review',
  issue_date: '2026-01-15',
  byline: 'Humane Society of Monroe County',
  hero_image: '/assets/recovered/images/monroe-humane.org/wp-content/uploads/2026/05/0dcb5211-4496-4c57-9b4a-73f5f856a667.png',
  excerpt: 'Stories, updates, and highlights from shelter care and community support.',
  featured: true,
};

function mapNewsletterIssue(row: any): NewsletterIssue {
  const blocks = Array.isArray(row?.blocks)
    ? row.blocks.map((block: any, index: number) => ({
        id: String(block?.id || index + 1),
        type: String(block?.type || 'story'),
        title: String(block?.title || ''),
        body: String(block?.body || ''),
      }))
    : [];
  return {
    id: row?.id,
    title: row?.title || '',
    slug: row?.slug || '',
    issue_date: row?.issue_date,
    heading: row?.heading,
    lead: row?.lead,
    byline: row?.byline,
    hero_image: row?.hero_image,
    excerpt: row?.excerpt || row?.lead,
    pdf_url: row?.pdf_url,
    top_line: row?.top_line,
    newsletter_title: row?.newsletter_title,
    main_headline: row?.main_headline,
    blocks,
    featured: !!row?.featured,
    status: row?.status,
    seo_title: row?.seo_title,
    seo_description: row?.seo_description,
    publish_at: row?.publish_at,
  };
}

export async function getNewsletterIssues(): Promise<NewsletterIssue[]> {
  if (cachedIssues) return cachedIssues;

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&sort=-issue_date,-id`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const data = await res.json();
      cachedIssues = Array.isArray(data.data) ? data.data.map(mapNewsletterIssue) : [];
      return cachedIssues!;
    }
  } catch (e) {
    // Directus down — tiny stub for SSG, not the duplicated 2025 letters.
  }
  cachedIssues = [NEWSLETTER_STUB];
  return cachedIssues;
}

export async function getFeaturedNewsletterIssue(): Promise<NewsletterIssue | null> {
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&filter[featured][_eq]=true&limit=1`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data[0]) {
        return mapNewsletterIssue(data.data[0]);
      }
    }
  } catch (e) {
    // fall through to latest published
  }
  const issues = await getNewsletterIssues();
  return issues[0] || null;
}

let cachedSettings: SiteSettings | null = null;
export async function getSiteSettings(): Promise<SiteSettings> {
  if (cachedSettings) return cachedSettings;

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/site_settings/1`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data) {
        cachedSettings = data.data;
        return cachedSettings!;
      }
    }
  } catch (e) {
    // Fallback
  }
  cachedSettings = {
    adoptions_count: 539,
    return_to_owner_count: 53,
    intakes_count: 672,
    emergency_phone: '734-240-7700',
  };
  return cachedSettings;
}

export type GrantStatus = 'open' | 'watch' | 'applied' | 'skipped';

export interface GrantEntity {
  id?: string;
  title: string;
  source: string;
  open_url?: string;
  apply_url?: string;
  status: GrantStatus;
  deadline_notes?: string;
  fit_notes?: string;
}

export interface BoardMeeting {
  id: string | number;
  title: string;
  date: string;
  location: string;
  status: 'scheduled' | 'completed' | 'canceled';
  description?: string;
  agenda_items?: string[];
  packet_status?: string;
  packet_url?: string;
}

export interface BoardDocument {
  id: string | number;
  title: string;
  category: 'ed_report' | 'financial' | 'governance' | 'regulatory' | 'minutes';
  category_label?: string;
  author: string;
  date: string;
  summary: string;
  highlights?: string[];
  file_type?: string;
  download_url?: string;
  status?: 'published' | 'draft';
}

let cachedBoardMeetings: BoardMeeting[] | null = null;
export async function getBoardMeetings(): Promise<BoardMeeting[]> {
  if (cachedBoardMeetings) return cachedBoardMeetings;

  try {
    const headers: Record<string, string> = {};
    if (DIRECTUS_STATIC_TOKEN) {
      headers['Authorization'] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
    }
    const res = await fetch(`${DIRECTUS_URL}/items/board_meetings?sort=-date`, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        cachedBoardMeetings = data.data;
        return cachedBoardMeetings!;
      }
    }
  } catch (err) {
    // Fallback gracefully to bundled governance json
  }

  cachedBoardMeetings = boardGovernanceData.meetings as BoardMeeting[];
  return cachedBoardMeetings;
}

let cachedBoardDocuments: BoardDocument[] | null = null;
export async function getBoardDocuments(): Promise<BoardDocument[]> {
  if (cachedBoardDocuments) return cachedBoardDocuments;

  try {
    const headers: Record<string, string> = {};
    if (DIRECTUS_STATIC_TOKEN) {
      headers['Authorization'] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
    }
    const res = await fetch(`${DIRECTUS_URL}/items/board_documents?sort=-date`, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        cachedBoardDocuments = data.data;
        return cachedBoardDocuments!;
      }
    }
  } catch (err) {
    // Fallback gracefully to bundled governance json
  }

  cachedBoardDocuments = boardGovernanceData.documents as BoardDocument[];
  return cachedBoardDocuments;
}
