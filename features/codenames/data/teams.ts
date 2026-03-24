import type { TeamRecord, GameMode } from '../types';

export const NBA_TEAMS: TeamRecord[] = [
  // Eastern - Atlantic
  { id: 'nba-bos', league: 'nba', city: 'Boston', name: 'Celtics', displayName: 'Celtics', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic', aliases: ['Cs'] },
  { id: 'nba-bkn', league: 'nba', city: 'Brooklyn', name: 'Nets', displayName: 'Nets', abbreviation: 'BKN', conference: 'Eastern', division: 'Atlantic', aliases: [] },
  { id: 'nba-nyk', league: 'nba', city: 'New York', name: 'Knicks', displayName: 'Knicks', abbreviation: 'NYK', conference: 'Eastern', division: 'Atlantic', aliases: [] },
  { id: 'nba-phi', league: 'nba', city: 'Philadelphia', name: '76ers', displayName: '76ers', abbreviation: 'PHI', conference: 'Eastern', division: 'Atlantic', aliases: ['Sixers', 'Philly'] },
  { id: 'nba-tor', league: 'nba', city: 'Toronto', name: 'Raptors', displayName: 'Raptors', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic', aliases: ['Raps'] },
  // Eastern - Central
  { id: 'nba-chi', league: 'nba', city: 'Chicago', name: 'Bulls', displayName: 'Bulls', abbreviation: 'CHI', conference: 'Eastern', division: 'Central', aliases: [] },
  { id: 'nba-cle', league: 'nba', city: 'Cleveland', name: 'Cavaliers', displayName: 'Cavaliers', abbreviation: 'CLE', conference: 'Eastern', division: 'Central', aliases: ['Cavs'] },
  { id: 'nba-det', league: 'nba', city: 'Detroit', name: 'Pistons', displayName: 'Pistons', abbreviation: 'DET', conference: 'Eastern', division: 'Central', aliases: [] },
  { id: 'nba-ind', league: 'nba', city: 'Indiana', name: 'Pacers', displayName: 'Pacers', abbreviation: 'IND', conference: 'Eastern', division: 'Central', aliases: [] },
  { id: 'nba-mil', league: 'nba', city: 'Milwaukee', name: 'Bucks', displayName: 'Bucks', abbreviation: 'MIL', conference: 'Eastern', division: 'Central', aliases: [] },
  // Eastern - Southeast
  { id: 'nba-atl', league: 'nba', city: 'Atlanta', name: 'Hawks', displayName: 'Hawks', abbreviation: 'ATL', conference: 'Eastern', division: 'Southeast', aliases: [] },
  { id: 'nba-cha', league: 'nba', city: 'Charlotte', name: 'Hornets', displayName: 'Hornets', abbreviation: 'CHA', conference: 'Eastern', division: 'Southeast', aliases: [] },
  { id: 'nba-mia', league: 'nba', city: 'Miami', name: 'Heat', displayName: 'Heat', abbreviation: 'MIA', conference: 'Eastern', division: 'Southeast', aliases: [] },
  { id: 'nba-orl', league: 'nba', city: 'Orlando', name: 'Magic', displayName: 'Magic', abbreviation: 'ORL', conference: 'Eastern', division: 'Southeast', aliases: [] },
  { id: 'nba-was', league: 'nba', city: 'Washington', name: 'Wizards', displayName: 'Wizards', abbreviation: 'WAS', conference: 'Eastern', division: 'Southeast', aliases: ['Wiz'] },
  // Western - Northwest
  { id: 'nba-den', league: 'nba', city: 'Denver', name: 'Nuggets', displayName: 'Nuggets', abbreviation: 'DEN', conference: 'Western', division: 'Northwest', aliases: ['Nugs'] },
  { id: 'nba-min', league: 'nba', city: 'Minnesota', name: 'Timberwolves', displayName: 'Timberwolves', abbreviation: 'MIN', conference: 'Western', division: 'Northwest', aliases: ['Wolves', 'TWolves'] },
  { id: 'nba-okc', league: 'nba', city: 'Oklahoma City', name: 'Thunder', displayName: 'Thunder', abbreviation: 'OKC', conference: 'Western', division: 'Northwest', aliases: [] },
  { id: 'nba-por', league: 'nba', city: 'Portland', name: 'Trail Blazers', displayName: 'Trail Blazers', abbreviation: 'POR', conference: 'Western', division: 'Northwest', aliases: ['Blazers'] },
  { id: 'nba-uta', league: 'nba', city: 'Utah', name: 'Jazz', displayName: 'Jazz', abbreviation: 'UTA', conference: 'Western', division: 'Northwest', aliases: [] },
  // Western - Pacific
  { id: 'nba-gsw', league: 'nba', city: 'Golden State', name: 'Warriors', displayName: 'Warriors', abbreviation: 'GSW', conference: 'Western', division: 'Pacific', aliases: ['Dubs'] },
  { id: 'nba-lac', league: 'nba', city: 'Los Angeles', name: 'Clippers', displayName: 'LA Clippers', abbreviation: 'LAC', conference: 'Western', division: 'Pacific', aliases: ['Clips'] },
  { id: 'nba-lal', league: 'nba', city: 'Los Angeles', name: 'Lakers', displayName: 'LA Lakers', abbreviation: 'LAL', conference: 'Western', division: 'Pacific', aliases: [] },
  { id: 'nba-phx', league: 'nba', city: 'Phoenix', name: 'Suns', displayName: 'Suns', abbreviation: 'PHX', conference: 'Western', division: 'Pacific', aliases: [] },
  { id: 'nba-sac', league: 'nba', city: 'Sacramento', name: 'Kings', displayName: 'Kings', abbreviation: 'SAC', conference: 'Western', division: 'Pacific', aliases: [] },
  // Western - Southwest
  { id: 'nba-dal', league: 'nba', city: 'Dallas', name: 'Mavericks', displayName: 'Mavericks', abbreviation: 'DAL', conference: 'Western', division: 'Southwest', aliases: ['Mavs'] },
  { id: 'nba-hou', league: 'nba', city: 'Houston', name: 'Rockets', displayName: 'Rockets', abbreviation: 'HOU', conference: 'Western', division: 'Southwest', aliases: [] },
  { id: 'nba-mem', league: 'nba', city: 'Memphis', name: 'Grizzlies', displayName: 'Grizzlies', abbreviation: 'MEM', conference: 'Western', division: 'Southwest', aliases: ['Grizz'] },
  { id: 'nba-nop', league: 'nba', city: 'New Orleans', name: 'Pelicans', displayName: 'Pelicans', abbreviation: 'NOP', conference: 'Western', division: 'Southwest', aliases: ['Pels'] },
  { id: 'nba-sas', league: 'nba', city: 'San Antonio', name: 'Spurs', displayName: 'Spurs', abbreviation: 'SAS', conference: 'Western', division: 'Southwest', aliases: [] },
];

export const NFL_TEAMS: TeamRecord[] = [
  // AFC East
  { id: 'nfl-buf', league: 'nfl', city: 'Buffalo', name: 'Bills', displayName: 'Bills', abbreviation: 'BUF', conference: 'AFC', division: 'East', aliases: [] },
  { id: 'nfl-mia', league: 'nfl', city: 'Miami', name: 'Dolphins', displayName: 'Dolphins', abbreviation: 'MIA', conference: 'AFC', division: 'East', aliases: ['Fins'] },
  { id: 'nfl-ne', league: 'nfl', city: 'New England', name: 'Patriots', displayName: 'Patriots', abbreviation: 'NE', conference: 'AFC', division: 'East', aliases: ['Pats'] },
  { id: 'nfl-nyj', league: 'nfl', city: 'New York', name: 'Jets', displayName: 'NY Jets', abbreviation: 'NYJ', conference: 'AFC', division: 'East', aliases: [] },
  // AFC North
  { id: 'nfl-bal', league: 'nfl', city: 'Baltimore', name: 'Ravens', displayName: 'Ravens', abbreviation: 'BAL', conference: 'AFC', division: 'North', aliases: [] },
  { id: 'nfl-cin', league: 'nfl', city: 'Cincinnati', name: 'Bengals', displayName: 'Bengals', abbreviation: 'CIN', conference: 'AFC', division: 'North', aliases: [] },
  { id: 'nfl-cle', league: 'nfl', city: 'Cleveland', name: 'Browns', displayName: 'Browns', abbreviation: 'CLE', conference: 'AFC', division: 'North', aliases: [] },
  { id: 'nfl-pit', league: 'nfl', city: 'Pittsburgh', name: 'Steelers', displayName: 'Steelers', abbreviation: 'PIT', conference: 'AFC', division: 'North', aliases: [] },
  // AFC South
  { id: 'nfl-hou', league: 'nfl', city: 'Houston', name: 'Texans', displayName: 'Texans', abbreviation: 'HOU', conference: 'AFC', division: 'South', aliases: [] },
  { id: 'nfl-ind', league: 'nfl', city: 'Indianapolis', name: 'Colts', displayName: 'Colts', abbreviation: 'IND', conference: 'AFC', division: 'South', aliases: [] },
  { id: 'nfl-jax', league: 'nfl', city: 'Jacksonville', name: 'Jaguars', displayName: 'Jaguars', abbreviation: 'JAX', conference: 'AFC', division: 'South', aliases: ['Jags'] },
  { id: 'nfl-ten', league: 'nfl', city: 'Tennessee', name: 'Titans', displayName: 'Titans', abbreviation: 'TEN', conference: 'AFC', division: 'South', aliases: [] },
  // AFC West
  { id: 'nfl-den', league: 'nfl', city: 'Denver', name: 'Broncos', displayName: 'Broncos', abbreviation: 'DEN', conference: 'AFC', division: 'West', aliases: [] },
  { id: 'nfl-kc', league: 'nfl', city: 'Kansas City', name: 'Chiefs', displayName: 'Chiefs', abbreviation: 'KC', conference: 'AFC', division: 'West', aliases: [] },
  { id: 'nfl-lv', league: 'nfl', city: 'Las Vegas', name: 'Raiders', displayName: 'Raiders', abbreviation: 'LV', conference: 'AFC', division: 'West', aliases: [] },
  { id: 'nfl-lac', league: 'nfl', city: 'Los Angeles', name: 'Chargers', displayName: 'LA Chargers', abbreviation: 'LAC', conference: 'AFC', division: 'West', aliases: ['Bolts'] },
  // NFC East
  { id: 'nfl-dal', league: 'nfl', city: 'Dallas', name: 'Cowboys', displayName: 'Cowboys', abbreviation: 'DAL', conference: 'NFC', division: 'East', aliases: ['Boys'] },
  { id: 'nfl-nyg', league: 'nfl', city: 'New York', name: 'Giants', displayName: 'NY Giants', abbreviation: 'NYG', conference: 'NFC', division: 'East', aliases: [] },
  { id: 'nfl-phi', league: 'nfl', city: 'Philadelphia', name: 'Eagles', displayName: 'Eagles', abbreviation: 'PHI', conference: 'NFC', division: 'East', aliases: ['Birds'] },
  { id: 'nfl-was', league: 'nfl', city: 'Washington', name: 'Commanders', displayName: 'Commanders', abbreviation: 'WAS', conference: 'NFC', division: 'East', aliases: [] },
  // NFC North
  { id: 'nfl-chi', league: 'nfl', city: 'Chicago', name: 'Bears', displayName: 'Bears', abbreviation: 'CHI', conference: 'NFC', division: 'North', aliases: [] },
  { id: 'nfl-det', league: 'nfl', city: 'Detroit', name: 'Lions', displayName: 'Lions', abbreviation: 'DET', conference: 'NFC', division: 'North', aliases: [] },
  { id: 'nfl-gb', league: 'nfl', city: 'Green Bay', name: 'Packers', displayName: 'Packers', abbreviation: 'GB', conference: 'NFC', division: 'North', aliases: ['Pack'] },
  { id: 'nfl-min', league: 'nfl', city: 'Minnesota', name: 'Vikings', displayName: 'Vikings', abbreviation: 'MIN', conference: 'NFC', division: 'North', aliases: ['Vikes'] },
  // NFC South
  { id: 'nfl-atl', league: 'nfl', city: 'Atlanta', name: 'Falcons', displayName: 'Falcons', abbreviation: 'ATL', conference: 'NFC', division: 'South', aliases: [] },
  { id: 'nfl-car', league: 'nfl', city: 'Carolina', name: 'Panthers', displayName: 'Panthers', abbreviation: 'CAR', conference: 'NFC', division: 'South', aliases: [] },
  { id: 'nfl-no', league: 'nfl', city: 'New Orleans', name: 'Saints', displayName: 'Saints', abbreviation: 'NO', conference: 'NFC', division: 'South', aliases: [] },
  { id: 'nfl-tb', league: 'nfl', city: 'Tampa Bay', name: 'Buccaneers', displayName: 'Buccaneers', abbreviation: 'TB', conference: 'NFC', division: 'South', aliases: ['Bucs'] },
  // NFC West
  { id: 'nfl-ari', league: 'nfl', city: 'Arizona', name: 'Cardinals', displayName: 'Cardinals', abbreviation: 'ARI', conference: 'NFC', division: 'West', aliases: ['Cards'] },
  { id: 'nfl-lar', league: 'nfl', city: 'Los Angeles', name: 'Rams', displayName: 'LA Rams', abbreviation: 'LAR', conference: 'NFC', division: 'West', aliases: [] },
  { id: 'nfl-sf', league: 'nfl', city: 'San Francisco', name: '49ers', displayName: '49ers', abbreviation: 'SF', conference: 'NFC', division: 'West', aliases: ['Niners'] },
  { id: 'nfl-sea', league: 'nfl', city: 'Seattle', name: 'Seahawks', displayName: 'Seahawks', abbreviation: 'SEA', conference: 'NFC', division: 'West', aliases: ['Hawks'] },
];

export const ALL_TEAMS: TeamRecord[] = [...NBA_TEAMS, ...NFL_TEAMS];

/** Get the team pool for a given game mode. */
export function getTeamPool(mode: GameMode): TeamRecord[] {
  switch (mode) {
    case 'nba': return NBA_TEAMS;
    case 'nfl': return NFL_TEAMS;
    case 'mixed': return ALL_TEAMS;
  }
}

/** Build a lookup map from abbreviation+league to TeamRecord. */
function buildLookup(): Map<string, TeamRecord> {
  const map = new Map<string, TeamRecord>();
  for (const t of ALL_TEAMS) {
    // Key by abbreviation+league to handle shared abbreviations (ATL, CHI, etc.)
    map.set(`${t.abbreviation}:${t.league}`, t);
    // Also key by abbreviation alone (last write wins, but good enough for lookups
    // when we also know the league context)
    map.set(t.abbreviation, t);
  }
  return map;
}

const TEAM_LOOKUP = buildLookup();

/** Look up a team by abbreviation. If league is known, prefer that. */
export function lookupTeam(abbreviation: string, league?: 'nba' | 'nfl'): TeamRecord | undefined {
  if (league) {
    return TEAM_LOOKUP.get(`${abbreviation}:${league}`) ?? TEAM_LOOKUP.get(abbreviation);
  }
  return TEAM_LOOKUP.get(abbreviation);
}

/**
 * Get abbreviation arrays for a mode (for backward compat with engine).
 * In mixed mode, deduplicates shared abbreviations (ATL, CHI, etc.)
 * to avoid confusing identical-looking cards.
 */
export function getAbbreviationPool(mode: GameMode): string[] {
  const pool = getTeamPool(mode);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of pool) {
    if (!seen.has(t.abbreviation)) {
      seen.add(t.abbreviation);
      result.push(t.abbreviation);
    }
  }
  return result;
}
