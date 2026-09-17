import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <main className="home">
      <h1 className="home__title">{t('app.title')}</h1>
      <p className="home__subtitle">{t('app.subtitle')}</p>
      <div className="home__actions">
        <button
          className="btn btn--primary btn--lg"
          type="button"
          onClick={() => navigate('/create')}
        >
          {t('home.createRoom')}
        </button>
        <button
          className="btn btn--secondary btn--lg"
          type="button"
          onClick={() => navigate('/join')}
        >
          {t('home.joinRoom')}
        </button>
      </div>
    </main>
  );
}
