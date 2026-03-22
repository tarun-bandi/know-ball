import { create } from 'zustand';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Generate a stable anonymous ID for guests (persists for the app session)
let _anonId: string | null = null;
export function getAnonId(): string {
  if (!_anonId) _anonId = uuidv4();
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
