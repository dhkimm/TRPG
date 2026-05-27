import { useEffect, useState } from 'react';
import { getSocket } from '../socket';
import type { GameSession } from '../App';
import type { ChatMessage, DiceRollResult, Player, CharacterSheet, MapState, MapToken, CombatState } from '@trpg/shared';
import { defaultCombat } from '@trpg/shared';
import DicePanel from '../components/DicePanel';
import ChatPanel from '../components/ChatPanel';
import PlayerList from '../components/PlayerList';
import CharacterSheetPanel from '../components/CharacterSheetPanel';
import MapPanel from '../components/MapPanel';
import InitiativeTracker from '../components/InitiativeTracker';
import styles from './GamePage.module.css';

interface Props {
  session: GameSession;
  onLeave: () => void;
}

const EMPTY_MAP: MapState = { cols: 20, rows: 15, tokens: [], fogEnabled: false, revealedCells: [] };
type SideTab = 'table' | 'character' | 'dice';

export default function GamePage({ session, onLeave }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>(session.room.players);
  const [sheets, setSheets] = useState<Map<string, CharacterSheet>>(new Map());
  const [mapState, setMapState] = useState<MapState>(EMPTY_MAP);
  const [combat, setCombat] = useState<CombatState>(defaultCombat());
  const [copied, setCopied] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>('table');
  const socket = getSocket();

  useEffect(() => {
    socket.on('chat:message', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('dice:result', (result: DiceRollResult) => {
      const mod = result.modifier !== 0 ? ` ${result.modifier > 0 ? '+' : ''}${result.modifier}` : '';
      setMessages(prev => [...prev, {
        id: result.id, playerName: result.playerName,
        text: `🎲 ${result.dice}×${result.count} → [${result.rolls.join(', ')}]${mod} = ${result.total}`,
        type: 'dice', timestamp: result.timestamp,
      }]);
    });

    socket.on('room:playerJoined', (p) => setPlayers(prev => [...prev, p]));
    socket.on('room:playerLeft', (id) => {
      setPlayers(prev => prev.filter(p => p.id !== id));
      setSheets(prev => { const m = new Map(prev); m.delete(id); return m; });
    });

    socket.on('char:list', (list) => setSheets(new Map(list.map(s => [s.playerId, s]))));
    socket.on('char:updated', (sheet) => setSheets(prev => new Map(prev).set(sheet.playerId, sheet)));

    socket.on('map:state', (state) => setMapState(state));
    socket.on('map:tokenAdded', (token: MapToken) =>
      setMapState(prev => ({ ...prev, tokens: [...prev.tokens.filter(t => t.id !== token.id), token] }))
    );
    socket.on('map:tokenMoved', (tokenId, x, y) =>
      setMapState(prev => ({ ...prev, tokens: prev.tokens.map(t => t.id === tokenId ? { ...t, x, y } : t) }))
    );
    socket.on('map:tokenRemoved', (tokenId) =>
      setMapState(prev => ({ ...prev, tokens: prev.tokens.filter(t => t.id !== tokenId) }))
    );
    socket.on('map:updated', (patch) =>
      setMapState(prev => ({ ...prev, ...patch }))
    );

    socket.on('combat:state', (state) => setCombat(state));

    return () => {
      socket.off('chat:message'); socket.off('dice:result');
      socket.off('room:playerJoined'); socket.off('room:playerLeft');
      socket.off('char:list'); socket.off('char:updated');
      socket.off('map:state'); socket.off('map:tokenAdded');
      socket.off('map:tokenMoved'); socket.off('map:tokenRemoved'); socket.off('map:updated');
      socket.off('combat:state');
    };
  }, [socket]);

  function leave() { socket.disconnect(); onLeave(); }

  function copyInvite() {
    navigator.clipboard.writeText(`${location.origin}?room=${session.room.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const mySheet = sheets.get(session.me.id);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.roomName}>⚔ {session.room.name}</span>
        <button className={styles.inviteBtn} onClick={copyInvite}>{copied ? '✓ 복사됨' : '🔗 초대 링크'}</button>
        <span className={styles.myName}>{session.me.isGM ? '👑 ' : ''}{session.me.name}</span>
        <button className={styles.leaveBtn} onClick={leave}>퇴장</button>
      </header>

      <div className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTabs}>
            <button
              className={`${styles.tabBtn} ${sideTab === 'table' ? styles.tabActive : ''}`}
              onClick={() => setSideTab('table')}
            >테이블</button>
            <button
              className={`${styles.tabBtn} ${sideTab === 'character' ? styles.tabActive : ''}`}
              onClick={() => setSideTab('character')}
            >캐릭터</button>
            <button
              className={`${styles.tabBtn} ${sideTab === 'dice' ? styles.tabActive : ''}`}
              onClick={() => setSideTab('dice')}
            >주사위</button>
          </div>

          <div className={styles.sidebarContent}>
            {sideTab === 'table' && (
              <>
                <PlayerList players={players} myId={session.me.id} sheets={sheets} />
                <InitiativeTracker combat={combat} isGM={session.me.isGM} socket={socket} />
              </>
            )}
            {sideTab === 'character' && (
              mySheet
                ? <CharacterSheetPanel sheet={mySheet} socket={socket} />
                : <div style={{ padding: '20px 16px', color: 'var(--text-faint)', fontSize: '0.85rem' }}>캐릭터 시트 없음</div>
            )}
            {sideTab === 'dice' && (
              <DicePanel socket={socket} />
            )}
          </div>
        </aside>

        <MapPanel map={mapState} myId={session.me.id} isGM={session.me.isGM} socket={socket} />

        <aside className={styles.chatPanel}>
          <ChatPanel messages={messages} socket={socket} />
        </aside>
      </div>
    </div>
  );
}
