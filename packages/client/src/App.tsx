import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import type { Player, Room } from '@trpg/shared';

export interface GameSession {
  room: Room;
  me: Player;
}

function Inner() {
  const { auth } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);

  if (!auth) return <AuthPage />;
  if (session) return <GamePage session={session} onLeave={() => setSession(null)} />;
  return <LobbyPage onJoined={setSession} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
