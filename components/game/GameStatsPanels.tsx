import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import TeamLogo from '@/components/TeamLogo';
import { stadiumSlate } from '@/lib/theme';
import type { GameWithTeams, Sport } from '@/types/database';
import type {
  GameStatsLeaderGroup,
  GameStatsPlayerGroup,
  GameStatsResponse,
  GameStatsTeamSummary,
} from '@/types/gameStats';

const PANEL_STYLE = {
  borderRadius: 22,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.09)',
  backgroundColor: 'rgba(20,27,37,0.96)',
  overflow: 'hidden' as const,
};

function gameDateLabel(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statValue(group: GameStatsTeamSummary | undefined, key: string): string {
  return group?.stats.find((stat) => stat.key === key)?.value ?? '-';
}

function numericStat(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayTeamStat(key: string, value: string): string {
  return key.toLowerCase().includes('pct') && value !== '-' ? `${value}%` : value;
}

function LineScore({ stats, isDesktop }: { stats: GameStatsResponse; isDesktop: boolean }) {
  if (stats.periods.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: isDesktop ? 1 : 0 }}>
      <View style={{ minWidth: isDesktop ? '100%' : 520, paddingHorizontal: isDesktop ? 30 : 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ width: 82, color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>
            LINE SCORE
          </Text>
          {stats.periods.map((period) => (
            <Text key={period.label} style={{ flex: 1, minWidth: 42, textAlign: 'center', color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800' }}>
              {period.label}
            </Text>
          ))}
          <Text style={{ width: 52, textAlign: 'right', color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '800' }}>T</Text>
        </View>
        {[
          { team: stats.awayTeam, values: stats.periods.map((period) => period.away) },
          { team: stats.homeTeam, values: stats.periods.map((period) => period.home) },
        ].map((row, index) => (
          <View
            key={row.team.abbreviation}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 34,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.07)',
            }}
          >
            <Text style={{ width: 82, color: stadiumSlate.text, fontSize: 13, fontWeight: '900' }}>{row.team.abbreviation}</Text>
            {row.values.map((value, periodIndex) => (
              <Text key={`${index}-${periodIndex}`} style={{ flex: 1, minWidth: 42, textAlign: 'center', color: stadiumSlate.textMuted, fontSize: 13, fontWeight: '600' }}>
                {value}
              </Text>
            ))}
            <Text style={{ width: 52, textAlign: 'right', color: stadiumSlate.text, fontSize: 14, fontWeight: '900' }}>{row.team.score}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function GameScoreHero({
  game,
  stats,
  isDesktop,
}: {
  game: GameWithTeams;
  stats?: GameStatsResponse;
  isDesktop: boolean;
}) {
  const sport: Sport = game.sport ?? 'nba';
  const awayScore = stats?.awayTeam.score || String(game.away_team_score ?? '—');
  const homeScore = stats?.homeTeam.score || String(game.home_team_score ?? '—');
  const awayRecord = stats?.awayTeam.record ?? game.away_team_record;
  const homeRecord = stats?.homeTeam.record ?? game.home_team_record;
  const awayWon = stats?.awayTeam.winner ?? Number(awayScore) > Number(homeScore);
  const homeWon = stats?.homeTeam.winner ?? Number(homeScore) > Number(awayScore);
  const status = stats?.statusDetail || (game.status === 'final' ? 'Final' : game.status);
  const awayColor = stats?.awayTeam.color ?? '#552583';
  const homeColor = stats?.homeTeam.color ?? '#ce1141';

  const teamBlock = (
    side: 'away' | 'home',
    abbreviation: string,
    name: string,
    score: string,
    record: string | null,
    winner: boolean,
  ) => (
    <View style={{ flex: 1, alignItems: side === 'away' && isDesktop ? 'flex-start' : side === 'home' && isDesktop ? 'flex-end' : 'center', minWidth: 0 }}>
      <View style={{ flexDirection: side === 'home' && isDesktop ? 'row-reverse' : 'row', alignItems: 'center', gap: isDesktop ? 18 : 8 }}>
        <View
          style={{
            width: isDesktop ? 88 : 56,
            height: isDesktop ? 88 : 56,
            borderRadius: isDesktop ? 26 : 18,
            backgroundColor: 'rgba(255,255,255,0.055)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.09)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TeamLogo abbreviation={abbreviation} sport={sport} size={isDesktop ? 68 : 44} />
        </View>
        {isDesktop ? (
          <View style={{ alignItems: side === 'away' ? 'flex-start' : 'flex-end', minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: stadiumSlate.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>{name}</Text>
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700', marginTop: 5 }}>
              {abbreviation}{record ? `  ·  ${record}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
      {!isDesktop ? (
        <>
          <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '900', marginTop: 10 }}>{abbreviation}</Text>
          {record ? <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, marginTop: 2 }}>{record}</Text> : null}
        </>
      ) : null}
      <Text
        style={{
          color: winner ? stadiumSlate.text : stadiumSlate.textMuted,
          fontSize: isDesktop ? 58 : 40,
          fontWeight: '900',
          letterSpacing: -2.5,
          marginTop: isDesktop ? 22 : 8,
          fontVariant: ['tabular-nums'],
        }}
      >
        {score}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        ...PANEL_STYLE,
        backgroundColor: '#111823',
        boxShadow: isDesktop ? '0 24px 80px rgba(0,0,0,0.28)' : undefined,
      } as any}
    >
      <View pointerEvents="none" style={{ position: 'absolute', left: -90, top: -150, width: '58%', height: 410, borderRadius: 220, backgroundColor: awayColor, opacity: 0.13 }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -90, top: -150, width: '58%', height: 410, borderRadius: 220, backgroundColor: homeColor, opacity: 0.13 }} />

      <View style={{ paddingHorizontal: isDesktop ? 36 : 18, paddingTop: isDesktop ? 28 : 20, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 }}>
            {(game.sport ?? 'nba').toUpperCase()}{game.postseason ? ' PLAYOFFS' : ''}
          </Text>
          <View style={{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: game.status === 'live' ? 'rgba(255,77,109,0.16)' : 'rgba(255,255,255,0.065)', borderWidth: 1, borderColor: game.status === 'live' ? 'rgba(255,77,109,0.35)' : 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: game.status === 'live' ? stadiumSlate.danger : stadiumSlate.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' }}>{status}</Text>
          </View>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '700' }}>{gameDateLabel(game.game_date_utc)}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isDesktop ? 30 : 24, gap: isDesktop ? 30 : 10 }}>
          {teamBlock('away', game.away_team.abbreviation, game.away_team.full_name, awayScore, awayRecord, awayWon)}
          <View style={{ alignItems: 'center', width: isDesktop ? 150 : 38 }}>
            <Text style={{ color: stadiumSlate.accent, fontSize: isDesktop ? 13 : 11, fontWeight: '900', letterSpacing: 1.2 }}>AT</Text>
            {isDesktop && game.status === 'final' ? (
              <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                {awayWon ? game.away_team.name : homeWon ? game.home_team.name : 'Game'} wins
              </Text>
            ) : null}
          </View>
          {teamBlock('home', game.home_team.abbreviation, game.home_team.full_name, homeScore, homeRecord, homeWon)}
        </View>

        {stats?.seriesSummary ? (
          <Text style={{ color: stadiumSlate.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 18 }}>
            {stats.seriesSummary}
          </Text>
        ) : null}
      </View>

      {stats ? (
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingVertical: 13, backgroundColor: 'rgba(4,8,14,0.22)' }}>
          <LineScore stats={stats} isDesktop={isDesktop} />
        </View>
      ) : null}
    </View>
  );
}

function LeaderTeamCard({ group }: { group: GameStatsLeaderGroup }) {
  return (
    <View style={{ ...PANEL_STYLE, flex: 1, minWidth: 260, padding: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <TeamLogo abbreviation={group.team.abbreviation} size={30} />
        <View>
          <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '900' }}>{group.team.shortName}</Text>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 1 }}>GAME LEADERS</Text>
        </View>
      </View>
      {group.leaders.slice(0, 3).map((leader, index) => (
        <View key={leader.category} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, borderTopWidth: index ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.07)' }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: stadiumSlate.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            {leader.headshot ? <Image source={{ uri: leader.headshot }} style={{ width: 34, height: 34 }} contentFit="cover" /> : <Text style={{ color: stadiumSlate.textMuted, fontSize: 10 }}>{leader.athleteShortName.slice(0, 2)}</Text>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: stadiumSlate.text, fontSize: 12, fontWeight: '800' }}>{leader.athleteName}</Text>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 }}>{leader.label}</Text>
          </View>
          <Text style={{ color: stadiumSlate.accent, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{leader.value}</Text>
        </View>
      ))}
    </View>
  );
}

const COMPARISON_STATS = [
  { key: 'fieldGoalPct', label: 'Field goal' },
  { key: 'threePointFieldGoalPct', label: 'Three point' },
  { key: 'freeThrowPct', label: 'Free throw' },
  { key: 'totalRebounds', label: 'Rebounds' },
  { key: 'assists', label: 'Assists' },
  { key: 'turnovers', label: 'Turnovers' },
  { key: 'pointsInPaint', label: 'Points in paint' },
  { key: 'fastBreakPoints', label: 'Fast break points' },
];

function TeamStatComparison({ stats }: { stats: GameStatsResponse }) {
  const away = stats.teamStats.find((entry) => entry.team.abbreviation === stats.awayTeam.abbreviation);
  const home = stats.teamStats.find((entry) => entry.team.abbreviation === stats.homeTeam.abbreviation);

  return (
    <View style={{ ...PANEL_STYLE, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: stadiumSlate.accent, fontSize: 13, fontWeight: '900', width: 58 }}>{stats.awayTeam.abbreviation}</Text>
        <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '900', flex: 1, textAlign: 'center' }}>Team comparison</Text>
        <Text style={{ color: stadiumSlate.accent, fontSize: 13, fontWeight: '900', width: 58, textAlign: 'right' }}>{stats.homeTeam.abbreviation}</Text>
      </View>
      {COMPARISON_STATS.map((definition) => {
        const awayValue = statValue(away, definition.key);
        const homeValue = statValue(home, definition.key);
        const awayNumber = numericStat(awayValue);
        const homeNumber = numericStat(homeValue);
        const total = Math.max(awayNumber + homeNumber, 1);
        const awayWidth = `${Math.max(6, (awayNumber / total) * 100)}%`;
        const homeWidth = `${Math.max(6, (homeNumber / total) * 100)}%`;

        return (
          <View key={definition.key} style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ width: 58, color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }}>{displayTeamStat(definition.key, awayValue)}</Text>
              <Text style={{ flex: 1, textAlign: 'center', color: stadiumSlate.textMuted, fontSize: 11, fontWeight: '600' }}>{definition.label}</Text>
              <Text style={{ width: 58, textAlign: 'right', color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }}>{displayTeamStat(definition.key, homeValue)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
              <View style={{ flex: 1, height: 3, alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 999 }}>
                <View style={{ width: awayWidth as any, height: 3, backgroundColor: stats.awayTeam.color, borderRadius: 999 }} />
              </View>
              <View style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 999 }}>
                <View style={{ width: homeWidth as any, height: 3, backgroundColor: stats.homeTeam.color, borderRadius: 999 }} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function GameStatsOverview({ stats, isLoading, error }: { stats?: GameStatsResponse; isLoading: boolean; error: unknown }) {
  if (isLoading) {
    return <GameStatsLoading label="Loading the full game report…" />;
  }

  if (!stats || error) {
    return (
      <View style={{ ...PANEL_STYLE, padding: 30, alignItems: 'center' }}>
        <Text style={{ color: stadiumSlate.text, fontSize: 15, fontWeight: '800' }}>Game report unavailable</Text>
        <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }}>
          The score is saved, but the provider did not return detailed stats for this matchup.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {stats.leaders.map((group) => <LeaderTeamCard key={group.team.abbreviation} group={group} />)}
      </View>
      <TeamStatComparison stats={stats} />
      <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '600', textAlign: 'right' }}>
        Stats via ESPN · cached for fast repeat views
      </Text>
    </View>
  );
}

function PlayerTable({ group, isDesktop }: { group: GameStatsPlayerGroup; isDesktop: boolean }) {
  const nameWidth = isDesktop ? 190 : 145;
  const preferredLabels = ['MIN', 'PTS', 'REB', 'AST', 'FG', '3PT', 'FT', 'STL', 'BLK', 'TO', '+/-'];
  const labels = preferredLabels.filter((label) => group.labels.includes(label));
  const starters = group.players.filter((player) => player.starter && !player.didNotPlay);
  const bench = group.players.filter((player) => !player.starter && !player.didNotPlay);
  const dnp = group.players.filter((player) => player.didNotPlay);
  const statWidth = (label: string) => ['FG', '3PT', 'FT'].includes(label) ? 62 : 46;

  const row = (player: GameStatsPlayerGroup['players'][number]) => (
    <View key={player.id || player.displayName} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 43, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
      <View style={{ width: nameWidth, paddingRight: 12 }}>
        <Text numberOfLines={1} style={{ color: stadiumSlate.text, fontSize: 12, fontWeight: player.starter ? '800' : '600' }}>{player.displayName}</Text>
        <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, marginTop: 2 }}>{[player.position, player.jersey ? `#${player.jersey}` : null].filter(Boolean).join(' · ')}</Text>
      </View>
      {labels.map((label) => (
        <Text key={label} style={{ width: statWidth(label), textAlign: 'center', color: label === 'PTS' ? stadiumSlate.text : stadiumSlate.textMuted, fontSize: 12, fontWeight: label === 'PTS' ? '900' : '600', fontVariant: ['tabular-nums'] }}>
          {player.stats[label] ?? '-'}
        </Text>
      ))}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ minWidth: nameWidth + labels.reduce((total, label) => total + statWidth(label), 0) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 36 }}>
          <Text style={{ width: nameWidth, color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 }}>PLAYER</Text>
          {labels.map((label) => (
            <Text key={label} style={{ width: statWidth(label), textAlign: 'center', color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '800' }}>{label}</Text>
          ))}
        </View>
        {starters.map(row)}
        {bench.length ? <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, paddingTop: 14, paddingBottom: 5 }}>BENCH</Text> : null}
        {bench.map(row)}
        {dnp.length ? (
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 }}>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 }}>DID NOT PLAY</Text>
            {dnp.map((player) => (
              <Text key={player.id || player.displayName} style={{ color: stadiumSlate.textMuted, fontSize: 11, paddingVertical: 4 }}>
                {player.displayName}{player.reason ? ` · ${player.reason.toLowerCase()}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

export function RemoteBoxScore({ stats, isLoading, error }: { stats?: GameStatsResponse; isLoading: boolean; error: unknown }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const groups = stats?.playerStats ?? [];
  const selectedAbbreviation = activeTeam ?? stats?.awayTeam.abbreviation ?? '';
  const group = groups.find((entry) => entry.team.abbreviation === selectedAbbreviation) ?? groups[0];

  if (isLoading) return <GameStatsLoading label="Loading player box scores…" />;
  if (error || !stats || !group) {
    return (
      <View style={{ ...PANEL_STYLE, padding: 30, alignItems: 'center' }}>
        <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '800' }}>Box score unavailable</Text>
        <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, marginTop: 5 }}>ESPN has not published player stats for this game.</Text>
      </View>
    );
  }

  return (
    <View style={{ ...PANEL_STYLE, padding: isDesktop ? 22 : 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
        <View>
          <Text style={{ color: stadiumSlate.text, fontSize: 16, fontWeight: '900' }}>Player box score</Text>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, marginTop: 3 }}>Tap a team to switch rosters</Text>
        </View>
        <View style={{ flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {groups.map((entry) => {
            const active = entry.team.abbreviation === group.team.abbreviation;
            return (
              <TouchableOpacity
                key={entry.team.abbreviation}
                onPress={() => setActiveTeam(entry.team.abbreviation)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Show ${entry.team.displayName} box score`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 35, borderRadius: 10, backgroundColor: active ? stadiumSlate.accent : 'transparent' }}
              >
                <TeamLogo abbreviation={entry.team.abbreviation} size={20} />
                <Text style={{ color: active ? stadiumSlate.background : stadiumSlate.textMuted, fontSize: 11, fontWeight: '900' }}>{entry.team.abbreviation}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <PlayerTable group={group} isDesktop={isDesktop} />
      <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, marginTop: 14, textAlign: 'right' }}>Official game stats via ESPN</Text>
    </View>
  );
}

export function GameStatsLoading({ label }: { label: string }) {
  return (
    <View style={{ ...PANEL_STYLE, minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ActivityIndicator color={stadiumSlate.accent} size="small" />
      <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, marginTop: 12 }}>{label}</Text>
    </View>
  );
}
