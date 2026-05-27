import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomUUID } from 'crypto';
import path from 'path';
import multer from 'multer';
import authRouter from './routes/auth';
import { authSocketMiddleware } from './middleware/authSocket';
import { rooms, characterSheets, mapStates, combatStates } from './store';
import { loadAll, scheduleSave, savedChars } from './persistence';
import {
  defaultSheet,
  defaultCombat,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type Player,
  type ChatMessage,
  type DiceRollResult,
  type CharacterSheet,
  type MapToken,
  type CombatState,
} from '@trpg/shared';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);

// 업로드 파일 정적 서빙
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// multer 설정
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID().slice(0, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', rooms: rooms.size }));
app.get('/api/rooms', (_req, res) =>
  res.json([...rooms.values()].map(r => ({ id: r.id, name: r.name, playerCount: r.players.length })))
);
app.post('/api/rooms', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: '방 이름을 입력하세요.' }); return; }
  const id = randomUUID().slice(0, 8);
  rooms.set(id, { id, name: name.trim(), players: [] });
  scheduleSave();
  res.status(201).json({ id, name: name.trim() });
});

app.post('/api/upload/map-bg', upload.single('image'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: '이미지 파일이 필요합니다.' }); return; }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// uploads 디렉토리 생성
import { mkdirSync } from 'fs';
try { mkdirSync(uploadsDir, { recursive: true }); } catch {}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: '*' } });
io.use(authSocketMiddleware);

function rollDie(sides: number) { return Math.floor(Math.random() * sides) + 1; }
function diceSides(d: string) {
  return ({ d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 } as Record<string, number>)[d] ?? 6;
}

const PLAYER_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#ce93d8', '#80cbc4', '#fff176', '#f48fb1'];

