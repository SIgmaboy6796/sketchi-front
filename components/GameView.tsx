// src/components/GameView.tsx
import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { TextureLoader, NearestFilter } from 'three';
import { useTexture } from '@react-three/drei';
import CameraControls from 'camera-controls';

CameraControls.install( { THREE: THREE } );

interface GameViewProps {
  isPaused: boolean;
}

function Globe() {
  const texture = useTexture('world_pixels.png'); // Replace with your image path
  texture.minFilter = texture.magFilter = NearestFilter;

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function CameraController({ isPaused }: { isPaused: boolean }) {
  const { camera, gl } = useThree();
  const cameraControlsRef = useRef<CameraControls | null>(null);

  useEffect(() => {
    const cameraControls = new CameraControls(camera, gl.domElement);
      cameraControlsRef.current = cameraControls;

    return () => {
      cameraControls.dispose();
    };
  }, [camera, gl]);

  useFrame((state, delta) => {
    if (cameraControlsRef.current && !isPaused) {
      cameraControlsRef.current.update(delta);
    }
  });

  return null;
}

export const GameView: React.FC<GameViewProps> = ({ isPaused }) => {    
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
        <CameraController isPaused={isPaused} />
      <directionalLight position={[-2, 5, 2]} intensity={1} />
      <Globe />
    </Canvas>
  );
};