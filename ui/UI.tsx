import { useState, useEffect } from 'react';
import { Game } from '../core/Game';
import { useUIStore } from '../uiStore';

export const UI = ({ game }: { game: Game }) => {
    const { cash, troops, theme, toggleTheme } = useUIStore();
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; uv: any }>({
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
            <div id="resource-display" style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                color: theme === 'dark' ? 'white' : 'black',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                fontSize: '20px',
                textShadow: '0 0 5px rgba(0,0,0,0.5)'
            }}>
                <div id="money-counter">💰 {Math.floor(cash).toLocaleString()}</div>
                <div id="troop-counter">⚔️ {Math.floor(troops).toLocaleString()}</div>
            </div>

            <button 
                onClick={toggleTheme}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    padding: '10px',
                    borderRadius: '5px',
                    border: 'none',
                    background: theme === 'dark' ? '#333' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#333',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            
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
                        width: '150px',
                        height: '150px',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        pointerEvents: 'none', // Let clicks pass through container to buttons
                        borderRadius: '50%',
                        background: 'rgba(0, 0, 0, 0.2)'
                    }}
                >
                    {/* Circular Layout */}
                    <button 
                        onClick={() => handleAction('attack')} 
                        style={{ 
                            position: 'absolute',
                            top: '0',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '60px', 
                            height: '60px', 
                            borderRadius: '50%', 
                            background: '#ff4757', 
                            color: 'white', 
                            border: '2px solid white', 
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                    >⚔️</button>
                    <button 
                        onClick={() => handleAction('build')} 
                        style={{ 
                            position: 'absolute',
                            bottom: '0',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '60px', 
                            height: '60px', 
                            borderRadius: '50%', 
                            background: '#2ed573', 
                            color: 'white', 
                            border: '2px solid white', 
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                    >🏙️</button>
                </div>
            )}
        </>
    );
};
