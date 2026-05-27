import { useState } from 'react';
import type { CombatState, CombatEntry } from '@trpg/shared';
import type { AppSocket } from '../socket';
import styles from './InitiativeTracker.module.css';

interface Props {
  combat: CombatState;
  isGM: boolean;
  socket: AppSocket;
}

export default function InitiativeTracker({ combat, isGM, socket }: Props) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState(0);

  function emit(state: CombatState) { socket.emit('combat:set', state); }

  function sorted(entries: CombatEntry[]) {
    return [...entries].sort((a, b) => b.initiative - a.initiative);
  }

  function startCombat() {
    emit({ ...combat, running: true, round: 1, activeId: sorted(combat.entries)[0]?.id ?? null });
  }

  function endCombat() {
    emit({ ...combat, running: false, round: 0, activeId: null });
  }

  function nextTurn() {
    const order = sorted(combat.entries);
    if (!order.length) return;
    const idx = order.findIndex(e => e.id === combat.activeId);
    const next = order[(idx + 1) % order.length];
    const newRound = (idx + 1) >= order.length ? combat.round + 1 : combat.round;
    emit({ ...combat, activeId: next.id, round: newRound });
  }

  function addEntry() {
    if (!newName.trim()) return;
    const entry: CombatEntry = {
      id: crypto.randomUUID().slice(0, 8),
      name: newName.trim(),
      initiative: newInit,
      isPlayer: false,
    };
    emit({ ...combat, entries: [...combat.entries, entry] });
    setNewName(''); setNewInit(0);
  }

  function removeEntry(id: string) {
    const entries = combat.entries.filter(e => e.id !== id);
    const activeId = combat.activeId === id ? (entries[0]?.id ?? null) : combat.activeId;
    emit({ ...combat, entries, activeId });
  }

  function setInitiative(id: string, value: number) {
    emit({ ...combat, entries: combat.entries.map(e => e.id === id ? { ...e, initiative: value } : e) });
  }

  function rollAll() {
    emit({
      ...combat,
      entries: combat.entries.map(e => ({ ...e, initiative: Math.floor(Math.random() * 20) + 1 })),
    });
  }

  const order = sorted(combat.entries);

  return (
    <div className={styles.panel}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>⚔️ 이니셔티브{combat.running ? ` — ${combat.round}라운드` : ''}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.body}>
          {/* 참가자 목록 */}
          {order.length === 0
            ? <p className={styles.empty}>참가자 없음</p>
            : <ul className={styles.list}>
                {order.map(entry => (
                  <li key={entry.id} className={`${styles.entry} ${entry.id === combat.activeId ? styles.active : ''}`}>
                    <span className={styles.entryInit}>{entry.initiative}</span>
                    <span className={styles.entryName}>{entry.name}</span>
                    {isGM && (
                      <>
                        <input
                          type="number"
                          className={styles.initInput}
                          value={entry.initiative}
                          onChange={e => setInitiative(entry.id, +e.target.value)}
                        />
                        <button className={styles.removeBtn} onClick={() => removeEntry(entry.id)}>×</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
          }

          {/* GM 컨트롤 */}
          {isGM && (
            <>
              <div className={styles.addRow}>
                <input placeholder="이름" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEntry()} />
                <input type="number" value={newInit} onChange={e => setNewInit(+e.target.value)}
                  style={{ width: 50 }} />
                <button className={styles.addBtn} onClick={addEntry}>추가</button>
              </div>
              <div className={styles.controls}>
                <button className={styles.ctrlBtn} onClick={rollAll}>🎲 전체 굴리기</button>
                {!combat.running
                  ? <button className={styles.startBtn} onClick={startCombat} disabled={!combat.entries.length}>▶ 전투 시작</button>
                  : <>
                      <button className={styles.ctrlBtn} onClick={nextTurn}>다음 턴 ▶</button>
                      <button className={styles.endBtn} onClick={endCombat}>■ 종료</button>
                    </>
                }
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
