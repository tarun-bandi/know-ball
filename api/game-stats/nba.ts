import type { VercelRequest, VercelResponse } from '@vercel/node';
import { normalizeEspnGameSummary } from '../../lib/espnGameSummary';

const ESPN_NBA_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
const ESPN_EVENT_ID = /^\d{6,20}$/;

function setCacheHeaders(res: VercelResponse, status: 'scheduled' | 'live' | 'final', eventId: string) {
  const cache = status === 'live'
    ? { browser: 10, shared: 15, swr: 15 }
    : status === 'final'
      ? { browser: 300, shared: 86_400, swr: 604_800 }
      : { browser: 60, shared: 300, swr: 600 };

  res.setHeader('Cache-Control', `public, max-age=${cache.browser}, stale-while-revalidate=${cache.swr}`);
  res.setHeader('CDN-Cache-Control', `public, max-age=${Math.min(cache.shared, 3600)}, stale-while-revalidate=${cache.swr}`);
  res.setHeader('Vercel-CDN-Cache-Control', `public, max-age=${cache.shared}, stale-while-revalidate=${cache.swr}, stale-if-error=${cache.swr}`);
  res.setHeader('Vercel-Cache-Tag', `nba-game-${eventId}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : '';
  if (!ESPN_EVENT_ID.test(eventId)) {
    return res.status(400).json({ error: 'A valid ESPN eventId is required' });
  }

  try {
    const upstream = await fetch(`${ESPN_NBA_SUMMARY}?event=${encodeURIComponent(eventId)}`, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      console.error(JSON.stringify({ event: 'espn_game_summary_failed', eventId, status: upstream.status }));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: 'Game statistics are temporarily unavailable' });
    }

    const summary = normalizeEspnGameSummary(await upstream.json(), eventId);
    if (!summary.awayTeam.abbreviation || !summary.homeTeam.abbreviation) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'No game statistics found for this event' });
    }

    setCacheHeaders(res, summary.status, eventId);
    return res.status(200).json(summary);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'espn_game_summary_error',
      eventId,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to load game statistics' });
  }
}
