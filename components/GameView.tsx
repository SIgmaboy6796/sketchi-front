// src/components/GameView.tsx
import React from 'react';
import { Canvas } from '@react-three/fiber';

interface GameViewProps {
  isPaused: boolean;
}

export const GameView: React.FC<GameViewProps> = ({ isPaused }) => {
  return (
    <Canvas>
      {/* Add your 3D scene elements here */}
      {/* You can use the 'isPaused' prop to control animations or game logic */}
    </Canvas>
  );
};