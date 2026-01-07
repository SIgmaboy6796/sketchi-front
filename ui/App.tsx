import { useState, useEffect, useRef } from 'react';
import { Game } from '../core/Game';
import { MainMenu } from './MainMenu';
import { UI } from './UI';
import './style.css';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameReady, setIsGameReady] = useState(false);
  const gameInstance = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startGame = (playerName: string) => {
    console.log(`Starting game for ${playerName}`);
    setIsPlaying(true);
  };

  useEffect(() => {
    // Initialize the Game engine when we switch to playing mode
    let game: Game | null = null;
    if (isPlaying && containerRef.current && !gameInstance.current) {
      game = new Game(containerRef.current);
      game.start();
      game.world.initGame();
      gameInstance.current = game;
      setIsGameReady(true);
    }

    return () => {
      // Cleanup to prevent double-initialization in Strict Mode
      if (game && containerRef.current) {
        containerRef.current.innerHTML = ''; // Remove the canvas
        gameInstance.current = null;
        setIsGameReady(false);
      }
    };
  }, [isPlaying]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#333', position: 'relative', overflow: 'hidden' }}>
      {/* Render Main Menu if not playing */}
      {!isPlaying && <MainMenu onStartGame={startGame} />}

      {/* Container for Three.js Canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, visibility: isPlaying ? 'visible' : 'hidden' }} />

      {/* Render HUD if game is running */}
      {isPlaying && isGameReady && gameInstance.current && <UI game={gameInstance.current} />}
    </div>
  );
}

export default App;