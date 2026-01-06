// src/components/ui/ConsoleWindow.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUIStore } from '../../state/uiStore';
import './ui.css';

// Define a type for command handlers
type CommandHandler = (args: string[]) => string | void;

export const ConsoleWindow = () => {
  const { isConsoleOpen, toggleConsole, updateFinances, operatingProfit, cash } = useUIStore();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const endOfLogRef = useRef<HTMLDivElement>(null);

  // 1. Command Registry: Define commands in a scalable way
  // This allows you to easily add new features or "mods" later.
  const commands = useMemo<Record<string, CommandHandler>>(() => ({
    help: () => 'Available commands: help, tick, clear, cash',
    clear: () => {
      setOutput([]);
      return 'Console cleared.';
    },
    tick: () => {
      updateFinances({ cash: cash + operatingProfit });
      return `Game ticked: Cash increased by $${operatingProfit.toLocaleString()} to $${(cash + operatingProfit).toLocaleString()}`;
    },
    cash: () => `Current Cash: $${cash.toLocaleString()}`,
  }), [cash, operatingProfit, updateFinances]);

  // 2. Auto-scroll to bottom whenever output changes
  useEffect(() => {
    if (endOfLogRef.current) {
      endOfLogRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, isConsoleOpen]);

  if (!isConsoleOpen) {
    return null;
  }

  const handleCommand = (commandStr: string) => {
    const trimmed = commandStr.trim();
    if (!trimmed) return;

    const [cmd, ...args] = trimmed.split(' ');
    const lowerCmd = cmd.toLowerCase();

    let response: string | void;

    if (commands[lowerCmd]) {
      try {
        response = commandsLowerCmd;
      } catch (error) {
        response = `Error executing '': `;
      }
    } else {
      response = `Unknown command: . Type 'help' for a list of commands.`;
    }

    // 3. History Limit: Keep only the last 100 lines to prevent memory issues
    setOutput(prev => {
      const newLog = [...prev, `> {commandStr}`];
      if (response) newLog.push(response);
      return newLog.slice(-100); 
    });
    
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(input);
    }
  };

  return (
    <div className="window" style={{ top: '200px', left: '100px', width: '400px', height: '300px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="window-header">
        <span>Console</span>
        <button className="close-button" onClick={toggleConsole}>X</button>
      </div>
      <div className="window-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          backgroundColor: '#000', 
          color: '#0f0', 
          fontFamily: 'monospace', 
          padding: '8px', 
          marginBottom: '8px' 
        }}>
          {output.map((line, i) => (
            <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line}</div>
          ))}
          <div ref={endOfLogRef} />
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
          autoFocus
        />
      </div>
    </div>
  );
};
