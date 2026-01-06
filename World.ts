import * as THREE from 'three';

interface City {
    mesh: THREE.Mesh;
    name: string;
    health: number;
}

export class World {
    scene: THREE.Scene;
    cities: City[];
    units: any[];
    projectiles: any[];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.cities = [];
        this.units = [];
        this.projectiles = [];

        this.createEnvironment();
    }

    createEnvironment() {
        // Globe
        const radius = 100;
        const geometry = new THREE.SphereGeometry(radius, 64, 64);
        
        // Generate Pixelated Terrain Texture
        const width = 256;
        const height = 128;
        const size = width * height;
        const data = new Uint8Array(4 * size);

        for (let i = 0; i < size; i++) {
            const stride = i * 4;
            const x = i % width;
            const y = Math.floor(i / width);
            
            // Simple procedural noise-like pattern for land/water
            const u = x / width * Math.PI * 2;
            const v = y / height * Math.PI;
            const noise = Math.sin(u * 4) + Math.sin(v * 4) + Math.sin(u * 10 + v * 10) * 0.5;
            
            const isLand = noise > 0.5;
            const isIce = v < 0.45 || v > (Math.PI - 0.45); // Arctic/Antarctic circles

            if (isIce) {
                data[stride] = 255;  // R
                data[stride + 1] = 255; // G
                data[stride + 2] = 255;  // B
            } else if (isLand) {
                data[stride] = 34;
                data[stride + 1] = 139;
                data[stride + 2] = 34;
            } else {
                data[stride] = 30;  // R
                data[stride + 1] = 144; // G
                data[stride + 2] = 255; // B
            }
            data[stride + 3] = 255; // Alpha
        }

        const texture = new THREE.DataTexture(data, width, height);
        texture.needsUpdate = true;
        texture.magFilter = THREE.NearestFilter; // Pixelated look
        texture.minFilter = THREE.NearestFilter;

        const material = new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const globe = new THREE.Mesh(geometry, material);
        globe.receiveShadow = true;
        this.scene.add(globe);
    }

    initGame() {
        console.log("Game Initialized");
        // Spawn initial cities (Lat, Lon)
        this.spawnCity(45, 0, 'Capital');
        this.spawnCity(-30, 90, 'Enemy Outpost');
    }

    spawnCity(lat: number, lon: number, name: string) {
        const radius = 100;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = (radius * Math.sin(phi) * Math.sin(theta));
        const y = (radius * Math.cos(phi));

        const geometry = new THREE.BoxGeometry(2, 4, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const city = new THREE.Mesh(geometry, material);
        
        city.position.set(x, y, z);
        // Align city with the surface normal
        city.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
        
        city.castShadow = true;
        city.receiveShadow = true;
        
        this.scene.add(city);
        this.cities.push({ mesh: city, name, health: 100 });
    }

    launchNuke(fromPos: THREE.Vector3, toPos: THREE.Vector3) {
        // TODO: Implement 3D rocket trajectory
        console.log("Nuke launched!", fromPos, toPos);
    }

    update(delta: number) {
        // Update animations, projectiles, etc.
        this.projectiles.forEach(p => p.update(delta));
    }
}