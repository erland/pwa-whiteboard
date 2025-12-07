import React, { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { BoardListPage } from './pages/BoardListPage';
import { BoardEditorPage } from './pages/BoardEditorPage';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('whiteboard-theme');
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        return;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme to <html> and persist
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      window.localStorage.setItem('whiteboard-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-logo">🧩</span>
          <span>PWA Whiteboard</span>
        </div>
        <nav className="app-nav">
          <Link to="/">Boards</Link>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={themeLabel}
          >
            {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<BoardListPage />} />
          <Route path="/board/:id" element={<BoardEditorPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
