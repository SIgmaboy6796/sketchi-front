// src/components/ui/FinancesWindow.tsx
import React from 'react';
import { useUIStore } from './state/uiStore';
import './ui.css';

export const FinancesWindow = () => {
  // Get both the state and the action from the store
  const { isFinancesWindowOpen, toggleFinancesWindow } = useUIStore();

  // If the window isn't supposed to be open, render nothing
  if (!isFinancesWindowOpen) {
    return null;
  }

  return (
    <div className="window">
      <div className="window-header">
        <span>Finances</span>
        <button className="close-button" onClick={toggleFinancesWindow}>X</button>
      </div>
      <div className="window-content">
        <p>Company Value: $1,000,000</p>
        <p>Operating Profit: $50,000</p>
        <p>Cash: $250,000</p>
      </div>
    </div>
  );
};
