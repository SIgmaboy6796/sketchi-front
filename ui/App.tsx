import { useState, useEffect, useRef } from 'react';
import { Game } from '../core/Game';
import { MainMenu } from './MainMenu';
import { UI } from './UI';
import './ui.css';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startGame = (playerName: string) => {
    console.log(`Starting game for ${playerName}`);
    setIsPlaying(true);
  };

  useEffect(() => {
    // Initialize the Game engine when we switch to playing mode
    if (isPlaying && containerRef.current && !gameInstance) {
      const game = new Game(containerRef.current);
      game.start();
      game.world.initGame();
      setGameInstance(game);
    }
  }, [isPlaying]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#333', position: 'relative', overflow: 'hidden' }}>
      {/* Render Main Menu if not playing */}
      {!isPlaying && <MainMenu onStartGame={startGame} />}

      {/* Container for Three.js Canvas */}
      {isPlaying && <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />}

      {/* Render HUD if game is running */}
      {isPlaying && gameInstance && <UI game={gameInstance} />}
    </div>
  );
}

export default App;
