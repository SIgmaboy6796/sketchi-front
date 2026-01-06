// src/App.tsx
import React, { useState } from 'react';
import { useUIStore } from './state/uiStore';
import { GameView } from './components/GameView'; // Your R3F Canvas component
import { TopMenuBar } from './components/ui/TopMenuBar';
import { FinancesWindow } from './components/ui/FinancesWindow';
import { ConsoleWindow } from './components/ui/ConsoleWindow';
import { MainMenu } from './components/ui/MainMenu';
import './components/ui/ui.css';

// Define the possible states of the game
type GameState = 'menu' | 'playing';

function App() {
  // The game starts in the 'menu' state
  const [gameState, setGameState] = useState<GameState>('menu');
  const isGamePaused = useUIStore((state) => state.isGamePaused);

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
      <div className="ui-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <TopMenuBar />
        <FinancesWindow />
        <ConsoleWindow />
      </div>
    </div>
  );
}

export default App;
