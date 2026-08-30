import { createDirectus, rest, authentication } from '@directus/sdk';

export const DIRECTUS_URL = 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

export function getDirectusClient() {
  return createDirectus(DIRECTUS_URL)
    .with(rest())
    .with(authentication('json'));
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
