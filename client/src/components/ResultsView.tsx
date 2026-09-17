import { useSocket } from '../contexts/SocketContext';
import { useI18n } from '../contexts/I18nContext';
import type { Room, RoundResult } from '@impostor/shared';

interface Props {
  room: Room;
  myPlayerId: string;
  result: RoundResult;
}

export default function ResultsView({ room, myPlayerId, result }: Props) {
  const socket = useSocket();
  const { t } = useI18n();

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;

  function playerName(id: string): string {
    return room.players.find((p) => p.id === id)?.nickname ?? id;
  }

  function handleNextRound() {
    socket.emit('round:next');
  }

  return (
    <div className="results-page">
      <div
        className={`result-banner ${result.impostorWins ? 'result-banner--impostor' : 'result-banner--players'}`}
      >
        <h2 className="result-banner__title">
          {result.impostorWins
            ? t('results.impostorWins')
            : t('results.playersWin')}
        </h2>
      </div>

      <div className="results-section">
        <h3 className="results-section__title">{t('results.word')}</h3>
        <p className="results-word">{result.word}</p>
      </div>

      <div className="results-section">
        <h3 className="results-section__title">
          {result.impostorIds.length > 1
            ? t('results.impostors')
            : t('results.impostor')}
        </h3>
        {result.impostorIds.map((id) => {
          const playerIndex = room.players.findIndex((p) => p.id === id);
          return (
            <div key={id} className="results-impostor">
              <div className={`avatar avatar--${playerIndex % 8}`}>
                {playerName(id)[0].toUpperCase()}
              </div>
              <span>{playerName(id)}</span>
              {id === myPlayerId && (
                <span className="tag tag--outline">{t('player.you')}</span>
              )}
            </div>
          );
        })}
      </div>

      {result.impostorCaughtByClue && (
        <div className="results-section">
          <p className="results-caught-msg">{t('results.caughtByClue')}</p>
        </div>
      )}

      {result.impostorGuessedWord && (
        <div className="results-section">
          <p className="results-caught-msg">{t('results.guessedWord')}</p>
        </div>
      )}

      <div className="results-actions">
        {isHost ? (
          <button
            className="btn btn--primary btn--lg btn--block"
            type="button"
            onClick={handleNextRound}
          >
            {t('results.nextRound')}
          </button>
        ) : (
          <p className="text-muted">{t('results.waitingForHost')}</p>
        )}
      </div>
    </div>
  );
}
