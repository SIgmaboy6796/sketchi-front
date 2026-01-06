import React from 'react';
import ReactDOM from 'react-dom/client';
import { Game } from './core/Game';
import { UI } from './menu/UI';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start();

    const uiRoot = document.getElementById('ui-layer');
    if (uiRoot) {
        ReactDOM.createRoot(uiRoot).render(
            <React.StrictMode>
                <UI game={game} />
            </React.StrictMode>
        );
    }
});