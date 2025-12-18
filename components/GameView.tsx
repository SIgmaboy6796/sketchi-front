// src/components/GameView.tsx
import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three'; // Import the entire THREE namespace
import { NearestFilter } from 'three';
import { useTexture } from '@react-three/drei';
import CameraControls from 'camera-controls';

CameraControls.install( { THREE: THREE } );

interface GameViewProps {
  isPaused: boolean;
}

const mapWidth = 20;

function Map() {
  const texture = useTexture('/map_place.png'); // Use absolute path from public folder
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.wrapS = THREE.RepeatWrapping; // Allow horizontal repeating
  texture.repeat.set(1, 1);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[mapWidth, mapWidth / 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function CameraController({ isPaused }: { isPaused: boolean }) {
  const { camera, gl, scene } = useThree();
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
  }, [camera, gl, scene]);

  useFrame((state, delta) => {
    const controls = cameraControlsRef.current;
    if (controls && !isPaused) {
      controls.update(delta);

      // Wrap camera position horizontally
      const halfWidth = mapWidth / 2;
      if (camera.position.x > halfWidth) {
        camera.position.x -= mapWidth;
        controls.moveTo(camera.position.x, camera.position.y, camera.position.z, false);
      } else if (camera.position.x < -halfWidth) {
        camera.position.x += mapWidth;
        controls.moveTo(camera.position.x, camera.position.y, camera.position.z, false);
      }
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