import type { Player, CharacterSheet } from '@trpg/shared';
import styles from './PlayerList.module.css';

interface Props {
  players: Player[];
  myId: string;
  sheets: Map<string, CharacterSheet>;
}

export default function PlayerList({ players, myId, sheets }: Props) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>참여자 ({players.length})</h3>
      <ul className={styles.list}>
        {players.map(p => {
          const sheet = sheets.get(p.id);
          const hpPct = sheet && sheet.hp.max > 0 ? (sheet.hp.current / sheet.hp.max) * 100 : 100;
          const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 30 ? '#ff9800' : '#e94560';

          return (
            <li key={p.id} className={p.id === myId ? styles.me : ''}>
              <div className={styles.nameRow}>
                <span>{p.isGM ? '👑 ' : '🧙 '}{p.name}{p.id === myId ? ' (나)' : ''}</span>
                {sheet && (
                  <span className={styles.hpText} style={{ color: hpColor }}>
                    {sheet.hp.current}/{sheet.hp.max}
                  </span>
                )}
              </div>
              {sheet && (
                <div className={styles.hpBar}>
                  <div
                    className={styles.hpFill}
                    style={{ width: `${hpPct}%`, background: hpColor }}
                  />
                </div>
              )}
              {sheet?.charClass && (
                <div className={styles.charInfo}>
                  {sheet.charClass}{sheet.race ? ` · ${sheet.race}` : ''} Lv.{sheet.level}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