io.on('connection', (socket) => {
  let currentRoomId: string | null = null;
  const username: string = socket.data.username;

  socket.on('room:join', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', `방 [${roomId}]을 찾을 수 없습니다.`); return; }

    if (currentRoomId) {
      const prev = rooms.get(currentRoomId);
      if (prev) prev.players = prev.players.filter(p => p.id !== socket.id);
    }

    const isGM = room.players.length === 0;
    const player: Player = { id: socket.id, name: username, isGM };
    room.players.push(player);
    currentRoomId = roomId;
    socket.join(roomId);

    // 캐릭터 시트 — 저장된 데이터가 있으면 복원, 없으면 기본값
    if (!characterSheets.has(roomId)) characterSheets.set(roomId, new Map());
    const roomSheets = characterSheets.get(roomId)!;
    const savedSheet = savedChars.get(roomId)?.get(username);
    if (savedSheet) {
      roomSheets.set(socket.id, { ...savedSheet, playerId: socket.id });
    } else {
      roomSheets.set(socket.id, defaultSheet(socket.id, username));
    }

    // 맵
    if (!mapStates.has(roomId)) {
      mapStates.set(roomId, { cols: 20, rows: 15, tokens: [], fogEnabled: false, revealedCells: [] });
    }
    const mapState = mapStates.get(roomId)!;

    // 기존 플레이어 토큰 찾기 (재접속: 이름이 같은 player 토큰의 ownerId를 새 소켓으로 갱신)
    const existingToken = mapState.tokens.find(t => t.type === 'player' && t.label === username);
    if (existingToken) {
      existingToken.ownerId = socket.id;
      io.to(roomId).emit('map:tokenAdded', existingToken);
    } else {
      const idx = room.players.length - 1;
      const token: MapToken = {
        id: randomUUID().slice(0, 8), label: username,
        color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
        x: idx % mapState.cols, y: 0, size: 1, type: 'player', ownerId: socket.id,
      };
      mapState.tokens.push(token);
      io.to(roomId).emit('map:tokenAdded', token);
    }

    // 이니셔티브
    if (!combatStates.has(roomId)) combatStates.set(roomId, defaultCombat());

    socket.emit('room:joined', room, player);
    socket.emit('char:list', [...roomSheets.values()]);
    socket.emit('map:state', mapState);
    socket.emit('combat:state', combatStates.get(roomId)!);
    socket.to(roomId).emit('room:playerJoined', player);
    socket.to(roomId).emit('char:updated', roomSheets.get(socket.id)!);

    scheduleSave();
    sysMsg(roomId, `${username}${isGM ? ' (GM)' : ''}님이 입장했습니다.`);
  });

  socket.on('chat:send', (text, type = 'normal', targetName) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const msg: ChatMessage = { id: randomUUID(), playerName: username, text, type, timestamp: Date.now() };

    if (type === 'whisper' && targetName) {
      msg.whisperTo = targetName;
      const target = room.players.find(p => p.name === targetName);
      socket.emit('chat:message', msg);
      if (target && target.id !== socket.id) io.to(target.id).emit('chat:message', msg);
    } else if (type === 'gm') {
      const me = room.players.find(p => p.id === socket.id);
      if (!me?.isGM) { socket.emit('error', 'GM만 공지를 보낼 수 있습니다.'); return; }
      io.to(currentRoomId).emit('chat:message', msg);
    } else {
      io.to(currentRoomId).emit('chat:message', msg);
    }
  });

  socket.on('dice:roll', (req) => {
    if (!currentRoomId) return;
    const sides = diceSides(req.dice);
    const rolls = Array.from({ length: req.count }, () => rollDie(sides));
    const modifier = req.modifier ?? 0;
    const result: DiceRollResult = {
      id: randomUUID(), playerName: username, dice: req.dice, count: req.count,
      rolls, modifier, total: rolls.reduce((a, b) => a + b, 0) + modifier, timestamp: Date.now(),
    };
    io.to(currentRoomId).emit('dice:result', result);
  });

  socket.on('char:update', (patch) => {
    if (!currentRoomId) return;
    const roomSheets = characterSheets.get(currentRoomId);
    if (!roomSheets) return;
    const existing = roomSheets.get(socket.id);
    if (!existing) return;
    const updated: CharacterSheet = {
      ...existing, ...patch,
      hp: patch.hp ? { ...existing.hp, ...patch.hp } : existing.hp,
      stats: patch.stats ? { ...existing.stats, ...patch.stats } : existing.stats,
      playerId: existing.playerId, playerName: existing.playerName,
    };
    roomSheets.set(socket.id, updated);
    io.to(currentRoomId).emit('char:updated', updated);

    // savedChars에 즉시 반영 (disconnect 전에 파일 쓰기가 안 돼도 보존됨)
    if (!savedChars.has(currentRoomId)) savedChars.set(currentRoomId, new Map());
    savedChars.get(currentRoomId)!.set(username, updated);
    scheduleSave();

    if (patch.charName) {
      const mapState = mapStates.get(currentRoomId);
      if (mapState) {
        const token = mapState.tokens.find(t => t.ownerId === socket.id && t.type === 'player');
        if (token) { token.label = patch.charName; io.to(currentRoomId).emit('map:tokenAdded', token); }
      }
    }
  });

  socket.on('map:moveToken', (tokenId, x, y) => {
    if (!currentRoomId) return;
    const mapState = mapStates.get(currentRoomId);
    if (!mapState) return;
    const token = mapState.tokens.find(t => t.id === tokenId);
    if (!token) return;
    const room = rooms.get(currentRoomId);
    const me = room?.players.find(p => p.id === socket.id);
    if (!me?.isGM && token.ownerId !== socket.id) return;
    token.x = Math.max(0, Math.min(mapState.cols - 1, x));
    token.y = Math.max(0, Math.min(mapState.rows - 1, y));
    io.to(currentRoomId).emit('map:tokenMoved', tokenId, token.x, token.y);
    scheduleSave();
  });

  socket.on('map:addToken', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    const me = room?.players.find(p => p.id === socket.id);
    if (!me?.isGM) return;
    const mapState = mapStates.get(currentRoomId);
    if (!mapState) return;
    const token: MapToken = { ...data, id: randomUUID().slice(0, 8), size: 1 };
    mapState.tokens.push(token);
    io.to(currentRoomId).emit('map:tokenAdded', token);
    scheduleSave();
  });

  socket.on('map:removeToken', (tokenId) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    const me = room?.players.find(p => p.id === socket.id);
    if (!me?.isGM) return;
    const mapState = mapStates.get(currentRoomId);
    if (!mapState) return;
    mapState.tokens = mapState.tokens.filter(t => t.id !== tokenId);
    io.to(currentRoomId).emit('map:tokenRemoved', tokenId);
    scheduleSave();
  });

  socket.on('map:update', (patch) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    const me = room?.players.find(p => p.id === socket.id);
    if (!me?.isGM) return;
    const mapState = mapStates.get(currentRoomId);
    if (!mapState) return;
    Object.assign(mapState, patch);
    io.to(currentRoomId).emit('map:updated', patch);
    scheduleSave();
  });

  socket.on('combat:set', (state: CombatState) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    const me = room?.players.find(p => p.id === socket.id);
    if (!me?.isGM) return;
    combatStates.set(currentRoomId, state);
    io.to(currentRoomId).emit('combat:state', state);
    scheduleSave();
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    characterSheets.get(currentRoomId)?.delete(socket.id);
    io.to(currentRoomId).emit('room:playerLeft', socket.id);
    sysMsg(currentRoomId, `${username}님이 퇴장했습니다.`);
  });

  function sysMsg(roomId: string, text: string) {
    io.to(roomId).emit('chat:message', {
      id: randomUUID(), playerName: 'System', text, type: 'gm', timestamp: Date.now(),
    });
  }
});

const PORT = process.env.PORT ?? 3001;
loadAll();
httpServer.listen(PORT, () => console.log(`TRPG 서버: http://localhost:${PORT}`));
