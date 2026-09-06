import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import memorialTributes from './data/memorial-tributes.json';

const memorials = defineCollection({
  loader: async () => {
    const list: any[] = [];
    const seen = new Set<string>();

    function cleanTributeName(rawName: string): { name: string; isPet: boolean } {
      let name = (rawName || '')
        .trim()
        .replace(/^["'#=@*~_\s]+/, '')
        .replace(/^in (memory|honor) of\s+/i, '')
        .trim();

      if (/^bettywhitechallenge/i.test(name)) {
        name = 'Betty White';
      }

      const isPet =
        /\b(dog|cat|pup|puppy|kitten|kitty|feline|canine|griffin|buddy|max|bella|luna|charlie|daisy|milo|bailey|pet|hound|retriever|terrier|shepherd|rabbit|bunny)\b/i.test(
          name
        );

      return { name, isPet };
    }

    // 1. Ingest consolidated memorial tributes (curated WordPress plaques + mapped dedications)
    (memorialTributes as any[]).forEach((t: any, idx: number) => {
      const { name, isPet: petByName } = cleanTributeName(t.name);
      if (!name || name.length < 2) return;
      const key = name.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        const parts = name.split(/\s+/);
        const isPet = t.variant === 'pet' || petByName;
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

        list.push({
          id: `tribute-${idx}`,
          firstName,
          lastName,
          donorName: t.donorName || '',
          tributeType: isPet ? 'pet' : 'person',
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

