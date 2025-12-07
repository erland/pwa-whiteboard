import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { BoardListPage } from './pages/BoardListPage';
import { BoardEditorPage } from './pages/BoardEditorPage';

const App: React.FC = () => {
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-logo">🧩</span>
          <span>PWA Whiteboard</span>
        </div>
        <nav className="app-nav">
          <Link to="/">Boards</Link>
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
