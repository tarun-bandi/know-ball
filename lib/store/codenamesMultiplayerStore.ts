import { create } from 'zustand';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Generate a stable anonymous ID for guests (persists across page reloads on web)
const ANON_ID_KEY = 'codenames_anon_id';
let _anonId: string | null = null;
export function getAnonId(): string {
  if (!_anonId) {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(ANON_ID_KEY);
      if (stored) {
        _anonId = stored;
      } else {
        _anonId = uuidv4();
        localStorage.setItem(ANON_ID_KEY, _anonId);
      }
    } else {
      _anonId = uuidv4();
    }
  }
  return _anonId;
}

interface CodenamesMultiplayerState {
  roomId: string | null;
  roomCode: string | null;
  myPlayerId: string | null;
  myUserId: string | null; // auth user id OR anon id
  myTeam: 'red' | 'blue' | null;
  myRole: 'spymaster' | 'guesser' | null;
  isHost: boolean;

  setRoom: (roomId: string, roomCode: string, isHost: boolean) => void;
  setMyPlayer: (playerId: string, team: 'red' | 'blue' | null, role: 'spymaster' | 'guesser' | null) => void;
  setMyUserId: (userId: string) => void;
  updateMyAssignment: (team: 'red' | 'blue' | null, role: 'spymaster' | 'guesser' | null) => void;
  reset: () => void;
}

export const useCodenamesMultiplayerStore = create<CodenamesMultiplayerState>((set) => ({
  roomId: null,
  roomCode: null,
  myPlayerId: null,
  myUserId: null,
  myTeam: null,
  myRole: null,
  isHost: false,

  setRoom: (roomId, roomCode, isHost) => set({ roomId, roomCode, isHost }),
  setMyPlayer: (playerId, team, role) => set({ myPlayerId: playerId, myTeam: team, myRole: role }),
  setMyUserId: (userId) => set({ myUserId: userId }),
  updateMyAssignment: (team, role) => set({ myTeam: team, myRole: role }),
  reset: () => set({ roomId: null, roomCode: null, myPlayerId: null, myUserId: null, myTeam: null, myRole: null, isHost: false }),
}));
