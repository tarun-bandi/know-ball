import { gamePath, type SluggableGame } from '@/lib/gameRoutes';

export const WEB_BASE = 'https://knoball.vercel.app';

export function gameUrl(game: SluggableGame | string) {
  return `${WEB_BASE}${gamePath(game)}`;
}

export function userUrl(handle: string) {
  return `${WEB_BASE}/user/${handle}`;
}

export function listUrl(listId: string) {
  return `${WEB_BASE}/list/${listId}`;
}

export function inviteUrl(handle: string) {
  return `${WEB_BASE}/user/${handle}?ref=invite`;
}
