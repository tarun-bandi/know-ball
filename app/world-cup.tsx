import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, Medal, Radio, Trophy } from 'lucide-react-native';
import { PageContainer } from '@/components/PageContainer';
import TeamLogo from '@/components/TeamLogo';
import { supabase } from '@/lib/supabase';
import { stadiumSlate } from '@/lib/theme';
import {
  WORLD_CUP_STAGE_LABELS,
  buildWorldCupBracket,
  computeWorldCupStandings,
  formatWorldCupStage,
  sortGoldenBootRace,
  type GoldenBootEntry,
  type WorldCupBracketMatch,
  type WorldCupKnockoutStage,
  type WorldCupStage,
} from '@/lib/worldCup';
import type { Player, Team, WorldCupGame, WorldCupPlayerStat } from '@/types/database';

interface WorldCupHubData {
  games: WorldCupGame[];
  leaders: GoldenBootEntry[];
}

const KNOCKOUT_STAGES: WorldCupKnockoutStage[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'third_place',
  'final',
];

const worldCupSurface = 'rgba(12,22,32,0.96)';
const worldCupSurfaceRaised = 'rgba(18,31,45,0.96)';
const worldCupBorder = 'rgba(74,103,132,0.62)';
const worldCupBorderSoft = 'rgba(74,103,132,0.36)';
const worldCupBlue = '#5db7ff';
const worldCupMuted = '#9db0c3';
const worldCupPageBg = '#07111b';

function parseGameDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

async function fetchWorldCupHub(): Promise<WorldCupHubData> {
  const { data: gamesData, error: gamesError } = await supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey (*),
      away_team:teams!games_away_team_id_fkey (*),
      season:seasons (*),
      world_cup_match_metadata (*)
    `)
    .eq('sport', 'world_cup')
    .order('game_date_utc', { ascending: true });

  if (gamesError) throw gamesError;

  const { data: statRows, error: statsError } = await supabase
    .from('world_cup_player_stats')
    .select('*')
    .eq('tournament_year', 2026)
    .order('goals', { ascending: false })
    .limit(20);

  if (statsError) throw statsError;

  const stats = (statRows ?? []) as WorldCupPlayerStat[];
  const playerIds = stats.map((row) => row.player_id);
  const teamIds = stats.map((row) => row.team_id);

  const [playersRes, teamsRes] = await Promise.all([
    playerIds.length
      ? supabase.from('players').select('*').in('id', playerIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from('teams').select('*').in('id', teamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (playersRes.error) throw playersRes.error;
  if (teamsRes.error) throw teamsRes.error;

  const playerRows = (playersRes.data ?? []) as Player[];
  const teamRows = (teamsRes.data ?? []) as Team[];
  const players = new Map(playerRows.map((player) => [player.id, player]));
  const teams = new Map(teamRows.map((team) => [team.id, team]));

  const leaders = sortGoldenBootRace(
    stats.flatMap((stat) => {
      const player = players.get(stat.player_id);
      const team = teams.get(stat.team_id);
      if (!player || !team) return [];
      return [{
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`.trim(),
        team,
        goals: stat.goals,
        assists: stat.assists,
        minutes: stat.minutes,
        matchesPlayed: stat.matches_played,
        penalties: stat.penalties,
        headshotUrl: player.headshot_url,
      }];
    }),
  );

  return {
    games: (gamesData ?? []) as unknown as WorldCupGame[],
    leaders,
  };
}

function StatusPill({ status }: { status: WorldCupGame['status'] }) {
  const live = status === 'live';
  const final = status === 'final';
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 4,
        backgroundColor: live ? 'rgba(49,208,170,0.16)' : final ? 'rgba(143,161,179,0.14)' : 'rgba(78,161,255,0.14)',
        borderWidth: 1,
        borderColor: live ? 'rgba(49,208,170,0.45)' : final ? 'rgba(143,161,179,0.28)' : 'rgba(78,161,255,0.35)',
      }}
    >
      <Text style={{ color: live ? stadiumSlate.success : final ? stadiumSlate.textMuted : stadiumSlate.accent, fontSize: 11, fontWeight: '800' }}>
        {live ? 'LIVE' : final ? 'FINAL' : 'UPCOMING'}
      </Text>
    </View>
  );
}

