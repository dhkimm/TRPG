import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../routes/auth';
import type { Socket } from 'socket.io';

export function authSocketMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error('인증이 필요합니다.'));

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    socket.data.userId = payload.userId;
    socket.data.username = payload.username;
    next();
  } catch {
    next(new Error('유효하지 않은 토큰입니다.'));
  }
}
