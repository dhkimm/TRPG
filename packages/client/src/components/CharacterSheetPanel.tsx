import { useState, useEffect, useCallback } from 'react';
import type { CharacterSheet } from '@trpg/shared';
import type { AppSocket } from '../socket';
import styles from './CharacterSheetPanel.module.css';

interface Props {
  sheet: CharacterSheet;
  socket: AppSocket;
}

const STAT_LABELS: (keyof CharacterSheet['stats'])[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STAT_KR: Record<string, string> = {
  str: '근력', dex: '민첩', con: '건강', int: '지능', wis: '지혜', cha: '매력',
};

export default function CharacterSheetPanel({ sheet, socket }: Props) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(sheet);

  useEffect(() => { setLocal(sheet); }, [sheet]);

  const emit = useCallback((patch: Parameters<typeof socket.emit>[1]) => {
    socket.emit('char:update', patch as never);
  }, [socket]);

  function setField<K extends keyof CharacterSheet>(key: K, value: CharacterSheet[K]) {
    const next = { ...local, [key]: value };
    setLocal(next);
    emit({ [key]: value });
  }

  function setStat(key: keyof CharacterSheet['stats'], value: number) {
    const next = { ...local, stats: { ...local.stats, [key]: value } };
    setLocal(next);
    emit({ stats: next.stats });
  }

  function setHp(field: 'current' | 'max', value: number) {
    const next = { ...local, hp: { ...local.hp, [field]: value } };
    setLocal(next);
    emit({ hp: next.hp });
  }

  function adjustHp(delta: number) {
    const next = Math.max(0, Math.min(local.hp.max, local.hp.current + delta));
    setHp('current', next);
  }

  const hpPct = local.hp.max > 0 ? (local.hp.current / local.hp.max) * 100 : 0;
  const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 30 ? '#ff9800' : '#e94560';

  return (
    <div className={styles.panel}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>🧙 캐릭터 시트</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.body}>
          {/* 기본 정보 */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span>이름</span>
              <input value={local.charName} onChange={e => setField('charName', e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.narrow}`}>
              <span>레벨</span>
              <input type="number" min={1} max={99} value={local.level}
                onChange={e => setField('level', +e.target.value)} />
            </label>
          </div>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>종족</span>
              <input value={local.race} onChange={e => setField('race', e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>직업</span>
              <input value={local.charClass} onChange={e => setField('charClass', e.target.value)} />
            </label>
          </div>

          {/* HP */}
          <div className={styles.hpSection}>
            <div className={styles.hpLabel}>
              <span>HP</span>
              <span style={{ color: hpColor }}>{local.hp.current} / {local.hp.max}</span>
            </div>
            <div className={styles.hpBar}>
              <div className={styles.hpFill} style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
            <div className={styles.hpControls}>
              <button onClick={() => adjustHp(-1)}>－</button>
              <input type="number" value={local.hp.current} min={0} max={local.hp.max}
                onChange={e => setHp('current', +e.target.value)} />
              <span className={styles.slash}>/</span>
              <input type="number" value={local.hp.max} min={1}
                onChange={e => setHp('max', +e.target.value)} />
              <button onClick={() => adjustHp(1)}>＋</button>
            </div>
          </div>

          {/* AC */}
          <label className={`${styles.field} ${styles.narrow}`}>
            <span>AC</span>
            <input type="number" value={local.ac} min={0}
              onChange={e => setField('ac', +e.target.value)} />
          </label>

          {/* 능력치 */}
          <div className={styles.statsGrid}>
            {STAT_LABELS.map(s => (
              <label key={s} className={styles.stat}>
                <span>{STAT_KR[s]}</span>
                <input type="number" value={local.stats[s]} min={1} max={30}
                  onChange={e => setStat(s, +e.target.value)} />
                <span className={styles.mod}>
                  {Math.floor((local.stats[s] - 10) / 2) >= 0 ? '+' : ''}
                  {Math.floor((local.stats[s] - 10) / 2)}
                </span>
              </label>
            ))}
          </div>

          {/* 메모 */}
          <label className={styles.field}>
            <span>메모</span>
            <textarea rows={3} value={local.notes}
              onChange={e => setField('notes', e.target.value)} />
          </label>
        </div>
      )}
    </div>
  );
}
