import { useState, useEffect } from 'react';
import { getSocket, resetSocket } from '../socket';
import { useAuth } from '../context/AuthContext';
import type { GameSession } from '../App';
import type { Room, Player, RoomSummary } from '@trpg/shared';
import styles from './LobbyPage.module.css';

interface Props {
  onJoined: (session: GameSession) => void;
}

export default function LobbyPage({ onJoined }: Props) {
  const { auth, logout } = useAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomId, setRoomId] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 5000);
    return () => clearInterval(id);
  }, []);

  async function fetchRooms() {
    const res = await fetch('/api/rooms');
    if (res.ok) setRooms(await res.json() as RoomSummary[]);
  }

  function join(targetRoomId = roomId) {
    if (!targetRoomId.trim()) { setError('방 ID를 선택하거나 입력하세요.'); return; }
    setError('');
    setLoading(true);

    resetSocket();
    const socket = getSocket(auth!.token);
    socket.connect();

    socket.once('room:joined', (room: Room, me: Player) => {
      setLoading(false);
      onJoined({ room, me });
    });

    socket.once('error', (msg: string) => {
      setLoading(false);
      setError(msg);
      resetSocket();
    });

    socket.once('connect_error', (err) => {
      setLoading(false);
      if (err.message.includes('인증') || err.message.includes('토큰')) {
        logout(); // 토큰 만료/무효 → 자동 로그아웃
      } else {
        setError('서버 연결에 실패했습니다: ' + err.message);
      }
      resetSocket();
    });

    socket.emit('room:join', targetRoomId.trim());
  }

  async function createRoom() {
    if (!newRoomName.trim()) { setError('방 이름을 입력하세요.'); return; }
    setError('');
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoomName }),
    });
    if (!res.ok) { setError('방 생성에 실패했습니다.'); return; }
    const data = await res.json() as { id: string; name: string };
    setNewRoomName('');
    await fetchRooms();
    setRoomId(data.id);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.logo}>⚔️ TRPG 온라인</span>
        <span className={styles.username}>👤 {auth?.username}</span>
        <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>
      </header>

      <div className={styles.content}>
        <section className={styles.card}>
          <h2>방 목록</h2>
          {rooms.length === 0
            ? <p className={styles.empty}>방이 없습니다.</p>
            : <ul className={styles.roomList}>
                {rooms.map(r => (
                  <li key={r.id} className={styles.roomItem} onClick={() => join(r.id)}>
                    <span className={styles.roomName}>{r.name}</span>
                    <span className={styles.roomMeta}>ID: {r.id} · {r.playerCount}명</span>
                    <button className={styles.joinBtn}>입장</button>
                  </li>
                ))}
              </ul>
          }
        </section>

        <div className={styles.side}>
          <section className={styles.card}>
            <h2>직접 입장</h2>
            <input
              placeholder="방 ID 입력"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && join()}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btnPrimary} onClick={() => join()} disabled={loading}>
              {loading ? '접속 중...' : '입장'}
            </button>
          </section>

          <section className={styles.card}>
            <h2>새 방 만들기</h2>
            <input
              placeholder="방 이름"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
            />
            <button className={styles.btnSecondary} onClick={createRoom}>방 생성</button>
          </section>
        </div>
      </div>
    </div>
  );
}
