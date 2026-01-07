// src/components/ui/MainMenu.tsx
import { useState, FC } from 'react';
import './ui.css';

interface MainMenuProps {
  onStartGame: (playerName: string) => void;
}

export const MainMenu: FC<MainMenuProps> = ({ onStartGame }) => {
  const [playerName, setPlayerName] = useState('Player');

  const handleStart = () => {
    // Basic validation to ensure the player name isn't empty
    if (playerName.trim()) {
      onStartGame(playerName.trim());
    }
  };

  return (
    <div className="main-menu-screen">
      <div className="main-menu-content">
        <h1 className="game-title">Sketchi</h1>
        <div className="nametag-container">
          <label htmlFor="nametag">Nametag</label>
          <input
            id="nametag"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>
        <button className="menu-button" onClick={handleStart}>Singleplayer</button>
        <button className="menu-button" disabled>Multiplayer</button>
        <button className="menu-button" disabled>Settings</button>
      </div>
    </div>
  );
};