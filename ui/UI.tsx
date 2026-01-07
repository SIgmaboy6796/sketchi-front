import React, { useState, useEffect } from 'react';
import { Game } from '../core/Game';

export const UI = ({ game }: { game: Game }) => {
    const [resources, setResources] = useState({ money: 0, troops: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            setResources({ money: game.money, troops: game.troops });
        }, 100);
        return () => clearInterval(interval);
    }, [game]);

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