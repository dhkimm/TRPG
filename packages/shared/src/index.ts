export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRollRequest {
  dice: DiceType;
  count: number;
  modifier?: number;
}

export interface DiceRollResult {
  id: string;
  playerName: string;
  dice: DiceType;
  count: number;
  rolls: number[];
  modifier: number;
  total: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  playerName: string;
  text: string;
  type: 'normal' | 'whisper' | 'gm' | 'dice';
  whisperTo?: string;
  timestamp: number;
}

export interface Player {
  id: string;
  name: string;
  isGM: boolean;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
}

export interface RoomSummary {
  id: string;
  name: string;
  playerCount: number;
}

export interface TokenPayload {
  userId: string;
  username: string;
}

export interface CharacterStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterSheet {
  playerId: string;
  playerName: string;
  charName: string;
  race: string;
  charClass: string;
  level: number;
  hp: { current: number; max: number };
  ac: number;
  stats: CharacterStats;
  notes: string;
}

export function defaultSheet(playerId: string, playerName: string): CharacterSheet {
  return {
    playerId, playerName, charName: playerName,
    race: '', charClass: '', level: 1,
    hp: { current: 10, max: 10 }, ac: 10,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    notes: '',
  };
}

export interface MapToken {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  size: number;
  type: 'player' | 'npc' | 'enemy';
  ownerId?: string;
}

export interface MapState {
  cols: number;
  rows: number;
  tokens: MapToken[];
  backgroundUrl?: string;
  fogEnabled: boolean;
  revealedCells: string[]; // "x,y" 형식, fog 활성화 시 보이는 셀
}

// 이니셔티브 트래커
export interface CombatEntry {
  id: string;
  name: string;
  initiative: number;
  hp?: { current: number; max: number };
  isPlayer: boolean;
}

export interface CombatState {
  entries: CombatEntry[];
  activeId: string | null;
  round: number;
  running: boolean;
}

export function defaultCombat(): CombatState {
  return { entries: [], activeId: null, round: 0, running: false };
}

// 서버 → 클라이언트
export interface ServerToClientEvents {
  'room:joined': (room: Room, me: Player) => void;
  'room:playerJoined': (player: Player) => void;
  'room:playerLeft': (playerId: string) => void;
  'chat:message': (msg: ChatMessage) => void;
  'dice:result': (result: DiceRollResult) => void;
  'char:list': (sheets: CharacterSheet[]) => void;
  'char:updated': (sheet: CharacterSheet) => void;
  'map:state': (state: MapState) => void;
  'map:tokenAdded': (token: MapToken) => void;
  'map:tokenMoved': (tokenId: string, x: number, y: number) => void;
  'map:tokenRemoved': (tokenId: string) => void;
  'map:updated': (patch: Partial<Pick<MapState, 'backgroundUrl' | 'fogEnabled' | 'revealedCells'>>) => void;
  'combat:state': (state: CombatState) => void;
  'error': (message: string) => void;
}

// 클라이언트 → 서버
export interface ClientToServerEvents {
  'room:join': (roomId: string) => void;
  'chat:send': (text: string, type?: ChatMessage['type'], targetName?: string) => void;
  'dice:roll': (req: DiceRollRequest) => void;
  'char:update': (patch: Partial<Omit<CharacterSheet, 'playerId' | 'playerName'>>) => void;
  'map:moveToken': (tokenId: string, x: number, y: number) => void;
  'map:addToken': (data: { label: string; color: string; x: number; y: number; type: MapToken['type'] }) => void;
  'map:removeToken': (tokenId: string) => void;
  'map:update': (patch: Partial<Pick<MapState, 'backgroundUrl' | 'fogEnabled' | 'revealedCells'>>) => void;
  'combat:set': (state: CombatState) => void;
}
