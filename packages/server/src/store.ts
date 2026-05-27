import type { Room, CharacterSheet, MapState, CombatState } from '@trpg/shared';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
}

export const users = new Map<string, UserRecord>();
export const usersByName = new Map<string, UserRecord>();
export const rooms = new Map<string, Room>();
export const characterSheets = new Map<string, Map<string, CharacterSheet>>();
export const mapStates = new Map<string, MapState>();
export const combatStates = new Map<string, CombatState>();

rooms.set('default', { id: 'default', name: '기본 방', players: [] });
