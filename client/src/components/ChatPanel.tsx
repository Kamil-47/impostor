import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useI18n } from '../contexts/I18nContext';
import type { Room, SocketError } from '@impostor/shared';

const ERROR_I18N_MAP: Record<string, string> = {
  NOT_YOUR_TURN: 'play.error.notYourTurn',
  NOT_PLAYING: 'play.error.notYourTurn',
  CLUE_EMPTY: 'play.error.empty',
  CLUE_TOO_LONG: 'play.error.tooLong',
  CLUE_DUPLICATE: 'play.error.duplicate',
  CLUE_INVALID_CHARS: 'play.error.invalidChars',
  CLUE_IS_WORD: 'play.error.isWord',
};

interface Props {
  room: Room;
  myPlayerId: string;
}

export default function ChatPanel({ room, myPlayerId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [clueError, setClueError] = useState<string | null>(null);
  const socket = useSocket();
  const { t } = useI18n();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const round = room.round;
  const clues = round?.clues ?? [];
  const playerCount = room.players.length;

  const totalTurns = round ? round.turnOrder.length * round.totalRounds : 0;
  const currentTurnIndex = round ? round.clues.length : 0;
  const isMyTurn =
    room.status === 'playing' &&
    round != null &&
    currentTurnIndex < totalTurns &&
    round.turnOrder[currentTurnIndex % round.turnOrder.length] === myPlayerId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [clues.length]);

  useEffect(() => {
    if (isOpen && isMyTurn) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, isMyTurn]);

  function submitClue() {
    const trimmed = text.trim();
    if (!trimmed) {
      setClueError(t('play.error.empty'));
      return;
    }
    socket.emit('clue:submit', trimmed, (err: SocketError | null) => {
      if (err) {
        const key = ERROR_I18N_MAP[err.code];
        setClueError(key ? t(key) : err.message);
      } else {
        setText('');
        setClueError(null);
        setIsOpen(false);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitClue();
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          className={`chat-trigger${isMyTurn ? ' chat-trigger--active' : ''}`}
          type="button"
          onClick={() => setIsOpen(true)}
        >
          <span className="chat-trigger__dot" />
          {t('chat.title')}
          <span className="badge badge--soft">
            {playerCount} {t('chat.players')}
          </span>
        </button>
      )}

      <div
        className={`chat-backdrop${isOpen ? ' chat-backdrop--visible' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      <div className={`chat-panel${isOpen ? ' chat-panel--open' : ''}`}>
        <div className="chat-panel__header" onClick={() => setIsOpen(false)}>
          <div className="chat-panel__title">
            <span className="chat-panel__dot" />
            {t('chat.title')}
          </div>
          <span className="badge badge--soft">
            {playerCount} {t('chat.players')}
          </span>
          <button
            className="chat-panel__collapse"
            type="button"
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div className="chat-panel__messages">
          {clues.map((clue, i) => {
            const isMe = clue.playerId === myPlayerId;
            const playerIndex = room.players.findIndex(
              (p) => p.id === clue.playerId,
            );
            return (
              <div
                key={i}
                className={isMe ? 'chat-msg chat-msg--mine' : 'chat-msg chat-msg--other'}
              >
                <div className={`avatar avatar--sm avatar--${playerIndex % 8}`}>
                  {clue.nickname[0].toUpperCase()}
                </div>
                <div className="chat-msg__content">
                  <span className="chat-msg__label">
                    {t('chat.clueLabel', { name: clue.nickname })}
                  </span>
                  <div className="chat-msg__bubble">{clue.text}</div>
                </div>
              </div>
            );
          })}

          {room.status === 'voting' && (
            <div className="chat-msg chat-msg--system">
              {t('chat.votingStarted')}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {room.status === 'playing' && (
          <div className="chat-panel__input">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={40}
              placeholder={
                isMyTurn ? t('chat.placeholder') : t('chat.waitingForTurn')
              }
              disabled={!isMyTurn}
              className="chat-panel__text-input"
            />
            <button
              className="chat-panel__send"
              onClick={submitClue}
              disabled={!isMyTurn}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        )}

        {clueError && (
          <span className="chat-panel__error" role="alert">
            {clueError}
          </span>
        )}
      </div>
    </>
  );
}
