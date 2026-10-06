import { Moon, Sun } from 'lucide-react';
export default function ThemeToggle({ theme, onToggle }) {
  return <button className="theme-toggle" onClick={onToggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title="Toggle theme">
    {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
  </button>;
}
