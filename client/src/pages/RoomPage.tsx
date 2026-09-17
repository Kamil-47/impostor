import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useRoom } from '../hooks/useRoom';
import LobbyView from '../components/LobbyView';
import RoundView from '../components/RoundView';
import VotingView from '../components/VotingView';
import ResultsView from '../components/ResultsView';
import ChatPanel from '../components/ChatPanel';

export default function RoomPage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { room, myPlayerId, hand, lastResult, joinError, kicked, abortMessage, clearAbortMessage } = useRoom(code);

  useEffect(() => {
    if (!abortMessage) return;
    const timer = setTimeout(clearAbortMessage, 5000);
    return () => clearTimeout(timer);
  }, [abortMessage, clearAbortMessage]);

  if (kicked) {
    return (
      <main className="page page-center">
        <div className="kicked-view">
          <h2 className="kicked-view__title">{t('kicked.title')}</h2>
          <p className="kicked-view__message">{t('kicked.message')}</p>
          <button
            className="btn btn--primary btn--lg"
            type="button"
            onClick={() => navigate('/')}
          >
            {t('nav.home')}
          </button>
        </div>
      </main>
    );
  }

  if (joinError) {
    return (
      <main className="page page-center">
        <p className="form-error" role="alert">
          {joinError}
        </p>
        <button
          className="btn btn--primary mt-md"
          type="button"
          onClick={() => navigate('/')}
        >
          {t('nav.home')}
        </button>
      </main>
    );
  }

  if (!room || !myPlayerId) {
    return (
      <main className="page page-center">
        <p className="text-muted">{t('room.connecting')}</p>
      </main>
    );
  }

  const showChat = room.status === 'playing' || room.status === 'voting';

  return (
    <>
      {abortMessage && (
        <div className="toast toast--warning" role="alert">
          {t('round.aborted', { name: abortMessage })}
        </div>
      )}
      <main className={`page${showChat ? ' page--with-chat' : ''}`}>
        {room.status === 'lobby' && (
          <LobbyView room={room} myPlayerId={myPlayerId} />
        )}
        {room.status === 'playing' && (
          <RoundView hand={hand} room={room} myPlayerId={myPlayerId} />
        )}
        {room.status === 'voting' && (
          <VotingView room={room} myPlayerId={myPlayerId} />
        )}
        {room.status === 'results' && lastResult && (
          <ResultsView
            room={room}
            myPlayerId={myPlayerId}
            result={lastResult}
          />
        )}
      </main>
      {showChat && <ChatPanel room={room} myPlayerId={myPlayerId} />}
    </>
  );
}
