import { persistentAtom } from '@nanostores/persistent';

const STORAGE_KEY = 'mchs:favorite-pets';

export const favoritePetIds = persistentAtom<string[]>(STORAGE_KEY, [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export function isFavorite(petId: string): boolean {
  return favoritePetIds.get().includes(petId);
}

export function toggleFavorite(petId: string): boolean {
  const current = favoritePetIds.get();
  const next = current.includes(petId)
    ? current.filter((id) => id !== petId)
    : [...current, petId];
  favoritePetIds.set(next);
  return next.includes(petId);
}
