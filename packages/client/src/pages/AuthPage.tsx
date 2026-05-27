import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!username.trim() || !password) { setError('아이디와 비밀번호를 입력하세요.'); return; }
    setError('');
    setLoading(true);

    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    const data = await res.json() as { token?: string; username?: string; error?: string };
    setLoading(false);

    if (!res.ok) { setError(data.error ?? '오류가 발생했습니다.'); return; }
    login(data.token!, data.username!);
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>TRPG 온라인</h1>
      <p className={styles.subtitle}>온라인 판타지 롤플레이</p>

      <div className={styles.card}>
        <div className={styles.tabs}>
          <button
            className={mode === 'login' ? styles.tabActive : styles.tab}
            onClick={() => { setMode('login'); setError(''); }}
          >로그인</button>
          <button
            className={mode === 'register' ? styles.tabActive : styles.tab}
            onClick={() => { setMode('register'); setError(''); }}
          >회원가입</button>
        </div>

        <input
          placeholder="아이디"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submitBtn} onClick={submit} disabled={loading}>
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
        </button>
      </div>
    </div>
  );
}
