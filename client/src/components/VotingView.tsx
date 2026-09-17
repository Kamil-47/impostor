import { useSocket } from '../contexts/SocketContext';
import { useI18n } from '../contexts/I18nContext';
import type { Room } from '@impostor/shared';

interface Props {
  room: Room;
  myPlayerId: string;
}

export default function VotingView({ room, myPlayerId }: Props) {
  const socket = useSocket();
  const { t } = useI18n();

  const me = room.players.find((p) => p.id === myPlayerId);
  const hasVoted = me?.hasVoted ?? false;
  const round = room.round;

  const cluesByPlayer = new Map<string, string[]>();
  round?.clues.forEach((c) => {
    if (!cluesByPlayer.has(c.playerId)) cluesByPlayer.set(c.playerId, []);
    cluesByPlayer.get(c.playerId)!.push(c.text);
  });

  function handleVote(targetId: string) {
    socket.emit('vote:cast', targetId);
  }

  return (
    <div>
      <h1 className="voting-title">{t('voting.title')}</h1>

      <div className="voting-header">
        <span className="section-label">{t('voting.playersAndClues')}</span>
        <div className="voting-header__badges">
          <span className="badge">
            {t('voting.impostorBadge', {
              count: room.settings.impostorCount,
            })}
          </span>
        </div>
      </div>

      {hasVoted && <p className="voting-status">{t('voting.alreadyVoted')}</p>}

      <div className="player-cards">
        {(round?.turnOrder ?? room.players.map((p) => p.id)).map((playerId) => {
          const player = room.players.find((p) => p.id === playerId);
          if (!player) return null;
          const index = room.players.indexOf(player);
          const playerClues = cluesByPlayer.get(player.id) || [];

          return (
            <div key={player.id} className="player-card-wrapper animate-in">
              <div className="player-card">
                <div className={`avatar avatar--${index % 8}`}>
                  {player.nickname[0].toUpperCase()}
                </div>
                <div className="player-card__info">
                  <div className="player-card__name-row">
                    <span className="player-card__name">
                      {player.nickname}
                    </span>
                    {player.isHost && (
                      <span className="tag tag--dark">{t('player.host')}</span>
                    )}
                    {player.id === myPlayerId && (
                      <span className="tag tag--outline">
                        {t('player.you')}
                      </span>
                    )}
                  </div>
                  {playerClues.length > 0 && (
                    <div className="player-card__clue">
                      {playerClues.map((clue, i) => (
                        <span key={i}>
                          {i > 0 && <span className="clue-separator">|</span>}
                          {clue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {player.id !== myPlayerId && !hasVoted && (
                  <button
                    className="btn btn--primary btn--vote"
                    type="button"
                    onClick={() => handleVote(player.id)}
                  >
                    {t('voting.vote')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
