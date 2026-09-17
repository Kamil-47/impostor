import { useI18n } from '../contexts/I18nContext';
import type { PlayerHand, Room } from '@impostor/shared';

interface Props {
  hand: PlayerHand | null;
  room: Room;
  myPlayerId: string;
}

export default function RoundView({ hand, room, myPlayerId }: Props) {
  const { t, language } = useI18n();

  if (!hand) {
    return (
      <div className="round-page">
        <p className="text-muted">{t('round.waiting')}</p>
      </div>
    );
  }

  const round = room.round;
  const n = round ? round.turnOrder.length : 0;
  const totalTurns = n * (round?.totalRounds ?? 0);
  const currentTurnIndex = round?.clues.length ?? 0;
  const currentSubRound = round && n > 0
    ? Math.min(Math.floor(currentTurnIndex / n), round.totalRounds - 1)
    : 0;

  return (
    <div className="round-page">
      {round && (
        <div className="round-badge">
          <span className="badge">
            {t('play.round', {
              current: currentSubRound + 1,
              total: round.totalRounds,
            })}
          </span>
        </div>
      )}

      {hand.role === 'player' ? (
        <div className="word-card">
          <p className="word-card__role">
            {t('round.yourRole')} {t('role.player')}
          </p>
          <p className="word-card__word">{hand.word}</p>
        </div>
      ) : (
        <div className="word-card word-card--impostor">
          {room.settings.hintsEnabled && (
            <p className="word-card__role word-card__role--impostor">
              {t('round.yourRole')} {t('role.impostor')}
            </p>
          )}
          <p className="word-card__word">{hand.hint?.[language] ?? t('role.impostor').toUpperCase()}</p>
        </div>
      )}

      <p className="round-hint">
        {hand.role === 'player'
          ? t('round.discussHint')
          : hand.hint
            ? t('round.impostorHint')
            : t('round.impostorNoHint')}
      </p>

      {round && (
        <div className="clue-queue">
          <div className="clue-queue__header">
            <span className="section-label">{t('play.cluesThisRound')}</span>
            <div className="clue-queue__badges">
              <span className="badge">
                {t('voting.impostorBadge', {
                  count: room.settings.impostorCount,
                })}
              </span>
              <span className="badge">
                {t('voting.roundBadge', { number: currentSubRound + 1 })}
              </span>
            </div>
          </div>

          <div className="player-cards">
            {round.turnOrder.map((playerId, i) => {
              const player = room.players.find((p) => p.id === playerId);
              if (!player) return null;
              const playerIndex = room.players.indexOf(player);
              const clueIndex = currentSubRound * n + i;
              const clue =
                clueIndex < round.clues.length
                  ? round.clues[clueIndex]
                  : null;
              const isCurrent =
                clueIndex === currentTurnIndex && currentTurnIndex < totalTurns;
              const isWaiting = clueIndex > currentTurnIndex;

              const earlierClues: string[] = [];
              for (let s = 0; s < currentSubRound; s++) {
                const idx = s * n + i;
                if (idx < round.clues.length) {
                  earlierClues.push(round.clues[idx].text);
                }
              }

              return (
                <div key={playerId} className="player-card-wrapper">
                  <div
                    className={`player-card${isCurrent ? ' player-card--current' : ''}`}
                  >
                    <div className={`avatar avatar--${playerIndex % 8}`}>
                      {player.nickname[0].toUpperCase()}
                    </div>
                    <div className="player-card__info">
                      <div className="player-card__name-row">
                        <span className="player-card__name">
                          {player.nickname}
                        </span>
                        {player.isHost && (
                          <span className="tag tag--dark">
                            {t('player.host')}
                          </span>
                        )}
                        {player.id === myPlayerId && (
                          <span className="tag tag--outline">
                            {t('player.you')}
                          </span>
                        )}
                      </div>
                      {clue && (
                        <div className="player-card__clue">{clue.text}</div>
                      )}
                      {isCurrent && (
                        <div className="player-card__thinking">
                          &bull; &bull; &bull;
                        </div>
                      )}
                      {isWaiting && (
                        <div className="player-card__waiting">
                          {t('play.upNext')}
                        </div>
                      )}
                    </div>
                    {clue && (
                      <span className="player-card__check">&#x2713;</span>
                    )}
                  </div>
                  {earlierClues.length > 0 && (
                    <div className="player-card__earlier">
                      <strong>{t('voting.earlier')}</strong>{' '}
                      <span className="player-card__earlier-value">
                        {earlierClues.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
