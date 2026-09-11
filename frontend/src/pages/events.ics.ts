import type { APIRoute } from 'astro';
import bundledFlyers from '../data/event-flyers.json';

const DIRECTUS_URL =
  import.meta.env.DIRECTUS_URL ||
  'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

type EventFlyer = {
  id?: number | string;
  title?: string;
  event_date?: string;
  link_url?: string;
  description?: string;
};

/**
 * Same Directus collection + filter as getEventFlyers() /events uses.
 * Explicit fetch here so we can label Directus vs bundled fallback honestly
 * (getEventFlyers swallows errors and always returns an array).
 */
async function loadFlyersForIcs(): Promise<{ events: EventFlyer[]; source: 'directus' | 'bundled-fallback' }> {
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/event_flyers?filter[status][_eq]=published&sort=sort_order`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        return { events: data.data, source: 'directus' };
      }
    }
  } catch {
    // fall through
  }
  return { events: bundledFlyers as EventFlyer[], source: 'bundled-fallback' };
}

export const GET: APIRoute = async () => {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const { events, source } = await loadFlyersForIcs();

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Humane Society of Monroe County//Events Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Monroe Humane Events & Fundraisers',
    'X-WR-TIMEZONE:America/Detroit',
    'X-WR-CALDESC:Community fundraisers, adoption clinics, and events supporting the Humane Society of Monroe County.',
  ];

  for (const event of events) {
    if (!event?.event_date) continue;
    const cleanDate = String(event.event_date).replace(/-/g, '');
    const eventDateObj = new Date(event.event_date + 'T12:00:00Z');
    if (Number.isNaN(eventDateObj.getTime())) continue;
    const nextDayObj = new Date(eventDateObj.getTime() + 24 * 60 * 60 * 1000);
    const nextDayDate = nextDayObj.toISOString().slice(0, 10).replace(/-/g, '');

    const cleanTitle = (event.title || 'Shelter Event').replace(/[,;\\]/g, '\\$&');
    const cleanDesc = (event.description || '').replace(/\n/g, '\\n').replace(/[,;\\]/g, '\\$&');
    const url = event.link_url?.startsWith('http')
      ? event.link_url
      : `https://monroe-humane.org${event.link_url || '/events'}`;

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:event-${event.id || Math.random().toString(36).slice(2)}@monroe-humane.org`);
    icsLines.push(`DTSTAMP:${dtstamp}`);
    icsLines.push(`DTSTART;VALUE=DATE:${cleanDate}`);
    icsLines.push(`DTEND;VALUE=DATE:${nextDayDate}`);
    icsLines.push(`SUMMARY:${cleanTitle}`);
    icsLines.push(`DESCRIPTION:${cleanDesc}`);
    icsLines.push('LOCATION:Monroe County\\, MI');
    icsLines.push(`URL:${url}`);
    icsLines.push('STATUS:CONFIRMED');
    icsLines.push('END:VEVENT');
  }

  icsLines.push('END:VCALENDAR');

  const cacheControl =
    source === 'directus'
      ? 'public, max-age=3600'
      : 'public, max-age=300, stale-while-revalidate=60';

  return new Response(icsLines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="monroe-humane-events.ics"',
      'Cache-Control': cacheControl,
      'X-Events-Source': source,
    },
  });
};
