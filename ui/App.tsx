import { useState, useEffect, useRef } from 'react';
import { Game } from '../core/Game';
import { MainMenu } from './MainMenu';
import { UI } from './UI';
import { useUIStore } from '../uiStore';
import './style.css';
import './ui.css';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameReady, setIsGameReady] = useState(false);
  const { theme } = useUIStore();
  const gameInstance = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startGame = (playerName: string) => {
    console.log(`Starting game for ${playerName}`);
    setIsPlaying(true);
    if (gameInstance.current) {
        gameInstance.current.activateGame();
    }
  };

  useEffect(() => {
    // Initialize the Game engine immediately on mount (for background globe)
    if (containerRef.current && !gameInstance.current) {
      const game = new Game(containerRef.current);
      game.start();
      game.world.initGame();
      gameInstance.current = game;
      setIsGameReady(true);
    }

    return () => {
      // Cleanup to prevent double-initialization in Strict Mode
      if (gameInstance.current && containerRef.current) {
        containerRef.current.innerHTML = ''; // Remove the canvas
        gameInstance.current = null;
        setIsGameReady(false);
      }
    };
  }, []); // Empty dependency array ensures this runs once on load

  return (
    <div style={{ width: '100vw', height: '100vh', background: theme === 'dark' ? '#333' : '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
      {/* Container for Three.js Canvas (Always visible now) */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />

      {/* Render Main Menu if not playing */}
      {!isPlaying && <MainMenu onStartGame={startGame} />}
      
      {/* Render HUD if game is running */}
      {isPlaying && isGameReady && gameInstance.current && <UI game={gameInstance.current} />}
    </div>
  );
}

export default App;