// src/components/GameView.tsx
import React, { useRef, useEffect, useState } from 'react';
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

interface MapProps {
  onTextureLoaded: (texture: THREE.Texture) => void;
}

function Map({ onTextureLoaded }: MapProps) {
  const texture = useTexture(mapImage, (loadedTexture) => {
    // This callback fires once the texture is loaded
    loadedTexture.minFilter = loadedTexture.magFilter = NearestFilter;
    loadedTexture.magFilter = NearestFilter;
    loadedTexture.wrapS = THREE.RepeatWrapping; // Allow horizontal repeating
    loadedTexture.wrapT = THREE.RepeatWrapping; // Also good practice for 2D maps
    loadedTexture.repeat.set(1, 1); // One repetition over the plane's UVs
    onTextureLoaded(loadedTexture);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[mapWidth, mapWidth / 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function CameraController({ isPaused, mapTexture }: { isPaused: boolean; mapTexture: THREE.Texture | null }) {
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

      // Wrap camera position horizontally
      const halfWidth = mapWidth / 2;
      if (camera.position.x > halfWidth) {
        camera.position.x -= mapWidth;
        controls.setPosition(camera.position.x, camera.position.y, camera.position.z, false);
        if (mapTexture) {
          mapTexture.offset.x -= 1; // Shift texture offset to match the wrap
        }
      } else if (camera.position.x < -halfWidth) {
        camera.position.x += mapWidth;
        controls.setPosition(camera.position.x, camera.position.y, camera.position.z, false);
        if (mapTexture) {
          mapTexture.offset.x += 1; // Shift texture offset to match the wrap
        }
      }
    }
  });

  return null;
}

export const GameView: React.FC<GameViewProps> = ({ isPaused }) => {
  const [mapTexture, setMapTexture] = useState<THREE.Texture | null>(null);

  return (
    <Canvas orthographic camera={{ position: [0, 10, 0], zoom: 50, up: [0, 0, -1] }}>
      <CameraController isPaused={isPaused} mapTexture={mapTexture} />
      <Map onTextureLoaded={setMapTexture} />
    </Canvas>
  );
};