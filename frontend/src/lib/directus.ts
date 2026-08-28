import bundledPets from '../data/shelter-pets.json';
import eventFlyersData from '../data/event-flyers.json';
import memorialTributesData from '../data/memorial-tributes.json';

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
  id: number;
  title: string;
  slug: string;
  issue_date?: string;
  heading?: string;
  lead?: string;
  byline?: string;
  hero_image?: string;
  excerpt?: string;
  pdf_url?: string;
  blocks?: Array<{ id: string; type: string; title: string; body: string }>;
  featured?: boolean;
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

let cachedFlyers: EventFlyer[] | null = null;
export async function getEventFlyers(): Promise<EventFlyer[]> {
  if (cachedFlyers) return cachedFlyers;

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/event_flyers?filter[status][_eq]=published&sort=sort_order`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      cachedFlyers = data.data || [];
      return cachedFlyers!;
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
      cachedTributes = data.data || [];
      return cachedTributes!;
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
export async function getNewsletterIssues(): Promise<NewsletterIssue[]> {
  if (cachedIssues) return cachedIssues;

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/newsletter_issues?filter[status][_eq]=published&sort=-id`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        cachedIssues = data.data;
        return cachedIssues!;
      }
    }
  } catch (e) {
    // Fallback
  }
  // Real issue, mirror-sourced (src/data/homepage.json #newsletter).
  cachedIssues = [
    {
      id: 1,
      title: '2025 in Review',
      slug: '2025-in-review',
      issue_date: '2026-01-15',
      byline: 'by, Jacqueline Monteer',
      hero_image: '/assets/recovered/images/monroe-humane.org/wp-content/uploads/2026/05/0dcb5211-4496-4c57-9b4a-73f5f856a667.png',
      excerpt: 'A new direction, a busy shelter, and a community that showed up all year. Read how 2025 reshaped the shelter — new play yards, climate control, a medical room, and hundreds of animals finding their way home.',
      blocks: [
            {
                  "id": "1",
                  "type": "story",
                  "title": "A New Direction",
                  "body": "After years of donations and plans for building a new shelter it was not to be. In 2023 I became president of HSMC there was debt, the Telegraph location was falling apart, very little progress on a new shelter and then covid. I spent a lot of time working with different agencies, government entities and contractors to see if we could salvage the project within a realistic budget. It was not financially prudent.\n\nThe new board took a different direction, and it has been a blessing. We have partnered with the Sheriff’s dept. We are now a vendor for the county and rent the animal control shelter building. With hard work and support of the community we have improved all aspects of shelter life for dogs and cats.\n\nWe wanted to give back to the community as much as possible with improvements to the shelter putting to work all the donations for a new shelter. These improvements are here to stay no matter what. The dogs and cats of Monroe County will benefit from the Humane Society and the generosity of this community."
            },
            {
                  "id": "2",
                  "type": "story",
                  "title": "Things improved",
                  "body": "1. Two new fenced play yards and reconfigured some of the existing fencing so that if a dog escapes the kennel area it is confined inside the fencing. We also installed a pedestrian gate so that access is easier and safer for dogs being walked.\n2. Installed air conditioning in the dog kennel and installed a separate heating and cooling unit in the cat area.\n3. Installed new commercial sink, allowing us to clean and sterilize all animal dishes and other items.\n4. Installed commercial size washer and dryer. It holds 5 times the load limit of the previous units capacity.\n5. Created a medical room. All animals brought into the shelter are evaluated and vaccinated.\n6. Are in the process of building two additional outdoor covered kennels. Previously we had just small kennel runs under a permanent roof and 6 larger runs on gravel with no overhead protection except a tarp. The new kennels have roofs and are larger than the existing runs with a total of 14 larger runs. So with what is here now we will have more room to get dogs out in good weather and places to put them for cleaning kennels where they are protected from the elements.\n7. All of the staff are certified in Fear Free which is a course offered to teach how to handle shelter animals to reduce fear and stress.\n8. We also implemented a program called Please, the dogs are asked to sit and calm before exiting their kennel.\n9. We have created play groups for the dogs. We find which dogs like each other and we allow them to play in the play yard together. Often, they will let us know when they are ready to come in and some of our dogs would rather be in a play group than to go for a walk.\n10. We have a program called Doggie Day Out which allows dogs to leave the shelter for a day. We have dogs who now drool when they go by a fast food place that has pup cups, some dogs go to a park and some go to a home for a day of cuddles. They usually come back tired and happy.\n11. We rotate dogs in the office area so that they are exposed to different people and different situations. Much like they experience in a home.\n12. We had a mural painted on the side of the building. This was a community event with many people helping to paint. The animals on the wall are all former residents of the shelter. On the front of the building is a memorial to ACO Darrian Young and Dr. Hermann, both had dedicated their lives to animals and the community and each tragically were killed in car accidents."
            },
            {
                  "id": "3",
                  "type": "story",
                  "title": "Partner Shelters & Our Cats",
                  "body": "In addition to all these changes and improvements we have programs with other state approved shelters. We trade about 4 dogs a month, sometimes it just takes another set of eyes to find the perfect match.\n\nIn reading this you may have noticed most centers around our dogs. We also have cats here for adoption and looking for homes. Each year we take in cats that are left behind or have owners that have passed and many other unfortunate circumstances. We have cats that give birth in our care, we have litters brought to us and there is always far more in need than we can care for."
            },
            {
                  "id": "4",
                  "type": "story",
                  "title": "The Cat Room 2014 Next Project",
                  "body": "With that, the next project we have planned is for a “Cat Room”. We want to build onto the front of the building, about 800 square feet, where we can put community kennels for the cats. Where they can play and climb and do what cats and kittens do. An architect donated his time and drew up plans. Building the cat room will move the cats from the garage to an area built specifically for them and their needs. This will also leave us with a large area at the back of the building where we can build isolation kennels, so that when a dog is brought into the building it can go to the isolation area to decompress and be observed for health problems.\n\nAt the same time, it will open some much needed space outside of the medical room for Legacy Pet Care, for the vaccine and animal care clinic once monthly.\n\nThis project will be expensive and will require fundraisers. We will need corporate sponsors and will offer naming rights for this new addition."
            }
      ],
      featured: true,
    },
  ];
  return cachedIssues;
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
