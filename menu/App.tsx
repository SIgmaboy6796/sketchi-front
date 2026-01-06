import React, { useState } from 'react';
import { useUIStore } from '../uiStore';
import { GameView } from './GameView'; // Your R3F Canvas component
import { MainMenu } from './MainMenu';
import './ui.css';

// Define the possible states of the game
type GameState = 'menu' | 'playing';

function App() {
  // The game starts in the 'menu' state
  const [gameState, setGameState] = useState<GameState>('menu');
  const isGamePaused = useUIStore((state) => state.isGamePaused);
  const cash = useUIStore((state) => state.cash);
  const troops = useUIStore((state) => state.troops);

  // This function will be passed to the MainMenu to change the state
  const startGame = (playerName: string) => {
    console.log(`Starting game for ${playerName}`);
    setGameState('playing');
  };

  // If we are in the menu state, only render the MainMenu
  if (gameState === 'menu') {
    return <MainMenu onStartGame={startGame} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#333', position: 'relative', overflow: 'hidden' }}>
      <GameView isPaused={isGamePaused} />
      <div className="ui-container">
        <div className="stats-panel">
          <div className="stat-item">Money: ${cash.toLocaleString()}</div>
          <div className="stat-item">Troops: {troops.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
