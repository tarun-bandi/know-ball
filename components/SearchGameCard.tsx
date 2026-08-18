import { View, Text, TouchableOpacity } from 'react-native';
import TeamLogo from '@/components/TeamLogo';
import PlayoffBadge from '@/components/PlayoffBadge';
import type { GameWithTeams } from '@/types/database';

interface SearchGameCardProps {
  game: GameWithTeams;
  isLogged: boolean;
  onPress: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function SearchGameCard({ game, isLogged, onPress }: SearchGameCardProps) {
  const isFinal = game.status === 'final';
  const hasScores = game.home_team_score != null && game.away_team_score != null;
  const homeWon = isFinal && hasScores && game.home_team_score! > game.away_team_score!;
  const awayWon = isFinal && hasScores && game.away_team_score! > game.home_team_score!;
  const hasOT = game.home_ot != null && game.home_ot > 0;
  const phaseLabel = game.phase === 'preseason'
    ? 'Preseason'
    : game.phase === 'postseason'
    ? 'Postseason'
    : null;

  return (
    <TouchableOpacity
      className="mx-4 mb-3 bg-surface border border-border rounded-2xl p-4"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Top row: date + badges */}
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-white text-xs font-bold uppercase">{game.sport}</Text>
          <View className="h-1 w-1 rounded-full bg-muted" />
          <Text className="text-muted text-xs">{formatDate(game.game_date_utc)}</Text>
          {game.week && <Text className="text-muted text-xs">· Week {game.week}</Text>}
        </View>
        <View className="flex-row items-center gap-2">
          {phaseLabel && (
            <View className="bg-accent/10 border border-accent/30 rounded-full px-2 py-0.5">
              <Text className="text-accent text-xs font-semibold">{phaseLabel}</Text>
            </View>
          )}
          {hasOT && (
            <View className="bg-surface border border-border rounded-full px-2 py-0.5">
              <Text className="text-muted text-xs font-medium">OT</Text>
            </View>
          )}
          {game.playoff_round && <PlayoffBadge round={game.playoff_round} sport={game.sport ?? 'nba'} />}
          {isLogged && (
            <View className="bg-accent/20 border border-accent/40 rounded-full px-2 py-0.5">
              <Text className="text-accent text-xs font-medium">Logged</Text>
            </View>
          )}
        </View>
      </View>

      {/* Away team row */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3 flex-1">
          <TeamLogo abbreviation={game.away_team.abbreviation} sport={game.sport ?? 'nba'} size={30} />
          <View className="flex-1">
            <Text className={`text-sm ${awayWon ? 'text-white font-bold' : 'text-muted font-semibold'}`}>
              {game.away_team.full_name}
            </Text>
            <Text className="text-muted text-[11px] mt-0.5">Away</Text>
          </View>
        </View>
        {hasScores && (
          <Text
            className={`text-xl tabular-nums ${
              awayWon ? 'text-white font-bold' : 'text-muted'
            }`}
          >
            {game.away_team_score}
          </Text>
        )}
      </View>

      {/* Home team row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <TeamLogo abbreviation={game.home_team.abbreviation} sport={game.sport ?? 'nba'} size={30} />
          <View className="flex-1">
            <Text className={`text-sm ${homeWon ? 'text-white font-bold' : 'text-muted font-semibold'}`}>
              {game.home_team.full_name}
            </Text>
            <Text className="text-muted text-[11px] mt-0.5">Home</Text>
          </View>
        </View>
        {hasScores && (
          <Text
            className={`text-xl tabular-nums ${
              homeWon ? 'text-white font-bold' : 'text-muted'
            }`}
          >
            {game.home_team_score}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
