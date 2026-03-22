import { create } from 'zustand';

interface CodenamesMultiplayerState {
  roomId: string | null;
  roomCode: string | null;
  myPlayerId: string | null;
  myTeam: 'red' | 'blue' | null;
  myRole: 'spymaster' | 'guesser' | null;
  isHost: boolean;

  setRoom: (roomId: string, roomCode: string, isHost: boolean) => void;
  setMyPlayer: (playerId: string, team: 'red' | 'blue' | null, role: 'spymaster' | 'guesser' | null) => void;
  updateMyAssignment: (team: 'red' | 'blue' | null, role: 'spymaster' | 'guesser' | null) => void;
  reset: () => void;
}

export const useCodenamesMultiplayerStore = create<CodenamesMultiplayerState>((set) => ({
  roomId: null,
  roomCode: null,
  myPlayerId: null,
  myTeam: null,
  myRole: null,
  isHost: false,

  setRoom: (roomId, roomCode, isHost) => set({ roomId, roomCode, isHost }),
  setMyPlayer: (playerId, team, role) => set({ myPlayerId: playerId, myTeam: team, myRole: role }),
  updateMyAssignment: (team, role) => set({ myTeam: team, myRole: role }),
  reset: () => set({ roomId: null, roomCode: null, myPlayerId: null, myTeam: null, myRole: null, isHost: false }),
}));
