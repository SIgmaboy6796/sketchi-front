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
                {/* HUD buttons can be mapped to global actions later */}
            </div>

            {contextMenu.visible && (
                <div 
                    id="context-menu" 
                    style={{
                        position: 'absolute',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        background: 'rgba(0,0,0,0.8)',
                        padding: '5px',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        zIndex: 1000
                    }}
                >
                    <button onClick={() => handleAction('attack')} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '16px' }}>⚔️ Expand</button>
                    <button onClick={() => handleAction('build')} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '16px' }}>🏙️ Build</button>
                </div>
            )}
        </>
    );
};