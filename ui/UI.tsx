import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Game } from '../core/Game';
import { useUIStore } from '../uiStore';

export const UI = ({ game }: { game: Game }) => {
    const { cash, troops } = useUIStore();
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; uv: THREE.Vector2 | null }>({
        visible: false,
        x: 0,
        y: 0,
        uv: null
    });

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            const intersection = game.inputManager.getIntersection();
            
            if (intersection && intersection.uv) {
                setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    uv: intersection.uv
                });
            }
        };

        const handleClick = () => {
            if (contextMenu.visible) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };

        game.renderer.domElement.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('click', handleClick);

        return () => {
            game.renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('click', handleClick);
        };
    }, [game, contextMenu.visible]);

    const handleAction = (action: 'attack' | 'build') => {
        if (!contextMenu.uv) return;

        if (action === 'attack') {
            const speed = Math.max(1, troops * 0.1); 
            game.world.startExpansion(contextMenu.uv, speed);
            console.log("Expanding at", contextMenu.uv, "with speed", speed);
        } else if (action === 'build') {
            console.log("Build action not yet implemented.");
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    return (
        <>
            <div id="resource-display">
                <div id="money-counter">💰 {cash}</div>
                <div id="troop-counter">⚔️ {troops}</div>
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
                    <button key="attack" onClick={() => handleAction('attack')} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '16px' }}>⚔️ Expand</button>
                    <button key="build" onClick={() => handleAction('build')} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '16px' }}>🏙️ Build</button>
                </div>
            )}
        </>
    );
};