function MatchCard({ game, compact = false }: { game: WorldCupGame; compact?: boolean }) {
  const router = useRouter();
  const metadata = game.world_cup_match_metadata;
  const scoreVisible = game.status !== 'scheduled';
  return (
    <Pressable
      onPress={() => router.push(`/game/${game.id}`)}
      style={({ hovered, pressed }: any) => ({
        borderRadius: 8,
        borderWidth: 1,
        borderColor: hovered || pressed ? 'rgba(93,183,255,0.62)' : worldCupBorder,
        backgroundColor: worldCupSurfaceRaised,
        padding: compact ? 12 : 16,
        minWidth: compact ? 220 : 260,
        transform: hovered || pressed ? [{ translateY: -1 }] : undefined,
        boxShadow: Platform.OS === 'web' && (hovered || pressed) ? '0 14px 32px rgba(0,0,0,0.28)' : 'none',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700' }}>
          {metadata?.status_note ?? formatWorldCupStage(metadata?.stage)}
        </Text>
        <StatusPill status={game.status} />
      </View>

      {[
        { team: game.away_team, score: game.away_team_score, penalties: metadata?.away_penalties },
        { team: game.home_team, score: game.home_team_score, penalties: metadata?.home_penalties },
      ].map((row) => (
        <View key={row.team.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <TeamLogo abbreviation={row.team.abbreviation} sport="world_cup" size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: stadiumSlate.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                {row.team.full_name}
              </Text>
              <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '700' }}>
                {row.team.abbreviation}
              </Text>
            </View>
          </View>
          <Text style={{ color: stadiumSlate.text, fontSize: 22, fontWeight: '900', minWidth: 34, textAlign: 'right' }}>
            {scoreVisible ? row.score ?? 0 : '-'}
          </Text>
          {row.penalties != null ? (
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 13, fontWeight: '800', marginLeft: 5 }}>
              ({row.penalties})
            </Text>
          ) : null}
        </View>
      ))}

      <View style={{ height: 1, backgroundColor: worldCupBorderSoft, marginVertical: 14 }} />
      <Text style={{ color: worldCupMuted, fontSize: 12, fontWeight: '700' }}>
        {parseGameDate(game.game_date_utc)}{game.broadcast ? ` / ${game.broadcast}` : ''}
      </Text>
    </Pressable>
  );
}

