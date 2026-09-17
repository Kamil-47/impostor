import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { usePreferences } from '../hooks/usePreferences';

export default function JoinRoomPage() {
  const { code: paramCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const prefs = usePreferences();

  const [code, setCode] = useState(paramCode?.toUpperCase() ?? prefs.lastCode);
  const [nickname, setNickname] = useState(prefs.nickname);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedNick = nickname.trim();

    if (!trimmedCode) {
      setError(t('error.enterRoomCode'));
      return;
    }
    if (!trimmedNick) {
      setError(t('error.enterNickname'));
      return;
    }

    prefs.setNickname(trimmedNick);
    prefs.setLastCode(trimmedCode);
    navigate(`/room/${trimmedCode}`);
  }

  return (
    <main className="form-page">
      <Link to="/" className="form-page__back">
        {t('nav.back')}
      </Link>
      <h1 className="form-page__title">{t('join.title')}</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="code">{t('join.roomCode')}</label>
          <input
            className="form-input"
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ABC123"
            autoFocus={!paramCode}
          />
        </div>
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
            autoFocus={!!paramCode}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn btn--primary btn--block btn--lg"
          type="submit"
        >
          {t('join.submit')}
        </button>
      </form>
    </main>
  );
}
