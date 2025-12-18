// src/App.tsx
import React from 'react';
import { useUIStore } from './state/uiStore';
import { GameView } from './components/GameView'; // Your R3F Canvas component
import { TopMenuBar } from './components/ui/TopMenuBar';
import { FinancesWindow } from './components/ui/FinancesWindow';
import './components/ui/ui.css';

function App() {
  const isGamePaused = useUIStore((state) => state.isGamePaused);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#333' }}>
      {/* The 3D Game View renders in the background */}
      <GameView isPaused={isGamePaused} />

      {/* The UI Container overlays the game view */}
      <div className="ui-container">
        <TopMenuBar />
        <FinancesWindow />
        {/* Add other windows and UI elements here */}
      </div>
    </div>
  );
}

export default App;
