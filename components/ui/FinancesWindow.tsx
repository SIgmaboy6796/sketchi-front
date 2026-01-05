// src/components/ui/FinancesWindow.tsx
import React from 'react';
import { useUIStore } from '../../state/uiStore';
import './ui.css';

export const FinancesWindow = () => {
  // Get both the state and the action from the store
  const { isFinancesWindowOpen, toggleFinancesWindow, companyValue, operatingProfit, cash } = useUIStore();

  // If the window isn't supposed to be open, render nothing
  if (!isFinancesWindowOpen) {
    return null;
  }

  return (
    <div className="window" style={{ pointerEvents: 'auto' }}>
      <div className="window-header">
        <span>Finances</span>
        <button className="close-button" onClick={toggleFinancesWindow}>X</button>
      </div>
      <div className="window-content">
        <p>Company Value: {companyValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
        <p>Operating Profit: {operatingProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
        <p>Cash: {cash.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
      </div>
    </div>
  );
};
