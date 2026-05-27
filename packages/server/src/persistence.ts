import fs from 'fs';
import path from 'path';
import { users, usersByName, rooms, characterSheets, mapStates, combatStates } from './store';
import type { UserRecord } from './store';
import { defaultCombat } from '@trpg/shared';
import type { CharacterSheet } from '@trpg/shared';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(DATA_DIR, 'gamestate.json');

// 캐릭터 시트 영구 저장: roomId → username → sheet
// (런타임 characterSheets는 socketId 키지만 파일 저장은 username 키)
export const savedChars = new Map<string, Map<string, CharacterSheet>>();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function saveAll() {
  ensureDir();

  // 유저 계정
  const usersData: Record<string, UserRecord> = {};
  users.forEach((user, id) => { usersData[id] = user; });
  fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2), 'utf-8');

  // 게임 상태
  const state: {
    rooms: Record<string, { id: string; name: string }>;
    characters: Record<string, Record<string, CharacterSheet>>;
    maps: Record<string, unknown>;
    combats: Record<string, unknown>;
  } = { rooms: {}, characters: {}, maps: {}, combats: {} };

  rooms.forEach((room, id) => {
    state.rooms[id] = { id: room.id, name: room.name };
  });

  // 캐릭터: savedChars(username 키) 기준으로 저장
  // 현재 온라인 플레이어도 반영 (최신 상태 우선)
  savedChars.forEach((byName, roomId) => {
    state.characters[roomId] = {};
    byName.forEach((sheet, username) => {
      state.characters[roomId][username] = sheet;
    });
  });

  mapStates.forEach((map, roomId) => { state.maps[roomId] = map; });
  combatStates.forEach((combat, roomId) => { state.combats[roomId] = combat; });

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveAll(); }, 3000);
}

export function loadAll() {
  ensureDir();

  // 유저 계정 복원
  if (fs.existsSync(USERS_FILE)) {
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) as Record<string, UserRecord>;
    Object.values(raw).forEach(user => {
      users.set(user.id, user);
      usersByName.set(user.username, user);
    });
    console.log(`[저장] 유저 ${users.size}명 복원`);
  }

  // 게임 상태 복원
  if (!fs.existsSync(STATE_FILE)) return;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as {
    rooms?: Record<string, { id: string; name: string }>;
    characters?: Record<string, Record<string, CharacterSheet>>;
    maps?: Record<string, unknown>;
    combats?: Record<string, unknown>;
  };

  if (state.rooms) {
    Object.values(state.rooms).forEach(r => {
      rooms.set(r.id, { id: r.id, name: r.name, players: [] });
    });
    console.log(`[저장] 방 ${rooms.size}개 복원`);
  }

  if (state.characters) {
    Object.entries(state.characters).forEach(([roomId, byName]) => {
      const nameMap = new Map<string, CharacterSheet>();
      Object.entries(byName).forEach(([username, sheet]) => {
        nameMap.set(username, sheet as CharacterSheet);
      });
      savedChars.set(roomId, nameMap);
    });
  }

  if (state.maps) {
    Object.entries(state.maps).forEach(([roomId, map]) => {
      mapStates.set(roomId, map as Parameters<typeof mapStates.set>[1]);
    });
  }

  if (state.combats) {
    Object.entries(state.combats).forEach(([roomId, combat]) => {
      combatStates.set(roomId, (combat ?? defaultCombat()) as Parameters<typeof combatStates.set>[1]);
    });
  }

  console.log(`[저장] 게임 상태 복원 완료`);
}
