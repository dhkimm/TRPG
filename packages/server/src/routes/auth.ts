import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { users, usersByName, type UserRecord } from '../store';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'trpg-dev-secret';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
    return;
  }
  if (username.trim().length < 2) {
    res.status(400).json({ error: '아이디는 2자 이상이어야 합니다.' });
    return;
  }
  if (usersByName.has(username.trim().toLowerCase())) {
    res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: UserRecord = { id: randomUUID(), username: username.trim(), passwordHash };
  users.set(user.id, user);
  usersByName.set(user.username.toLowerCase(), user);

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, username: user.username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  const user = usersByName.get(username?.trim().toLowerCase() ?? '');
  if (!user || !(await bcrypt.compare(password ?? '', user.passwordHash))) {
    res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });
    return;
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

export default router;
