import { useState } from 'react';
import type { DiceType } from '@trpg/shared';
import type { AppSocket } from '../socket';
import styles from './DicePanel.module.css';

const DICE_LIST: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

interface Props {
  socket: AppSocket;
}

export default function DicePanel({ socket }: Props) {
  const [selected, setSelected] = useState<DiceType>('d20');
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);

  function roll() {
    socket.emit('dice:roll', { dice: selected, count, modifier });
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>주사위 굴리기</h3>

      <div className={styles.diceGrid}>
        {DICE_LIST.map(d => (
          <button
            key={d}
            className={`${styles.diceBtn} ${d === selected ? styles.active : ''}`}
            onClick={() => setSelected(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        <label>
          개수
          <input
            type="number" min={1} max={20} value={count}
            onChange={e => setCount(Math.max(1, Math.min(20, +e.target.value)))}
          />
        </label>
        <label>
          수정치
          <input
            type="number" min={-99} max={99} value={modifier}
            onChange={e => setModifier(+e.target.value)}
          />
        </label>
      </div>

      <button className={styles.rollBtn} onClick={roll}>
        🎲 굴리기
      </button>
    </div>
  );
}
