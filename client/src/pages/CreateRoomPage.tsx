import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useI18n } from '../contexts/I18nContext';
import { usePreferences } from '../hooks/usePreferences';
import { usePlayerIdentity } from '../hooks/usePlayerIdentity';
import type { RoomSettings, Category } from '@impostor/shared';
import CustomSelect from '../components/CustomSelect';

const ALL_CATEGORIES: Category[] = ['agents', 'maps', 'weapons', 'ultimates'];

export default function CreateRoomPage() {
  const socket = useSocket();
  const navigate = useNavigate();
  const { t } = useI18n();
  const prefs = usePreferences();
  const { saveUuid } = usePlayerIdentity();

  const [nickname, setNickname] = useState(prefs.nickname);
  const [impostorCount, setImpostorCount] = useState(prefs.impostorCount);
  const [roundsCount, setRoundsCount] = useState(prefs.roundsCount);
  const [categories, setCategories] = useState<RoomSettings['categories']>(prefs.categories);
  const [hintsEnabled, setHintsEnabled] = useState(prefs.hintsEnabled);

  function toggleCategory(cat: Category | 'random') {
    if (cat === 'random') {
      setCategories('random');
      return;
    }
    if (categories === 'random') {
      setCategories([cat]);
      return;
    }
    const next = categories.includes(cat)
      ? categories.filter((c) => c !== cat)
      : [...categories, cat];
    setCategories(next.length === 0 ? 'random' : next);
  }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onError(err: { code: string; message: string }) {
      setError(err.message);
      setSubmitting(false);
    }
    socket.on('error', onError);
    return () => {
      socket.off('error', onError);
    };
  }, [socket]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError(t('error.enterNickname'));
      return;
    }

    setError('');
    setSubmitting(true);

    const settings: RoomSettings = { impostorCount, categories, roundsCount, hintsEnabled };
    socket.emit('room:create', { nickname: trimmed, settings }, (response) => {
      saveUuid(response.playerUuid);
      prefs.setNickname(trimmed);
      prefs.setLastCode(response.code);
      prefs.setImpostorCount(impostorCount);
      prefs.setRoundsCount(roundsCount);
      prefs.setCategories(categories);
      prefs.setHintsEnabled(hintsEnabled);
      navigate(`/room/${response.code}`);
    });
  }

  return (
    <main className="form-page">
      <Link to="/" className="form-page__back">
        {t('nav.back')}
      </Link>
      <h1 className="form-page__title">{t('create.title')}</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nickname">{t('form.nickname')}</label>
          <input
            className="form-input"
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder={t('form.nicknamePlaceholder')}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label htmlFor="impostorCount">{t('create.impostorCount')}</label>
          <CustomSelect
            id="impostorCount"
            value={String(impostorCount)}
            onChange={(v) => setImpostorCount(Number(v))}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
        </div>
        <div className="form-group">
          <label htmlFor="roundsCount">{t('create.roundsCount')}</label>
          <CustomSelect
            id="roundsCount"
            value={String(roundsCount)}
            onChange={(v) => setRoundsCount(Number(v))}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
        </div>
        <div className="form-group">
          <label>{t('create.category')}</label>
          <div className="category-chips">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`chip${categories !== 'random' && categories.includes(cat) ? ' chip--active' : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {t(`category.${cat}`)}
              </button>
            ))}
            <button
              type="button"
              className={`chip${categories === 'random' ? ' chip--active' : ''}`}
              onClick={() => toggleCategory('random')}
            >
              {t('category.random')}
            </button>
          </div>
        </div>
        <div className="form-group form-group--row">
          <label htmlFor="hintsEnabled">{t('create.hintsEnabled')}</label>
          <button
            id="hintsEnabled"
            type="button"
            role="switch"
            aria-checked={hintsEnabled}
            className={`toggle-switch${hintsEnabled ? ' toggle-switch--on' : ''}`}
            onClick={() => setHintsEnabled(!hintsEnabled)}
          >
            <span className="toggle-switch__thumb" />
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn btn--primary btn--block btn--lg"
          type="submit"
          disabled={submitting}
        >
          {submitting ? t('create.creating') : t('create.submit')}
        </button>
      </form>
    </main>
  );
}
