import { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useI18n } from '../contexts/I18nContext';
import type { Room, RoomSettings, Category } from '@impostor/shared';
import CustomSelect from './CustomSelect';

const ALL_CATEGORIES: Category[] = ['agents', 'maps', 'weapons', 'ultimates'];

interface Props {
  room: Room;
  myPlayerId: string;
}

export default function LobbyView({ room, myPlayerId }: Props) {
  const socket = useSocket();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const nonHostAllReady = room.players
    .filter((p) => p.id !== room.hostId)
    .every((p) => p.isReady);
  const canStart =
    room.players.length >= room.settings.impostorCount + 2 && nonHostAllReady;

  const inviteLink = `${window.location.origin}/join/${room.code}`;

  function copyInviteLink() {
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  function toggleReady() {
    socket.emit('player:setReady', !(me?.isReady ?? false));
  }

  function handleKick(targetId: string) {
    socket.emit('player:kick', targetId);
  }

  function handleStart() {
    socket.emit('round:start');
  }

  function updateSetting(partial: Partial<RoomSettings>) {
    socket.emit('settings:update', partial);
  }

  function toggleCategory(cat: Category | 'random') {
    if (!isHost) return;
    const current = room.settings.categories;
    if (cat === 'random') {
      updateSetting({ categories: 'random' });
      return;
    }
    if (current === 'random') {
      updateSetting({ categories: [cat] });
      return;
    }
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updateSetting({ categories: next.length === 0 ? 'random' : next });
  }

  return (
    <div>
      <h2 className="title">{t('lobby.title')}</h2>

      <div className="lobby-code">
        <div>
          <span className="lobby-code__label">{t('lobby.roomCode')}</span>
          <span className="lobby-code__value">{room.code}</span>
        </div>
        <button
          className="btn btn--secondary"
          type="button"
          onClick={copyInviteLink}
        >
          {copied ? t('lobby.copied') : t('lobby.copyLink')}
        </button>
      </div>

      <div className="lobby-section">
        <div className="lobby-section__header lobby-section__header--spread">
          <span className="section-label">{t('lobby.playersLabel')}</span>
          <span className="section-counter">
            {room.players.length} / {room.settings.impostorCount + 2}
          </span>
        </div>

        <div className="player-list">
          {room.players.map((player, index) => (
            <div key={player.id} className="player-item">
              <div className={`avatar avatar--${index % 8}`}>
                {player.nickname[0].toUpperCase()}
              </div>
              <div className="player-item__info">
                <div className="player-item__name">
                  {player.nickname}
                  {player.isHost && (
                    <span className="tag tag--dark">{t('player.host')}</span>
                  )}
                  {player.id === myPlayerId && (
                    <span className="tag tag--outline">{t('player.you')}</span>
                  )}
                </div>
                {!player.isHost && (
                  <span
                    className={`player-item__status${player.isReady ? ' player-item__status--ready' : ''}`}
                  >
                    {player.isReady ? t('player.ready') : t('player.notReady')}
                  </span>
                )}
              </div>
              {isHost && player.id !== myPlayerId && (
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  onClick={() => handleKick(player.id)}
                >
                  {t('lobby.kick')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="lobby-section">
        <div className="lobby-section__header">
          <span className="section-label">{t('lobby.settings')}</span>
        </div>

        <div className="lobby-settings">
          <div className="lobby-settings__row">
            <label>{t('create.impostorCount')}</label>
            <CustomSelect
              className="custom-select--sm"
              value={String(room.settings.impostorCount)}
              onChange={(v) =>
                updateSetting({ impostorCount: Number(v) })
              }
              disabled={!isHost}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
              ]}
            />
          </div>

          <div className="lobby-settings__row">
            <label>{t('create.roundsCount')}</label>
            <CustomSelect
              className="custom-select--sm"
              value={String(room.settings.roundsCount)}
              onChange={(v) =>
                updateSetting({ roundsCount: Number(v) })
              }
              disabled={!isHost}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
              ]}
            />
          </div>

          <div className="lobby-settings__row lobby-settings__row--wrap">
            <label>{t('create.category')}</label>
            <div className="category-chips">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`chip${room.settings.categories !== 'random' && room.settings.categories.includes(cat) ? ' chip--active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                  disabled={!isHost}
                >
                  {t(`category.${cat}`)}
                </button>
              ))}
              <button
                type="button"
                className={`chip${room.settings.categories === 'random' ? ' chip--active' : ''}`}
                onClick={() => toggleCategory('random')}
                disabled={!isHost}
              >
                {t('category.random')}
              </button>
            </div>
          </div>

          <div className="lobby-settings__row">
            <label>{t('create.hintsEnabled')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={room.settings.hintsEnabled}
              className={`toggle-switch${room.settings.hintsEnabled ? ' toggle-switch--on' : ''}`}
              onClick={() =>
                updateSetting({ hintsEnabled: !room.settings.hintsEnabled })
              }
              disabled={!isHost}
            >
              <span className="toggle-switch__thumb" />
            </button>
          </div>

        </div>
      </div>

      <div className="lobby-section">
        {!isHost && (
          <button
            className="btn btn--primary btn--block btn--lg"
            type="button"
            onClick={toggleReady}
          >
            {me?.isReady ? t('lobby.cancelReady') : t('lobby.ready')}
          </button>
        )}
        {isHost && (
          <button
            className="btn btn--primary btn--block btn--lg"
            type="button"
            onClick={handleStart}
            disabled={!canStart}
          >
            {canStart
              ? t('lobby.startGame')
              : t('lobby.waitForPlayers', {
                  min: room.settings.impostorCount + 2,
                })}
          </button>
        )}
      </div>
    </div>
  );
}
