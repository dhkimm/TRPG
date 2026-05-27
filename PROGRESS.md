# TRPG 온라인 플랫폼 개발 진행 로그

## 프로젝트 개요
웹 기반 온라인 TRPG 플랫폼. 여러 플레이어가 실시간으로 참여하고, GM이 세션을 운영할 수 있는 시스템.

---

## 기술 스택 결정

| 영역 | 선택 | 이유 |
|------|------|------|
| Frontend | React + TypeScript | 컴포넌트 재사용, 타입 안전성 |
| Backend | Node.js + Express | JS 풀스택, 빠른 프로토타이핑 |
| 실시간 통신 | Socket.io | WebSocket 추상화, room 관리 내장 |
| DB | PostgreSQL | 캐릭터/캠페인 구조화 데이터 |
| 캐시/세션 | Redis | 실시간 게임 상태 관리 |
| 패키지 관리 | pnpm | 속도, workspace 지원 |

---

## 전체 아키텍처

```
[Browser: React SPA]
       ↕ HTTP (REST)   ↕ WebSocket (Socket.io)
[Node.js + Express Server]
       ↕                    ↕
[PostgreSQL]            [Redis]
(영구 데이터)           (실시간 상태)
```

---

## 단계별 개발 계획

### Phase 1 — 기반 구조 ✅ 완료
- [x] 프로젝트 디렉토리 구성
- [x] pnpm workspace 설정 (monorepo: client / server / shared)
- [x] TypeScript 설정 (tsconfig.base.json + 패키지별 설정)
- [x] 기본 Express 서버 기동 (포트 3001, /health /rooms REST API)
- [x] 기본 React 앱 구성 (Vite, 포트 3000)
- [x] Socket.io 연결 구조 (이벤트 타입 공유 패키지로 분리)
- [x] 주사위 굴리기 패널 (d4~d100, 개수/수정치)
- [x] 실시간 채팅 패널
- [x] 참여자 목록 (GM 표시)
- [x] 로비 (방 입장 / 방 생성)

### Phase 2 — 인증 & 방 시스템 ✅ 완료
- [x] 유저 회원가입 / 로그인 (JWT, 7일 유효, localStorage 저장)
- [x] 게임 방(Room) 생성 / 참여 / 퇴장
- [x] GM / Player 역할 구분 (첫 입장자 = GM, 👑 표시)
- [x] 방 목록 (5초마다 자동 갱신, 클릭으로 바로 입장)
- [x] 초대 링크 (?room=ID URL 파라미터, 클립보드 복사 버튼)

### Phase 3 — 핵심 게임 기능 ✅ 완료
- [x] 주사위 굴리기 시스템 (d4~d100, Phase 1에서 완료)
- [x] 실시간 채팅 — 귓속말 (/w 이름 메시지), GM 공지 (/gm 메시지, GM 전용)
- [x] 캐릭터 시트 (이름/종족/직업/레벨/AC/능력치 6종/메모, 접기/펼치기 패널)
- [x] HP 트래커 (현재HP/최대HP, 바 시각화, 플레이어 목록에 실시간 표시)

### Phase 4 — GM 도구 ✅ 완료
- [x] 그리드 맵 (20×15, CSS 격자 배경)
- [x] 토큰 배치 (GM 툴바 → 배치 모드 → 맵 클릭으로 NPC/적/플레이어 토큰 배치)
- [x] 토큰 이동 (드래그 앤 드롭, GM은 전체, 플레이어는 자기 토큰만)
- [x] 토큰 삭제 (GM이 토큰 클릭 → 선택 → 삭제 버튼)
- [x] 입장 시 플레이어 토큰 자동 생성 (캐릭터 이름 변경 시 토큰 라벨 자동 동기화)
- [x] 3-패널 레이아웃 (사이드바 | 맵 | 채팅)
- [ ] 안개 of War — Phase 5로 이동
- [ ] NPC 관리 패널 — Phase 5로 이동

### Phase 5 — 고급 기능 ✅ 완료
- [x] 이니셔티브 트래커 (전투 시작/종료, 턴 순서, 라운드 카운터, 🎲 전체 이니셔티브 굴리기)
- [x] 맵 배경 이미지 업로드 (GM이 이미지 파일 업로드 → 맵 배경 적용, 전체 동기화)
- [x] 안개 of War (GM이 셀 단위로 공개/숨김 페인트, 플레이어는 공개 셀만 보임)
- [x] 세션 로그 다운로드 (채팅창 ⬇ 로그 버튼 → .txt 파일 저장)
- [ ] 커스텀 룰셋 지원 — UI 개선 단계로 이동
- [ ] 모바일 대응 — UI 개선 단계로 이동

---

## 진행 일지

