import React from 'react';
import { Link } from 'react-router-dom';

export const BoardListPage: React.FC = () => {
  return (
    <section className="page page-board-list">
      <header className="page-header">
        <h1>Your Boards</h1>
        <button type="button" disabled>
          + New board (coming soon)
        </button>
      </header>
      <p>This is a placeholder for the board list. In future steps this will show your saved boards.</p>
      <p>
        For now, you can try the editor placeholder:{' '}
        <Link to="/board/demo">Open demo board</Link>
      </p>
    </section>
  );
};
