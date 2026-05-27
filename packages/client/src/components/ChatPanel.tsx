import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@trpg/shared';
import type { AppSocket } from '../socket';
import styles from './ChatPanel.module.css';

interface Props {
  messages: ChatMessage[];
  socket: AppSocket;
}

export default function ChatPanel({ messages, socket }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  function downloadLog() {
    const lines = messages.map(m => {
      const time = new Date(m.timestamp).toLocaleTimeString('ko-KR');
      if (m.type === 'whisper') return `[${time}] [귓속말 → ${m.whisperTo}] ${m.playerName}: ${m.text}`;
      if (m.type === 'gm') return `[${time}] [공지] ${m.playerName}: ${m.text}`;
      if (m.type === 'dice') return `[${time}] ${m.playerName}: ${m.text}`;
      return `[${time}] ${m.playerName}: ${m.text}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');

    // /w 대상 메시지 → 귓속말
    const whisperMatch = text.match(/^\/w\s+(\S+)\s+(.+)$/);
    if (whisperMatch) {
      socket.emit('chat:send', whisperMatch[2], 'whisper', whisperMatch[1]);
      return;
    }

    // /gm 메시지 → GM 공지
    const gmMatch = text.match(/^\/gm\s+(.+)$/);
    if (gmMatch) {
      socket.emit('chat:send', gmMatch[1], 'gm');
      return;
    }

    socket.emit('chat:send', text);
  }

  function msgClass(msg: ChatMessage) {
    if (msg.type === 'whisper') return styles.whisper;
    if (msg.type === 'gm') return styles.gm;
    if (msg.type === 'dice') return styles.dice;
    return '';
  }

  function msgPrefix(msg: ChatMessage) {
    if (msg.type === 'whisper') return `[귓속말 → ${msg.whisperTo ?? '?'}] `;
    if (msg.type === 'gm' && msg.playerName !== 'System') return '[공지] ';
    return '';
  }

  return (
    <div className={styles.panel}>
      <div className={styles.chatHeader}>
        <span className={styles.chatTitle}>채팅</span>
        <button className={styles.downloadBtn} onClick={downloadLog} title="세션 로그 다운로드">⬇ 로그</button>
      </div>
      <div className={styles.log}>
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.msg} ${msgClass(msg)}`}>
            {msg.playerName !== 'System' && (
              <span className={styles.name}>{msg.playerName}</span>
            )}
            <span className={styles.text}>
              {msgPrefix(msg)}{msg.text}
            </span>
            <span className={styles.time}>
              {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.help}>
        <span>/w 이름 메시지 — 귓속말</span>
        <span>/gm 메시지 — GM 공지</span>
      </div>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="메시지 입력… (Enter 전송)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className={styles.sendBtn} onClick={send}>전송</button>
      </div>
    </div>
  );
}
