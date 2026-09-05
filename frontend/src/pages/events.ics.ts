import type { APIRoute } from 'astro';
import eventFlyers from '../data/event-flyers.json';

export const GET: APIRoute = async () => {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

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

  eventFlyers.forEach((event: any) => {
    if (!event.event_date) return;
    const cleanDate = event.event_date.replace(/-/g, '');
    const eventDateObj = new Date(event.event_date + 'T12:00:00Z');
    const nextDayObj = new Date(eventDateObj.getTime() + 24 * 60 * 60 * 1000);
    const nextDayDate = nextDayObj.toISOString().slice(0, 10).replace(/-/g, '');

    const cleanTitle = (event.title || 'Shelter Event').replace(/[,;\\]/g, '\\$&');
    const cleanDesc = (event.description || '').replace(/\n/g, '\\n').replace(/[,;\\]/g, '\\$&');
    const url = event.link_url?.startsWith('http') ? event.link_url : `https://monroe-humane.org${event.link_url || '/events'}`;

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
  });

  icsLines.push('END:VCALENDAR');

  return new Response(icsLines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="monroe-humane-events.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
