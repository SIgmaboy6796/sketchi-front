// src/components/GameView.tsx
import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { NearestFilter } from 'three';
import { useTexture } from '@react-three/drei';
import CameraControls from 'camera-controls'; // Ensure this import is correct
import mapImage from '../map/map.png';

CameraControls.install( { THREE: THREE } );

interface GameViewProps {
  isPaused: boolean;
}

const mapWidth = 20;

function Map() {
  const texture = useTexture(mapImage, (loadedTexture) => {
    // This callback fires once the texture is loaded
    loadedTexture.minFilter = loadedTexture.magFilter = NearestFilter;
    loadedTexture.magFilter = NearestFilter;
    loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
    loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
    loadedTexture.repeat.set(1, 1); // One repetition over the plane's UVs
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[mapWidth, mapWidth / 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function CameraController({ isPaused }: { isPaused: boolean }) {
  const { camera, gl } = useThree();
  const cameraControlsRef = useRef<CameraControls | null>(null);

  useEffect(() => {
    const cameraControls = new CameraControls(camera, gl.domElement);
    cameraControls.mouseButtons.left = CameraControls.ACTION.TRUCK;
    cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;
    cameraControls.mouseButtons.wheel = CameraControls.ACTION.DOLLY;
    cameraControls.mouseButtons.middle = CameraControls.ACTION.NONE;
    cameraControls.touches.one = CameraControls.ACTION.TOUCH_TRUCK;
    cameraControls.touches.two = CameraControls.ACTION.TOUCH_DOLLY;
    cameraControls.touches.three = CameraControls.ACTION.NONE;

    cameraControlsRef.current = cameraControls;

    return () => {
      cameraControls.dispose();
    };
  }, [camera, gl]);

  useFrame((state, delta) => {
    const controls = cameraControlsRef.current;
    if (controls && !isPaused) {
      controls.update(delta);
    }
  });

  return null;
}

export const GameView: React.FC<GameViewProps> = ({ isPaused }) => {
  return (
    <Canvas orthographic camera={{ position: [0, 10, 0], zoom: 50, up: [0, 0, -1] }}>
      <CameraController isPaused={isPaused} />
      <Map />
    </Canvas>
  );
};