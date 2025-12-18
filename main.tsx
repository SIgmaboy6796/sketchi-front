import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useUIStore } from './state/uiStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Add console command 'tick' to simulate a game tick
;(window as any).tick = () => {
  const { updateFinances, operatingProfit, cash } = useUIStore.getState();
  updateFinances({ cash: cash + operatingProfit });
  console.log(`Game ticked: Cash increased by $${operatingProfit.toLocaleString()} to $${(cash + operatingProfit).toLocaleString()}`);
};