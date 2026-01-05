// src/components/ui/ConsoleWindow.tsx
import React, { useState } from 'react';
import { useUIStore } from '../../state/uiStore';
import './ui.css';

export const ConsoleWindow = () => {
  const { isConsoleOpen, toggleConsole, updateFinances, operatingProfit, cash } = useUIStore();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);

  if (!isConsoleOpen) {
    return null;
  }

  const handleCommand = (command: string) => {
    const trimmed = command.trim().toLowerCase();
    if (trimmed === 'cmds' || trimmed === 'commands') {
      setOutput(prev => [...prev, `> ${command}`, 'Available commands:', '- cmds / commands: List available commands', '- tick: Run one game update tick manually']);
    }
    else if (trimmed === 'tick') {
      updateFinances({ cash: cash + operatingProfit });
      setOutput(prev => [...prev, `> ${command}`, `Game ticked: Cash increased by $${operatingProfit.toLocaleString()} to $${(cash + operatingProfit).toLocaleString()}`]);
    } else {
      setOutput(prev => [...prev, `> ${command}`, `Unknown command: ${command}`]);
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(input);
    }
  };

  return (
    <div className="window" style={{ top: '200px', left: '100px', width: '400px', height: '300px', pointerEvents: 'auto' }}>
      <div className="window-header">
        <span>Console</span>
        <button className="close-button" onClick={toggleConsole}>X</button>
      </div>
      <div className="window-content" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#000', color: '#0f0', fontFamily: 'monospace', padding: '8px', marginBottom: '8px' }}>
          {output.map((line, i) => <div key={i}>{line}</div>)}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          style={{ width: '100%', padding: '4px' }}
        />
      </div>
    </div>
  );
};