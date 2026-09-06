import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import memorialTributes from './data/memorial-tributes.json';

const memorials = defineCollection({
  loader: async () => {
    const list: any[] = [];
    const seen = new Set<string>();

    function cleanTributeName(rawName: string): { name: string } {
      let name = (rawName || '')
        .trim()
        .replace(/^["'#=@*~_\s]+/, '')
        .replace(/^in (memory|honor) of\s+/i, '')
        .trim();

      if (/^bettywhitechallenge/i.test(name)) {
        name = 'Betty White';
      }

      return { name };
    }

    // Ingest authentic memorial tributes
    (memorialTributes as any[]).forEach((t: any, idx: number) => {
      const { name } = cleanTributeName(t.name);
      if (!name || name.length < 2) return;
      const key = name.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        const parts = name.split(/\s+/);
        const isPet = t.variant === 'pet' || t.tributeType === 'pet';
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

        const category =
          t.variant === 'honor' || t.line === 'In Honor Of'
            ? 'honor'
            : t.variant === 'birthday' || t.line === 'Happy Birthday'
            ? 'birthday'
            : isPet
            ? 'pet'
            : 'memory';

        list.push({
          id: `tribute-${idx}`,
          firstName,
          lastName,
          donorName: '',
          tributeType: isPet ? 'pet' : 'person',
          category,
          draft: t.status === 'draft',
          memo: t.line || '',
        });
      }
    });

    return list;
  },
  schema: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    donorName: z.string().optional(),
    tributeType: z.string().optional(),
    category: z.string().optional(),
    draft: z.boolean().optional(),
    memo: z.string().optional(),
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

