import { useEffect, useRef, useState } from 'react';
import type { MapState, MapToken } from '@trpg/shared';
import type { AppSocket } from '../socket';
import styles from './MapPanel.module.css';

const CELL = 60;
const PRESET_COLORS = ['#4fc3f7', '#81c784', '#e94560', '#ffb74d', '#ce93d8', '#80cbc4', '#fff176'];

type Mode = 'move' | 'place' | 'fog-reveal' | 'fog-hide';

interface Props {
  map: MapState;
  myId: string;
  isGM: boolean;
  socket: AppSocket;
}

interface DragState {
  tokenId: string;
  currentX: number;
  currentY: number;
}

export default function MapPanel({ map, myId, isGM, socket }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mode, setMode] = useState<Mode>('move');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[2]);
  const [newType, setNewType] = useState<MapToken['type']>('npc');
  const [fogPainting, setFogPainting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 드래그 이벤트 (토큰 이동)
  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(map.cols - 1, Math.floor((e.clientX - rect.left) / CELL)));
      const y = Math.max(0, Math.min(map.rows - 1, Math.floor((e.clientY - rect.top) / CELL)));
      setDrag(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
    }
    function onUp() {
      if (drag) { socket.emit('map:moveToken', drag.tokenId, drag.currentX, drag.currentY); setDrag(null); }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, map.cols, map.rows, socket]);

  function canMove(token: MapToken) { return isGM || token.ownerId === myId; }

  function handleTokenMouseDown(e: React.MouseEvent, token: MapToken) {
    if (mode !== 'move' || !canMove(token)) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedId(token.id);
    setDrag({ tokenId: token.id, currentX: token.x, currentY: token.y });
  }

  function handleMapMouseDown(e: React.MouseEvent) {
    if (!isGM) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);

    if (mode === 'place') {
      const label = newLabel.trim() || (newType === 'enemy' ? '적' : newType === 'npc' ? 'NPC' : '토큰');
      socket.emit('map:addToken', { label, color: newColor, x, y, type: newType });
      setMode('move');
      return;
    }

    if (mode === 'fog-reveal' || mode === 'fog-hide') {
      setFogPainting(true);
      toggleFogCell(x, y, mode === 'fog-reveal');
    }
  }

  function handleMapMouseMove(e: React.MouseEvent) {
    if (!fogPainting || !isGM) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);
    toggleFogCell(x, y, mode === 'fog-reveal');
  }

  function handleMapMouseUp() { setFogPainting(false); }

  function toggleFogCell(x: number, y: number, reveal: boolean) {
    const key = `${x},${y}`;
    const current = new Set(map.revealedCells);
    if (reveal) current.add(key); else current.delete(key);
    socket.emit('map:update', { revealedCells: [...current] });
  }

  function isCellRevealed(x: number, y: number) {
    return !map.fogEnabled || map.revealedCells.includes(`${x},${y}`);
  }

  function toggleFog() {
    socket.emit('map:update', { fogEnabled: !map.fogEnabled });
  }

  function revealAll() {
    const all: string[] = [];
    for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) all.push(`${x},${y}`);
    socket.emit('map:update', { revealedCells: all });
  }

  function hideAll() {
    socket.emit('map:update', { revealedCells: [] });
  }

  async function uploadBackground(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    const res = await fetch('/api/upload/map-bg', { method: 'POST', body: form });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      socket.emit('map:update', { backgroundUrl: url });
    }
    setUploading(false);
  }

  function removeSelected() {
    if (!selectedId || !isGM) return;
    socket.emit('map:removeToken', selectedId);
    setSelectedId(null);
  }

  // 안개: GM은 안보이는 셀만 반투명하게, 플레이어는 완전 검정
  function fogOpacity(x: number, y: number) {
    if (!map.fogEnabled) return 0;
    if (isCellRevealed(x, y)) return 0;
    return isGM ? 0.55 : 1;
  }

  const fogCells: { x: number; y: number; opacity: number }[] = [];
  if (map.fogEnabled) {
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const op = fogOpacity(x, y);
        if (op > 0) fogCells.push({ x, y, opacity: op });
      }
    }
  }

  return (
    <div className={styles.wrapper}>
      {isGM && (
        <div className={styles.toolbar}>
          {/* 토큰 추가 */}
          <span className={styles.sep}>토큰</span>
          <input className={styles.labelInput} placeholder="이름" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <div className={styles.colorRow}>
            {PRESET_COLORS.map(c => (
              <button key={c} className={`${styles.colorBtn} ${c === newColor ? styles.colorActive : ''}`}
                style={{ background: c }} onClick={() => setNewColor(c)} />
            ))}
          </div>
          <select className={styles.typeSelect} value={newType} onChange={e => setNewType(e.target.value as MapToken['type'])}>
            <option value="npc">NPC</option>
            <option value="enemy">적</option>
            <option value="player">플레이어</option>
          </select>
          <button className={`${styles.toolBtn} ${mode === 'place' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode(m => m === 'place' ? 'move' : 'place')}>
            {mode === 'place' ? '📍 배치 중…' : '+ 배치'}
          </button>
          {selectedId && <button className={styles.deleteBtn} onClick={removeSelected}>🗑</button>}

          {/* 배경 이미지 */}
          <span className={styles.sep}>배경</span>
          <button className={styles.toolBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? '업로드 중…' : '🖼 이미지'}
          </button>
          {map.backgroundUrl && (
            <button className={styles.toolBtn} onClick={() => socket.emit('map:update', { backgroundUrl: undefined })}>✕ 제거</button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadBackground(f); e.target.value = ''; }} />

          {/* 안개 */}
          <span className={styles.sep}>안개</span>
          <button className={`${styles.toolBtn} ${map.fogEnabled ? styles.toolBtnActive : ''}`} onClick={toggleFog}>
            {map.fogEnabled ? '🌫 ON' : '🌫 OFF'}
          </button>
          {map.fogEnabled && (
            <>
              <button className={`${styles.toolBtn} ${mode === 'fog-reveal' ? styles.toolBtnActive : ''}`}
                onClick={() => setMode(m => m === 'fog-reveal' ? 'move' : 'fog-reveal')}>✏ 공개</button>
              <button className={`${styles.toolBtn} ${mode === 'fog-hide' ? styles.toolBtnActive : ''}`}
                onClick={() => setMode(m => m === 'fog-hide' ? 'move' : 'fog-hide')}>✏ 숨김</button>
              <button className={styles.toolBtn} onClick={revealAll}>전체 공개</button>
              <button className={styles.toolBtn} onClick={hideAll}>전체 숨김</button>
            </>
          )}
        </div>
      )}

      <div className={styles.mapOuter}>
        <div
          ref={containerRef}
          className={`${styles.map} ${mode !== 'move' ? styles.modeCursor : ''}`}
          style={{
            width: map.cols * CELL,
            height: map.rows * CELL,
            backgroundImage: map.backgroundUrl
              ? `url(http://localhost:3001${map.backgroundUrl})`
              : undefined,
          }}
          onMouseDown={handleMapMouseDown}
          onMouseMove={handleMapMouseMove}
          onMouseUp={handleMapMouseUp}
          onClick={() => mode === 'move' && setSelectedId(null)}
        >
          {/* 안개 오버레이 */}
          {fogCells.map(({ x, y, opacity }) => (
            <div key={`fog-${x}-${y}`} className={styles.fogCell}
              style={{ left: x * CELL, top: y * CELL, opacity }} />
          ))}

          {/* 토큰 */}
          {map.tokens.map(token => {
            if (!isGM && map.fogEnabled && !isCellRevealed(token.x, token.y)) return null;
            const isDragging = drag?.tokenId === token.id;
            const x = isDragging ? drag.currentX : token.x;
            const y = isDragging ? drag.currentY : token.y;

            return (
              <div key={token.id}
                className={`${styles.token} ${isDragging ? styles.tokenDragging : ''} ${selectedId === token.id ? styles.tokenSelected : ''}`}
                style={{
                  left: x * CELL + 4, top: y * CELL + 4,
                  background: token.color,
                  cursor: canMove(token) ? (drag ? 'grabbing' : 'grab') : 'default',
                  zIndex: isDragging ? 100 : 10,
                }}
                onMouseDown={e => handleTokenMouseDown(e, token)}
              >
                <span className={styles.tokenInitial}>{token.label.charAt(0).toUpperCase()}</span>
                <span className={styles.tokenLabel}>{token.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
