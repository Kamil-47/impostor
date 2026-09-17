import { useI18n } from '../contexts/I18nContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useI18n();

  return (
    <button
      type="button"
      className="header-btn"
      onClick={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
      aria-label="Change language"
    >
      {language === 'pl' ? 'EN' : 'PL'}
    </button>
  );
}
