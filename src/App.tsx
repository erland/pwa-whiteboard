import React, { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { BoardListPage } from './pages/BoardListPage';
import { BoardEditorPage } from './pages/BoardEditorPage';
import { useAuth } from './auth/AuthContext';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const auth = useAuth();
  const [theme, setTheme] = useState<Theme>('dark');
  const [authAction, setAuthAction] = useState<'idle' | 'signing-in' | 'signing-out'>('idle');

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

  const handleSignIn = async () => {
    if (!auth.configured || authAction !== 'idle') return;
    setAuthAction('signing-in');
    try {
      await auth.login();
    } finally {
      setAuthAction('idle');
    }
  };

  const handleSignOut = async () => {
    if (!auth.configured || authAction !== 'idle') return;
    setAuthAction('signing-out');
    try {
      await auth.logout();
    } finally {
      setAuthAction('idle');
    }
  };

  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  const authButtonLabel = auth.authenticated
    ? authAction === 'signing-out'
      ? 'Signing out…'
      : 'Sign out'
    : authAction === 'signing-in'
      ? 'Signing in…'
      : 'Sign in';

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-logo">🧩</span>
          <span>PWA Whiteboard</span>
        </div>
        <nav className="app-nav" aria-label="Main navigation">
          <Link to="/">Boards</Link>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={themeLabel}
          >
            {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
          {auth.configured && (
            <div className="auth-actions">
              {auth.authenticated && auth.displayName && (
                <span className="auth-display-name" title={auth.displayName}>
                  {auth.displayName}
                </span>
              )}
              <button
                type="button"
                className="auth-toggle"
                onClick={auth.authenticated ? handleSignOut : handleSignIn}
                disabled={authAction !== 'idle'}
                aria-label={authButtonLabel}
              >
                {authButtonLabel}
              </button>
            </div>
          )}
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
