import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/lib/store/authStore';
import Avatar from '@/components/Avatar';
import PlayerAvatar from '@/components/PlayerAvatar';
import TeamLogo from '@/components/TeamLogo';
import TeamGrid from '@/components/TeamGrid';
import SelectedTeamsBar from '@/components/SelectedTeamsBar';
import SearchGameCard from '@/components/SearchGameCard';
import type { GameWithTeams, Season, UserProfile, Player, Team, Sport } from '@/types/database';
import { PageContainer } from '@/components/PageContainer';

const PAGE_SIZE = 20;

type SearchMode = 'games' | 'users' | 'players';
type BrowseSport = Extract<Sport, 'nba' | 'nfl'>;

interface PlayerWithTeam extends Player {
  team: Team | null;
}

interface PlayersPage {
  players: PlayerWithTeam[];
  nextOffset: number | null;
}

async function searchPlayersPage(
  query: string,
  offset: number,
): Promise<PlayersPage> {
  const { data, error } = await supabase
    .from('players')
    .select('*, team:teams (*)')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order('last_name', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;

  const players = (data ?? []) as unknown as PlayerWithTeam[];
  return {
    players,
    nextOffset: players.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

async function fetchSeasons(sport: BrowseSport): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('sport', sport)
    .order('year', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Season[];
}

interface GamesPage {
  games: GameWithTeams[];
  nextOffset: number | null;
  loggedGameIds: string[];
}

async function searchGames(
  sport: BrowseSport,
  teamId1: string | null,
  teamId2: string | null,
  seasonIds: string[] | null,
  offset: number,
  userId: string | null,
): Promise<GamesPage> {
  let gamesQuery = supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey (*),
      away_team:teams!games_away_team_id_fkey (*),
      season:seasons (*)
    `)
    .eq('status', 'final')
    .eq('sport', sport)
    .lte('game_date_utc', new Date().toISOString())
    .order('game_date_utc', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (teamId1 && teamId2) {
    // Matchup: both teams must be in the game (either side)
    gamesQuery = gamesQuery
      .or(`home_team_id.eq.${teamId1},away_team_id.eq.${teamId1}`)
      .or(`home_team_id.eq.${teamId2},away_team_id.eq.${teamId2}`);
  } else if (teamId1) {
    // Single team
    gamesQuery = gamesQuery
      .or(`home_team_id.eq.${teamId1},away_team_id.eq.${teamId1}`);
  }

  if (seasonIds && seasonIds.length > 0) {
    gamesQuery = gamesQuery.in('season_id', seasonIds);
  }

  const { data, error } = await gamesQuery;
  if (error) throw error;

  let games = (data ?? []) as unknown as GameWithTeams[];

  // For matchup, client-side verify both teams are present (supabase .or() across two calls is additive)
  if (teamId1 && teamId2) {
    games = games.filter((g) => {
      const teams = [g.home_team_id, g.away_team_id];
      return teams.includes(teamId1) && teams.includes(teamId2);
    });
  }

  let loggedGameIds: string[] = [];
  if (userId && games.length > 0) {
    const gameIds = games.map((g) => g.id);
    const { data: userLogs } = await supabase
      .from('game_logs')
      .select('game_id')
      .eq('user_id', userId)
      .in('game_id', gameIds)
      .returns<{ game_id: string }[]>();
    loggedGameIds = (userLogs ?? []).map((l) => l.game_id);
  }

  return {
    games,
    nextOffset: games.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
    loggedGameIds,
  };
}

interface UsersPage {
  users: UserProfile[];
  nextOffset: number | null;
}

async function searchUsersPage(
  query: string,
  offset: number,
): Promise<UsersPage> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .or(`display_name.ilike.%${query}%,handle.ilike.%${query}%`)
    .order('display_name', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;

  const users = (data ?? []) as UserProfile[];
  return {
    users,
    nextOffset: users.length === PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

function formatSeasonLabel(year: number): string {
  const nextYear = (year + 1) % 100;
  return `${year}-${nextYear.toString().padStart(2, '0')}`;
}

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('games');
  const [selectedSport, setSelectedSport] = useState<BrowseSport>('nba');
  const [selectedSeasonYear, setSelectedSeasonYear] = useState<number | null>(null);
  const [selectedTeam1, setSelectedTeam1] = useState<Team | null>(null);
  const [selectedTeam2, setSelectedTeam2] = useState<Team | null>(null);
  const [pickingOpponent, setPickingOpponent] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  const searchPhase = selectedTeam2
    ? 'matchup'
    : selectedTeam1
    ? 'team_selected'
    : 'idle';

  const { data: seasons } = useQuery({
    queryKey: ['seasons', selectedSport],
    queryFn: () => fetchSeasons(selectedSport),
  });

  // Deduplicate seasons by year for the filter pills
  const uniqueSeasonYears = seasons
    ? [...new Set(seasons.map((s) => s.year))].sort((a, b) => b - a)
    : [];

  // Get all season IDs matching the selected year
  const selectedSeasonIds = selectedSeasonYear && seasons
    ? seasons.filter((s) => s.year === selectedSeasonYear).map((s) => s.id)
    : null;

  const gamesQuery = useInfiniteQuery({
    queryKey: ['games-search', selectedSport, selectedTeam1?.id, selectedTeam2?.id, selectedSeasonYear],
    queryFn: ({ pageParam = 0 }) =>
      searchGames(
        selectedSport,
        selectedTeam1?.id ?? null,
        selectedTeam2?.id ?? null,
        selectedSeasonIds,
        pageParam,
        user?.id ?? null,
      ),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: searchMode === 'games',
  });

  const usersQuery = useInfiniteQuery({
    queryKey: ['users-search', debouncedQuery],
    queryFn: ({ pageParam = 0 }) => searchUsersPage(debouncedQuery, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: searchMode === 'users' && debouncedQuery.trim().length >= 2,
  });

  const playersQuery = useInfiniteQuery({
    queryKey: ['players-search', debouncedQuery],
    queryFn: ({ pageParam = 0 }) => searchPlayersPage(debouncedQuery, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: searchMode === 'players' && debouncedQuery.trim().length >= 2,
  });

  const allGames = gamesQuery.data?.pages.flatMap((p) => p.games) ?? [];
  const loggedGameIds = new Set(gamesQuery.data?.pages.flatMap((p) => p.loggedGameIds) ?? []);
  const allUsers = usersQuery.data?.pages.flatMap((p) => p.users) ?? [];
  const allPlayers = playersQuery.data?.pages.flatMap((p) => p.players) ?? [];

  function handleSelectTeam(team: Team) {
    if (pickingOpponent) {
      setSelectedTeam2(team);
      setPickingOpponent(false);
      setQuery('');
    } else {
      setSelectedTeam1(team);
      setSelectedSport(team.sport as BrowseSport);
      setShowTeamPicker(false);
      setQuery('');
    }
  }

  function handleClearTeam1() {
    setSelectedTeam1(null);
    setSelectedTeam2(null);
    setPickingOpponent(false);
    setShowTeamPicker(false);
  }

  function handleClearTeam2() {
    setSelectedTeam2(null);
  }

  function handlePickOpponent() {
    setPickingOpponent(true);
    setQuery('');
  }

  const showGrid =
    searchMode === 'games' && (pickingOpponent || (searchPhase === 'idle' && showTeamPicker));
  const showGamesResults =
    searchMode === 'games' && !pickingOpponent && !(searchPhase === 'idle' && showTeamPicker);

  return (
    <View className="flex-1 bg-background">
      <PageContainer className="flex-1" showDesktopNav>
      {/* Search bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 gap-2">
          <SearchIcon size={18} color="#9aa6b5" />
          <TextInput
            testID="search_input"
            className="flex-1 py-3.5 text-white text-base"
            placeholder={
              searchMode === 'games'
                ? pickingOpponent
                  ? 'Filter opponent...'
                  : searchPhase === 'idle'
                  ? 'Filter by team...'
                  : 'Change team filter...'
                : searchMode === 'users'
                ? 'Search users by name or handle'
                : 'Search players by name'
            }
            placeholderTextColor="#9aa6b5"
            value={query}
            onChangeText={setQuery}
            onFocus={() => {
              if (searchMode === 'games' && searchPhase === 'idle') {
                setShowTeamPicker(true);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Mode toggle */}
      <View className="px-4 pt-3 pb-4">
        <View className="self-start flex-row rounded-full border border-border bg-surface p-1">
          {(['games', 'users', 'players'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              testID={`search_mode_${mode}`}
              onPress={() => {
                setSearchMode(mode);
                if (mode !== 'games') {
                  setSelectedTeam1(null);
                  setSelectedTeam2(null);
                  setPickingOpponent(false);
                  setShowTeamPicker(false);
                }
              }}
              className="rounded-full px-5 py-2"
              style={searchMode === mode ? { backgroundColor: '#ff6a3d' } : undefined}
            >
              <Text
                className="text-sm font-semibold capitalize text-muted"
                style={searchMode === mode ? { color: '#07090d' } : undefined}
              >
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Games mode: Team grid (idle or picking opponent) */}
      {showGrid && (
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-4 pt-1 pb-3">
            <View>
              <Text className="text-white text-lg font-bold">
                {pickingOpponent ? 'Choose an opponent' : 'Filter by team'}
              </Text>
              <Text className="text-muted text-xs mt-0.5">
                {pickingOpponent ? `Only ${selectedSport.toUpperCase()} teams` : 'Pick a team to narrow the game feed'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setPickingOpponent(false);
                setShowTeamPicker(false);
                setQuery('');
                Keyboard.dismiss();
              }}
              className="h-9 w-9 rounded-full bg-surface border border-border items-center justify-center"
              accessibilityLabel="Close team filter"
            >
              <X size={17} color="#9aa6b5" />
            </TouchableOpacity>
          </View>
          <TeamGrid
            query={query}
            sport={selectedSport}
            onSportChange={setSelectedSport}
            showSportTabs={!pickingOpponent}
            onSelectTeam={handleSelectTeam}
            excludeTeamId={pickingOpponent ? selectedTeam1?.id : undefined}
          />
        </View>
      )}

      {/* Games mode: Results */}
      {showGamesResults && (
        <>
          <View className="px-4 pt-1 pb-4">
            <View className="flex-row items-end justify-between gap-3">
              <View className="flex-1">
                <Text className="text-white text-2xl font-black tracking-tight">
                  {selectedTeam1 ? 'Games' : 'Recent games'}
                </Text>
                <Text className="text-muted text-sm mt-1">
                  {selectedTeam1
                    ? `${selectedTeam1.full_name}${selectedTeam2 ? ` vs ${selectedTeam2.full_name}` : ''}`
                    : `Latest ${selectedSport.toUpperCase()} finals, ready to log`}
                </Text>
              </View>
              {!selectedTeam1 && (
                <TouchableOpacity
                  onPress={() => setShowTeamPicker(true)}
                  className="flex-row items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-2"
                  activeOpacity={0.75}
                >
                  <SlidersHorizontal size={14} color="#ff6a3d" />
                  <Text className="text-white text-xs font-semibold">Team</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>

          {selectedTeam1 && (
            <SelectedTeamsBar
              team1={selectedTeam1}
              team2={selectedTeam2}
              onClearTeam1={handleClearTeam1}
              onClearTeam2={handleClearTeam2}
              onPickOpponent={handlePickOpponent}
            />
          )}

          <View className="mx-4 mb-4 rounded-2xl border border-border bg-surface p-2">
            <View className="flex-row rounded-xl bg-background p-1">
              {(['nba', 'nfl'] as const).map((sport) => (
                <TouchableOpacity
                  key={sport}
                  onPress={() => {
                    setSelectedSport(sport);
                    setSelectedSeasonYear(null);
                    setSelectedTeam1(null);
                    setSelectedTeam2(null);
                  }}
                  className="flex-1 items-center rounded-lg py-2.5"
                  style={selectedSport === sport ? { backgroundColor: '#ff6a3d' } : undefined}
                >
                  <Text
                    className="text-xs font-bold uppercase tracking-wide text-muted"
                    style={selectedSport === sport ? { color: '#07090d' } : undefined}
                  >
                    {sport}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {uniqueSeasonYears.length > 0 && (
              <View className="pt-3 pb-1">
                <Text className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                  Season
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 4, paddingBottom: 2 }}
                  style={{ flexGrow: 0 }}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedSeasonYear(null)}
                    className="rounded-lg border border-border bg-background px-3.5 py-2"
                    style={selectedSeasonYear === null ? { backgroundColor: '#ff6a3d', borderColor: '#ff6a3d' } : undefined}
                  >
                    <Text
                      className="text-xs font-semibold text-muted"
                      style={selectedSeasonYear === null ? { color: '#07090d' } : undefined}
                    >
                      All games
                    </Text>
                  </TouchableOpacity>
                  {uniqueSeasonYears.map((year) => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => setSelectedSeasonYear(year)}
                      className="rounded-lg border border-border bg-background px-3.5 py-2"
                      style={selectedSeasonYear === year ? { backgroundColor: '#ff6a3d', borderColor: '#ff6a3d' } : undefined}
                    >
                      <Text
                        className="text-xs font-semibold text-muted"
                        style={selectedSeasonYear === year ? { color: '#07090d' } : undefined}
                      >
                        {formatSeasonLabel(year)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {gamesQuery.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#ff6a3d" />
            </View>
          ) : (
            <FlatList
              data={allGames}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SearchGameCard
                  game={item}
                  isLogged={loggedGameIds.has(item.id)}
                  onPress={() => router.push(`/game/${item.id}`)}
                />
              )}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center pt-16">
                  <Text className="text-muted">No games found</Text>
                </View>
              }
              ListFooterComponent={
                gamesQuery.isFetchingNextPage ? (
                  <View className="py-4">
                    <ActivityIndicator color="#ff6a3d" />
                  </View>
                ) : null
              }
              onEndReached={() => {
                if (gamesQuery.hasNextPage && !gamesQuery.isFetchingNextPage) {
                  gamesQuery.fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              onScrollBeginDrag={Keyboard.dismiss}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  refreshing={gamesQuery.isRefetching && !gamesQuery.isFetchingNextPage}
                  onRefresh={() => gamesQuery.refetch()}
                  tintColor="#ff6a3d"
                />
              }
            />
          )}
        </>
      )}

      {/* Players mode */}
      {searchMode === 'players' && (
        <FlatList
          data={allPlayers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mx-4 my-1 bg-surface border border-border rounded-xl p-4 flex-row items-center gap-3"
              onPress={() => router.push(`/player/${item.id}`)}
              activeOpacity={0.7}
            >
              <PlayerAvatar
                headshot_url={item.headshot_url}
                name={`${item.first_name} ${item.last_name}`}
                size={40}
              />
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">
                  {item.first_name} {item.last_name}
                </Text>
                <View className="flex-row items-center gap-2 mt-0.5">
                  {item.position && (
                    <Text className="text-accent text-xs font-semibold">{item.position}</Text>
                  )}
                  {item.team && (
                    <View className="flex-row items-center gap-1">
                      <TeamLogo abbreviation={(item.team as Team).abbreviation} sport={(item.team as Team).sport ?? 'nba'} size={14} />
                      <Text className="text-muted text-xs">
                        {(item.team as Team).abbreviation}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            debouncedQuery.length >= 2 ? (
              <View className="flex-1 items-center justify-center pt-16">
                <Text className="text-muted">No players found for "{debouncedQuery}"</Text>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center pt-16 px-6">
                <Text className="text-white text-lg font-semibold mb-2">Find players</Text>
                <Text className="text-muted text-center">
                  Search for players by name
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            playersQuery.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#ff6a3d" />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (playersQuery.hasNextPage && !playersQuery.isFetchingNextPage) {
              playersQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          onScrollBeginDrag={Keyboard.dismiss}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            debouncedQuery.length >= 2 ? (
              <RefreshControl
                refreshing={playersQuery.isRefetching && !playersQuery.isFetchingNextPage}
                onRefresh={() => playersQuery.refetch()}
                tintColor="#ff6a3d"
              />
            ) : undefined
          }
        />
      )}

      {/* Users mode */}
      {searchMode === 'users' && (
        <FlatList
          data={allUsers}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mx-4 my-1 bg-surface border border-border rounded-xl p-4 flex-row items-center gap-3"
              onPress={() => router.push(`/user/${item.handle}`)}
              activeOpacity={0.7}
            >
              <Avatar
                url={item.avatar_url}
                name={item.display_name}
                size={40}
              />
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">
                  {item.display_name}
                </Text>
                <Text className="text-muted text-sm">@{item.handle}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            debouncedQuery.length >= 2 ? (
              <View className="flex-1 items-center justify-center pt-16">
                <Text className="text-muted">No users found for "{debouncedQuery}"</Text>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center pt-16 px-6">
                <Text className="text-white text-lg font-semibold mb-2">Find people</Text>
                <Text className="text-muted text-center">
                  Search for users by display name or handle
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            usersQuery.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#ff6a3d" />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (usersQuery.hasNextPage && !usersQuery.isFetchingNextPage) {
              usersQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          onScrollBeginDrag={Keyboard.dismiss}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            debouncedQuery.length >= 2 ? (
              <RefreshControl
                refreshing={usersQuery.isRefetching && !usersQuery.isFetchingNextPage}
                onRefresh={() => usersQuery.refetch()}
                tintColor="#ff6a3d"
              />
            ) : undefined
          }
        />
      )}
      </PageContainer>
    </View>
  );
}
