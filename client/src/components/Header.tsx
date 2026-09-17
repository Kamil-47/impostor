import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

export default function Header() {
  return (
    <header className="app-header">
      <LanguageToggle />
      <ThemeToggle />
    </header>
  );
}
