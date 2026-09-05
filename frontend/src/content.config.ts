import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import memorialTributes from './data/memorial-tributes.json';
import donorDb from './data/donor_database.json';

const memorials = defineCollection({
  loader: async () => {
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. Ingest consolidated memorial tributes (curated WordPress plaques + mapped dedications)
    (memorialTributes as any[]).forEach((t: any, idx: number) => {
      const name = (t.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const parts = name.split(' ');
        const firstName = parts[0] || name;
        const lastName = parts.slice(1).join(' ') || '';
        const isPet = t.variant === 'pet' || /dog|cat|pup|kitten|griffin|buddy|max|bella|luna|charlie|daisy|milo|bailey|pet/i.test(name);

        list.push({
          id: `tribute-${idx}`,
          firstName,
          lastName,
          donorName: t.donorName || '',
          tributeType: isPet ? 'pet' : 'person',
          draft: t.status === 'draft',
        });
      }
    });

    // 2. Supplement with any un-indexed donor dedications
    (donorDb.donors || []).forEach((d: any) => {
      (d.gifts || []).forEach((g: any, idx: number) => {
        if (g.dedication && g.dedication.trim()) {
          const rawDed = g.dedication.replace(/^in (memory|honor) of\s+/i, '').trim();
          const parts = rawDed.split(' ');
          const firstName = parts[0] || rawDed;
          const lastName = parts.slice(1).join(' ') || '';
          const key = rawDed.toLowerCase();

          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              id: `mem-${d.id}-${idx}`,
              firstName,
              lastName,
              donorName: d.name,
              tributeType: /dog|cat|pup|kitten|griffin|buddy|max|bella|luna|charlie|daisy|milo|bailey|pet/i.test(rawDed) ? 'pet' : 'person',
              draft: false,
            });
          }
        }
      });
    });

    return list;
  },
  schema: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    donorName: z.string().optional(),
    tributeType: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

const flyers = defineCollection({
  loader: file('src/data/event-flyers.json'),
  schema: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    title: z.string(),
    event_date: z.string().optional(),
    description: z.string().optional(),
    link_url: z.string().optional(),
    image: z.string().optional(),
  }),
});

export const collections = { memorials, flyers };

