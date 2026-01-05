// src/components/ui/TopMenuBar.tsx
import React from 'react';
import { useUIStore } from '../../state/uiStore';
import './ui.css'; // We'll create this CSS file next

export const TopMenuBar = () => {
  const toggleFinancesWindow = useUIStore((state) => state.toggleFinancesWindow);
  const toggleConsole = useUIStore((state) => state.toggleConsole);
  const togglePause = useUIStore((state) => state.togglePause);
  const isGamePaused = useUIStore((state) => state.isGamePaused);

  return (
    <div className="top-menu-bar" style={{ pointerEvents: 'auto' }}>
      <button onClick={toggleFinancesWindow}>Finances</button>
      <button onClick={toggleConsole}>Console</button>
      <div className="spacer" />
      <button onClick={togglePause}>{isGamePaused ? '▶️ Resume' : '⏸️ Pause'}</button>
    </div>
  );
};
