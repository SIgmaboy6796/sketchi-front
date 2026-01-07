import React, { useState, useEffect } from 'react';
import { Game } from '../core/Game';

export const UI = ({ game }: { game: Game }) => {
    const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');
    const [resources, setResources] = useState({ money: 0, troops: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            setResources({ money: game.money, troops: game.troops });
        }, 100);
        return () => clearInterval(interval);
    }, [game]);

    if (gameState === 'menu') {
        return (
            <div id="main-menu">
                <h1>Sketchi Front</h1>
                <p>OpenFront Clone - 3D Edition</p>
                <button onClick={() => {
                    game.world.initGame();
                    setGameState('playing');
                }}>Start Game</button>
                <button>Multiplayer</button>
            </div>
        );
    }

    return (
        <>
            <div id="resource-display">
                <div id="money-counter">💰 {resources.money}</div>
                <div id="troop-counter">⚔️ {resources.troops}</div>
            </div>
            
            <div id="game-hud">
                <button className="action-btn" title="Attack">⚔️ Attack</button>
                <button className="action-btn" title="Build City">🏙️ Build</button>
            </div>
        </>
    );
};