### 2026-05-27
- 프로젝트 시작, 기술 스택 결정
- pnpm monorepo 초기화 (packages/client, server, shared)
- shared: Socket.io 이벤트 타입 정의 (DiceRoll, ChatMessage, Player, Room)
- server: Express + Socket.io 서버 (방 생성/입장, 채팅, 주사위 굴리기)
- client: React + Vite + CSS Modules (로비, 게임 화면, 채팅/주사위/참여자 컴포넌트)
- pnpm install 완료, 서버 기동 확인 (http://localhost:3001/health)
- **Phase 1 완료** ✅
- **다음 작업**: Phase 2 — 유저 인증(JWT), 방 목록 UI, 초대 링크

### 2026-05-27 (Phase 2)
- server: bcryptjs + jsonwebtoken 추가, store.ts / routes/auth.ts / middleware/authSocket.ts 분리
- server: Socket.io에 JWT 인증 미들웨어 적용 (소켓 연결 시 토큰 검증)
- shared: RoomSummary, TokenPayload 타입 추가, room:join 이벤트에서 이름 제거 (JWT username 사용)
- client: AuthContext (login/logout/localStorage), AuthPage (로그인/회원가입 탭)
- client: LobbyPage 리뉴얼 (방 목록 5초 갱신, URL ?room= 파라미터 자동 입력)
- client: GamePage에 초대 링크 복사 버튼 추가
- **Phase 2 완료** ✅
- **다음 작업**: Phase 3 — 캐릭터 시트, HP 트래커, 귓속말/GM 공지 채팅

### 2026-05-27 (Phase 3)
- shared: CharacterSheet 타입, defaultSheet() 헬퍼, char:list/char:updated 이벤트 추가
- server: characterSheets Map(roomId→playerId→sheet) 추가, char:update 핸들러, 귓속말/GM공지 라우팅
- client: CharacterSheetPanel (접기/펼치기, HP±버튼, 능력치 수정치 자동계산)
- client: PlayerList에 HP 바 + 직업/종족/레벨 정보 표시
- client: ChatPanel에 /w, /gm 명령어 파싱 추가
- **Phase 3 완료** ✅
- **다음 작업**: Phase 4 — 그리드 맵 에디터, 토큰 배치/이동

### 2026-05-27 (Phase 4)
- shared: MapToken, MapState 타입, map:* 소켓 이벤트 추가
- server: mapStates Map, map:moveToken/addToken/removeToken 핸들러, 입장 시 플레이어 토큰 자동 생성
- client: MapPanel 컴포넌트 (60px 격자, 드래그 토큰, GM 배치 모드, 선택/삭제)
- client: GamePage 3-패널 레이아웃 (sidebar 240px | map flex:1 | chat 300px)
- **Phase 4 완료** ✅
- **다음 작업**: Phase 5 — 이미지 업로드, 세션 로그, 안개 of War

### 2026-05-27 (Phase 5)
- shared: MapState에 backgroundUrl/fogEnabled/revealedCells 추가, CombatEntry/CombatState 타입, map:update/combat:set 이벤트
- server: multer 파일 업로드 (POST /api/upload/map-bg, /uploads/ 정적 서빙), combat:set 핸들러, map:update 핸들러
- client: InitiativeTracker (전투 시작/턴/라운드, GM 전용 편집, 이니셔티브 정렬)
- client: MapPanel 배경 이미지 업로드, 안개 of War (셀 페인트, GM 반투명/플레이어 완전 불투명)
- client: ChatPanel 세션 로그 다운로드 버튼
- **Phase 5 완료** ✅
- **다음 작업**: UI 개선 (룰셋 선택, 모바일 대응, 전체 디자인 정리)

### 2026-05-27 (UI 개선)
- index.css: 다크 판타지 디자인 토큰 시스템 (CSS 변수: bg/border/text/gold/crimson/hp/dice/whisper)
- Google Fonts 적용: Cinzel (판타지 헤딩) + Nanum Myeongjo (한국어 세리프 본문)
- GamePage: 사이드바 탭 3종 (테이블 = PlayerList+Initiative / 캐릭터 / 주사위) 추가
- 전체 컴포넌트 CSS 모듈 다크 판타지 테마 적용 (gold 강조, crimson 위험, 세리프 타이포)
  - ChatPanel, MapPanel, PlayerList, DicePanel, CharacterSheetPanel, InitiativeTracker
  - LobbyPage, AuthPage
- MapPanel: 골드 그리드 라인, 어두운 스톤 배경, 토큰 골드 선택 하이라이트
- AuthPage: 부제목 추가, Cinzel 폰트 타이틀
- css-modules.d.ts: CSS 모듈 타입 선언 파일 추가
- **UI 개선 완료** ✅

### 2026-05-27 (JSON 영속성)
- server: persistence.ts 추가 (saveAll / loadAll / scheduleSave)
  - data/users.json — 유저 계정 (비밀번호 해시 포함)
  - data/gamestate.json — 방 목록 / 캐릭터 시트 / 맵 상태 / 이니셔티브
- 캐릭터 시트 키 변환: 런타임은 socket.id, 파일은 username → 재접속 시 복원
- 재접속 시 플레이어 토큰 ownerId 갱신 (이름 매칭으로 기존 토큰 재사용)
- 상태 변경 시 3초 디바운스 자동 저장 (char:update, map:*, combat:set, 방 생성/입장)
- char:update 시 savedChars 인메모리 맵 즉시 갱신 (disconnect 전 파일 미기록 방지)
- 서버 시작 시 loadAll() 자동 호출
- **JSON 영속성 완료** ✅

---

## 참고 사항
- 룰셋은 초기에 "시스템 중립" (범용 TRPG)으로 시작, 이후 D&D 5e 등 확장
- 한국어 UI 우선