function Hero({ games }: { games: WorldCupGame[] }) {
  const liveGames = games.filter((game) => game.status === 'live');
  const upcoming = games.find((game) => game.status === 'scheduled' && new Date(game.game_date_utc) >= new Date());
  const latestFinal = [...games].reverse().find((game) => game.status === 'final');
  const featured = liveGames[0] ?? upcoming ?? latestFinal ?? games[0];

  return (
    <View
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(93,183,255,0.34)',
        backgroundColor: worldCupSurface,
      }}
    >
      <View
        style={{
          padding: 22,
          backgroundColor: worldCupSurface,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(93,183,255,0.18)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Trophy size={18} color={worldCupBlue} />
          <Text style={{ color: worldCupBlue, fontSize: 12, fontWeight: '900', letterSpacing: 0 }}>
            2026 FIFA WORLD CUP
          </Text>
        </View>
        <Text style={{ color: stadiumSlate.text, fontSize: 34, lineHeight: 38, fontWeight: '900', maxWidth: 680 }}>
          Tournament control room
        </Text>
        <Text style={{ color: worldCupMuted, fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 620 }}>
          Follow every match, group-table swing, knockout slot, and Golden Boot push from one focused dashboard.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <View style={{ borderRadius: 8, borderWidth: 1, borderColor: 'rgba(49,208,170,0.35)', backgroundColor: 'rgba(49,208,170,0.12)', paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: stadiumSlate.success, fontSize: 12, fontWeight: '900' }}>{liveGames.length} live now</Text>
          </View>
          <View style={{ borderRadius: 8, borderWidth: 1, borderColor: 'rgba(93,183,255,0.35)', backgroundColor: 'rgba(93,183,255,0.12)', paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#d9ecff', fontSize: 12, fontWeight: '900' }}>{games.length} matches tracked</Text>
          </View>
        </View>
      </View>

      {featured ? (
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: worldCupBorderSoft }}>
          <Text style={{ color: worldCupMuted, fontSize: 12, fontWeight: '800', marginBottom: 10 }}>
            Spotlight match
          </Text>
          <MatchCard game={featured} />
        </View>
      ) : null}
    </View>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {icon}
        <View>
          <Text style={{ color: stadiumSlate.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
          {subtitle ? <Text style={{ color: worldCupMuted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function StandingsTable({ games }: { games: WorldCupGame[] }) {
  const standings = useMemo(() => computeWorldCupStandings(games), [games]);
  const groupEntries = Object.entries(standings);

  if (groupEntries.length === 0) {
    return (
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: worldCupBorder, backgroundColor: worldCupSurfaceRaised, padding: 16 }}>
        <Text style={{ color: worldCupMuted }}>Group standings will appear after World Cup data syncs.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {groupEntries.map(([groupCode, rows]) => (
        <View
          key={groupCode}
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: worldCupBorder,
            backgroundColor: worldCupSurfaceRaised,
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: worldCupBorderSoft }}>
            <Text style={{ color: stadiumSlate.text, fontSize: 16, fontWeight: '900' }}>Group {groupCode}</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <Text style={{ width: 28, color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800' }}>#</Text>
              <Text style={{ flex: 1, color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800' }}>Team</Text>
              {['P', 'GD', 'PTS'].map((label) => (
                <Text key={label} style={{ width: 42, color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800', textAlign: 'right' }}>{label}</Text>
              ))}
            </View>
            {rows.map((row) => {
              const qualified = row.qualificationStatus === 'qualified';
              return (
                <View
                  key={row.team.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 9,
                    borderTopWidth: 1,
                    borderTopColor: worldCupBorderSoft,
                  }}
                >
                  <Text style={{ width: 28, color: qualified ? stadiumSlate.success : stadiumSlate.textMuted, fontSize: 13, fontWeight: '900' }}>{row.rank}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TeamLogo abbreviation={row.team.abbreviation} sport="world_cup" size={22} />
                    <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                      {row.team.full_name}
                    </Text>
                  </View>
                  <Text style={{ width: 42, color: stadiumSlate.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>{row.played}</Text>
                  <Text style={{ width: 42, color: stadiumSlate.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text style={{ width: 42, color: stadiumSlate.text, fontSize: 13, fontWeight: '900', textAlign: 'right' }}>{row.points}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function BracketSection({ games }: { games: WorldCupGame[] }) {
  const bracket = useMemo(() => buildWorldCupBracket(games), [games]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 12, paddingBottom: 6 }}>
        {KNOCKOUT_STAGES.map((stage) => {
          const matches = bracket[stage] ?? [];
          return (
            <View key={stage} style={{ width: 250 }}>
              <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '900', marginBottom: 10 }}>
                {WORLD_CUP_STAGE_LABELS[stage]}
              </Text>
              <View style={{ gap: 10 }}>
                {matches.length > 0 ? matches.map((match) => <BracketCard key={match.id} match={match} />) : (
                  <View style={{ borderRadius: 8, borderWidth: 1, borderColor: worldCupBorder, backgroundColor: worldCupSurfaceRaised, padding: 14, minHeight: 92 }}>
                    <Text style={{ color: worldCupMuted, fontSize: 12, fontWeight: '700' }}>Slots will populate as the stage is set.</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function BracketCard({ match }: { match: WorldCupBracketMatch }) {
  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: worldCupBorder, backgroundColor: worldCupSurfaceRaised, padding: 12 }}>
      <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800', marginBottom: 8 }}>{match.slot}</Text>
      {[
        { team: match.awayTeam, seed: match.awaySeedLabel, score: match.awayScore, pens: match.awayPenalties },
        { team: match.homeTeam, seed: match.homeSeedLabel, score: match.homeScore, pens: match.homePenalties },
      ].map((row, index) => {
        const winner = row.team?.id === match.winnerTeamId;
        return (
          <View key={`${match.id}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
            <Text style={{ flex: 1, color: winner ? stadiumSlate.text : stadiumSlate.textMuted, fontSize: 13, fontWeight: winner ? '900' : '700' }} numberOfLines={1}>
              {row.team?.full_name ?? row.seed ?? 'TBD'}
            </Text>
            <Text style={{ color: winner ? stadiumSlate.success : stadiumSlate.text, fontSize: 14, fontWeight: '900', minWidth: 24, textAlign: 'right' }}>
              {match.status === 'scheduled' ? '-' : row.score ?? 0}
            </Text>
            {row.pens != null ? <Text style={{ color: stadiumSlate.textMuted, fontSize: 11, marginLeft: 3 }}>({row.pens})</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function GoldenBootSection({ leaders }: { leaders: GoldenBootEntry[] }) {
  if (leaders.length === 0) {
    return (
      <View style={{ borderRadius: 8, borderWidth: 1, borderColor: worldCupBorder, backgroundColor: worldCupSurfaceRaised, padding: 16 }}>
        <Text style={{ color: worldCupMuted }}>
          Golden Boot data will appear as player stat data syncs from the provider.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: worldCupBorder, backgroundColor: worldCupSurfaceRaised, overflow: 'hidden' }}>
      {leaders.slice(0, 10).map((entry, index) => (
        <View
          key={entry.playerId}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: worldCupBorderSoft,
          }}
        >
          <Text style={{ width: 24, color: index < 3 ? stadiumSlate.accent : stadiumSlate.textMuted, fontSize: 14, fontWeight: '900' }}>{index + 1}</Text>
          {entry.headshotUrl ? (
            <Image source={{ uri: entry.headshotUrl }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: stadiumSlate.surfaceRaised }} />
          ) : (
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: stadiumSlate.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: stadiumSlate.text, fontSize: 12, fontWeight: '900' }}>{entry.playerName.slice(0, 1)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>{entry.playerName}</Text>
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, marginTop: 2 }}>{entry.team.full_name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: stadiumSlate.text, fontSize: 22, fontWeight: '900' }}>{entry.goals}</Text>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800' }}>goals</Text>
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 42 }}>
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 13, fontWeight: '900' }}>{entry.assists}</Text>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800' }}>ast</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function WorldCupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 980;
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['world-cup-hub'],
    queryFn: fetchWorldCupHub,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const games = data?.games ?? [];
  const leaders = data?.leaders ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: worldCupPageBg }}>
        <PageContainer showDesktopNav className="flex-1 px-4 py-8">
          <ActivityIndicator color={worldCupBlue} />
        </PageContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: worldCupPageBg }}>
    <PageContainer showDesktopNav className="flex-1">
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={stadiumSlate.accent} />}
        style={{ flex: 1, backgroundColor: worldCupPageBg }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 48, gap: 24 }}
      >
        <Hero games={games} />

        {error ? (
          <View style={{ borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,107,118,0.42)', backgroundColor: 'rgba(255,107,118,0.08)', padding: 14 }}>
            <Text style={{ color: stadiumSlate.danger, fontWeight: '800' }}>World Cup data could not load. Pull to refresh.</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 18 }}>
          <View style={{ flex: isWide ? 1.2 : undefined }}>
            <SectionHeader
              icon={<CalendarDays size={20} color={stadiumSlate.accent} />}
              title="Group Standings"
              subtitle="Points, goal difference, and qualification pressure"
            />
            <StandingsTable games={games} />
          </View>

          <View style={{ flex: isWide ? 0.8 : undefined }}>
            <SectionHeader
              icon={<Medal size={20} color={stadiumSlate.accent} />}
              title="Golden Boot"
              subtitle="Goals first, then assists and minutes"
            />
            <GoldenBootSection leaders={leaders} />
          </View>
        </View>

        <View>
          <SectionHeader
            icon={<Trophy size={20} color={stadiumSlate.accent} />}
            title="Knockout Bracket"
            subtitle="Slots update as final results land"
          />
          <BracketSection games={games} />
        </View>

        <View>
          <SectionHeader
            icon={<Radio size={20} color={stadiumSlate.accent} />}
            title="All Matches"
            subtitle="Open any match to log it"
          />
          {games.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {games.map((game) => (
                <MatchCard key={game.id} game={game} compact />
              ))}
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/feed')}
              style={{ borderRadius: 8, borderWidth: 1, borderColor: worldCupBorder, backgroundColor: worldCupSurfaceRaised, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ color: worldCupMuted, fontWeight: '700' }}>Run the World Cup sync to populate matches.</Text>
              <ChevronRight size={18} color={worldCupMuted} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </PageContainer>
    </View>
  );
}
