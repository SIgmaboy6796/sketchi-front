import * as THREE from 'three';
import * as h3 from 'h3-js';

export type Biome = 'ocean' | 'coast' | 'desert' | 'land' | 'mountain' | 'pole';

export interface City {
    mesh: THREE.Mesh;
    name: string;
    health: number;
}

export interface WorldData {
    centers: { x: number, y: number, z: number }[];
    centerNeighbors: number[][];
    centerWater: boolean[];
    centerLat: number[];
    centerLng: number[];
    hexagons: string[];
    biomes: Biome[];
    elevations: number[];
}

export interface Projectile {
    mesh: THREE.Mesh;
    curve: any;
    progress: number;
    speed: number;
    onComplete?: () => void;
}

export interface ConquestInProgress {
    hexIndex: number;
    troopsAllocated: number;
    timeElapsed: number;
    totalTimeNeeded: number;
}

export class World {
    scene: THREE.Scene;
    cities: City[];
    units: any[];
    projectiles: Projectile[];
    globe: THREE.Mesh | null = null;
    globeRadius: number = 210;
    territorySize: number = 0;

    centers: THREE.Vector3[] = [];
    centerNeighbors: number[][] = [];
    centerWater: boolean[] = [];
    centerOwned: boolean[] = [];
    centerLat: number[] = [];
    centerLng: number[] = [];
    hexagons: string[] = [];
    biomes: Biome[] = [];
    elevations: number[] = [];
    hexMeshes: THREE.Mesh[] = [];
    expansions: { frontier: number[]; speed: number; timer: number }[] = [];
    capitalPlaced: boolean = false;
    conquestInProgress: ConquestInProgress | null = null;
    instancedHexMesh?: THREE.InstancedMesh | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.cities = [];
        this.units = [];
        this.projectiles = [];
    }

    private getBiomeColor(biome: Biome): number {
        switch (biome) {
            case 'ocean': return 0x1e40af;
            case 'coast': return 0x60a5fa;
            case 'desert': return 0xfbbf24;
            case 'land': return 0x4ade80;
            case 'mountain': return 0x6b7280;
            case 'pole': return 0xe5e7eb;
            default: return 0x4ade80;
        }
    }

    private latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = lng * (Math.PI / 180);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        return new THREE.Vector3(x, y, z);
    }

    async init() {
        console.log('World.init() started');
        let cachedDataLoaded = false;
        
        const cacheVersion = 'world-data-v7';
        
        // Try loading from localStorage first
        try {
            const cached = localStorage.getItem(cacheVersion);
            if (cached) {
                const data: WorldData = JSON.parse(cached);
                console.log('Loading world data from localStorage cache (resolution 7)...');
                this.buildWorldFromData(data);
                cachedDataLoaded = true;
            }
        } catch (e) {
            console.warn('Could not load world data from localStorage:', e);
        }
        
        if (!cachedDataLoaded) {
            console.log('Generating new world with H3 resolution 7...');
            const worldData = this.generateWorldData();
            this.buildWorldFromData(worldData);
            this.saveWorldDataToFile(worldData);
        }
        
        console.log('World.init() completed');
    }

    saveWorldDataToFile(data: WorldData) {
        const jsonString = JSON.stringify(data);
        const cacheVersion = 'world-data-v7';
        try {
            localStorage.setItem(cacheVersion, jsonString);
            console.log('World data cached (H3 resolution 7):', jsonString.length, 'bytes');
        } catch (err) {
            console.warn('Failed to cache world data:', err);
        }
    }

    generateWorldData(): WorldData {
        const resolution = 7; // Resolution 7 gives ~40,000 hexagons for balanced detail/performance
        const r = this.globeRadius;

        console.log('Generating H3 hexagons at resolution', resolution);
        
        // Generate hexagons by sampling latitude/longitude points across the globe
        const hexagonsSet = new Set<string>();
        
        // Sample points across the globe and get H3 cells
        const latStep = 2;  // Sample every 2 degrees of latitude for resolution 7
        const lngStep = 2;  // Sample every 2 degrees of longitude for resolution 7
        
        for (let lat = -85; lat <= 85; lat += latStep) {
            for (let lng = -180; lng <= 180; lng += lngStep) {
                try {
                    const cellIndex = h3.latLngToCell(lat, lng, resolution);
                    hexagonsSet.add(cellIndex);
                } catch (e) {
                    // Skip invalid cells
                }
            }
        }
        
        const hexagons = Array.from(hexagonsSet);
        console.log(`Generated ${hexagons.length} hexagons at H3 resolution ${resolution}`);

        const hexToIndex = new Map<string, number>();
        hexagons.forEach((h, i) => hexToIndex.set(h, i));

        const centers = hexagons.map(h => {
            const [lat, lng] = h3.cellToLatLng(h);
            return this.latLngToVector3(lat, lng, r);
        });

        const centerLat = hexagons.map(h => h3.cellToLatLng(h)[0]);
        const centerLng = hexagons.map(h => h3.cellToLatLng(h)[1]);

        const centerNeighbors = hexagons.map(h => {
            const neighbors = h3.gridDisk(h, 1).filter(n => n !== h);
            return neighbors.map(n => hexToIndex.get(n)!).filter(idx => idx !== undefined);
        });

        const centerWater: boolean[] = [];
        const biomes: Biome[] = [];
        const elevations: number[] = [];

        // Improved noise function using Perlin-like multi-scale noise
        const fract = (v: number) => v - Math.floor(v);
        const hash = (x: number) => fract(Math.sin(x) * 43758.5453123);
        
        // Multi-octave noise for realistic terrain
        const getElevation = (lat: number, lon: number): number => {
            // Primary continental noise at large scale
            const continental = 0.5 * (Math.sin(lon * 0.5) * Math.cos(lat * 0.4) + 1);
            
            // Mountain ranges at medium scale
            const mountains = 0.3 * (Math.sin(lon * 2.1 + 10) * Math.cos(lat * 1.8 + 5) + 1);
            
            // Local variation
            const local = 0.2 * hash(lon * 15.7 + lat * 12.3);
            
            let elevation = continental * 0.5 + mountains * 0.35 + local * 0.15;
            
            // Latitude modifier - higher at poles
            const latFactor = Math.abs(lat) / 90;
            elevation = Math.max(0, Math.min(1, elevation + latFactor * 0.15));
            
            return Math.max(0, Math.min(1, elevation));
        };

        for (let i = 0; i < centers.length; i++) {
            const lat = centerLat[i];
            const lon = centerLng[i];
            
            const elevation = getElevation(lat, lon);
            const isPole = Math.abs(lat) > 70;

            let biome: Biome = 'land';
            if (isPole) {
                biome = 'pole';
            } else if (elevation < 0.4) {
                biome = 'ocean';
            } else if (elevation < 0.45) {
                biome = 'coast';
            } else if (elevation > 0.75) {
                biome = 'mountain';
            } else {
                // Determine desert vs forest based on latitude and local noise
                const latitude_dryness = Math.abs(lat) > 30 ? 0.3 : 0.0; // Deserts at high latitudes
                const local_dry = hash(lon * 8.5 + lat * 3.2);
                const dryness = latitude_dryness + local_dry * 0.4;
                biome = dryness > 0.5 ? 'desert' : 'land';
            }
            
            biomes[i] = biome;
            elevations[i] = elevation;
            centerWater[i] = (biome === 'ocean');
        }

        return {
            centers: centers.map(c => ({ x: c.x, y: c.y, z: c.z })),
            centerNeighbors,
            centerWater,
            centerLat,
            centerLng,
            hexagons,
            biomes,
            elevations,
        };
    }

    buildWorldFromData(data: WorldData) {
        this.centers = data.centers.map(c => new THREE.Vector3(c.x, c.y, c.z));
        this.centerNeighbors = data.centerNeighbors;
        this.centerWater = data.centerWater;
        this.centerLat = data.centerLat;
        this.centerLng = data.centerLng;
        this.hexagons = data.hexagons;
        this.biomes = data.biomes;
        this.elevations = data.elevations;
        this.centerOwned = new Array(this.centers.length).fill(false);

        const sphereGeo = new THREE.SphereGeometry(this.globeRadius, 64, 32);
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9, metalness: 0.0 });
        const globe = new THREE.Mesh(sphereGeo, sphereMat);
        globe.receiveShadow = true;
        globe.castShadow = false;
        this.globe = globe;
        this.scene.add(globe);

        // Use an InstancedMesh to reduce draw calls and avoid per-mesh state bugs.
        this.hexMeshes = [];

        const cylinderGeometry = new THREE.CylinderGeometry(6, 6, 1, 6);
        const material = new THREE.MeshStandardMaterial({ 
            flatShading: true,
            roughness: 0.8,
            metalness: 0.0,
            vertexColors: true,
        });

        const count = this.centers.length;
        const inst = new THREE.InstancedMesh(cylinderGeometry, material, count);
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const epsilon = 0.2; // small offset to avoid z-fighting with globe

        for (let i = 0; i < count; i++) {
            const center = this.centers[i];
            const biome = this.biomes[i];
            const elevation = this.elevations[i];

            const normal = center.clone().normalize();

            const heightScale = biome === 'mountain' ? 1.2 + elevation * 0.3 : 1 + elevation * 0.1;

            // Position instance so base sits on the globe surface (translate outward by half the height)
            const worldPos = normal.clone().multiplyScalar(this.globeRadius + (heightScale * 0.5) + epsilon);

            dummy.position.copy(worldPos);
            dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            dummy.scale.set(1, heightScale, 1);
            dummy.updateMatrix();

            inst.setMatrixAt(i, dummy.matrix);

            // Set color per instance
            color.setHex(this.getBiomeColor(biome));
            if (!inst.instanceColor) inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
            inst.setColorAt(i, color);
        }

        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

        this.instancedHexMesh = inst;
        this.scene.add(inst);
        console.log(`Built instanced mesh with ${count} instances`);
    }



    initGame() {
        console.log('Game Initialized');
        this.capitalPlaced = false;
    }

    spawnCityAtIndex(centerIdx: number, name: string) {
        const pos = this.centers[centerIdx].clone().normalize().multiplyScalar(this.globeRadius + 6);

        const geometry = new THREE.BoxGeometry(6, 8, 6);
        const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const city = new THREE.Mesh(geometry, material);
        city.position.copy(pos);
        city.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
        city.castShadow = true;
        city.receiveShadow = true;
        this.scene.add(city);

        const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 10, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.copy(pos).add(pos.clone().normalize().multiplyScalar(6));
        pole.quaternion.copy(city.quaternion);
        this.scene.add(pole);

        const flagGeo = new THREE.PlaneGeometry(6, 4);
        const flagMat = new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(pole.quaternion).multiplyScalar(3);
        flag.position.copy(pole.position).add(right);
        flag.quaternion.copy(pole.quaternion);
        this.scene.add(flag);

        this.cities.push({ mesh: city, name, health: 100 });

        this.centerOwned[centerIdx] = true;
        this.territorySize++;
        const hex = this.hexMeshes[centerIdx];
        if (hex) {
            (hex.material as THREE.MeshStandardMaterial).color.set(0x3366ff);
        }
    }

    placeCapital(intersection: any): boolean {
        if (!intersection || !intersection.point) return false;
        if (this.capitalPlaced) return false; // Only one capital allowed
        
        const pt: THREE.Vector3 = intersection.point;

        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return false;
        if (this.centerWater[best]) return false;

        this.capitalPlaced = true;
        this.spawnCityAtIndex(best, 'Capital');
        return true;
    }

    isSea(input: any) {
        let pt: THREE.Vector3 | null = null;
        if (input && input.point) pt = input.point as THREE.Vector3;
        else if (input instanceof THREE.Vector3) pt = input;
        if (!pt) return true;

        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return true;
        return !!this.centerWater[best];
    }

    startExpansion(intersection: any, troopsToSend: number): boolean {
        if (!intersection || !intersection.point) return false;
        if (troopsToSend <= 0) return false;
        
        const pt: THREE.Vector3 = intersection.point;

        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return false;

        if (this.centerWater[best]) return false;
        if (this.centerOwned[best]) return false; // Already owned

        const anyOwned = this.centerOwned.some(v => v);
        if (anyOwned) {
            const neigh = this.centerNeighbors[best] || [];
            const adjacent = neigh.some(n => this.centerOwned[n]);
            if (!adjacent) return false; // Must be adjacent to owned territory
        }

        // Start conquest with time based on troops sent
        // More troops = faster conquest. Base time is 3 seconds, reduced by troop count
        const baseConquestTime = 3.0;
        const troopBonus = Math.min(2.0, troopsToSend / 100); // Bonus multiplier capped at 2x speed
        const totalTimeNeeded = baseConquestTime / troopBonus;
        
        this.conquestInProgress = {
            hexIndex: best,
            troopsAllocated: troopsToSend,
            timeElapsed: 0,
            totalTimeNeeded
        };
        
        return true;
    }

    attack(intersection: THREE.Intersection) {
        console.log('attack called', intersection);
    }

    completeConquest() {
        if (!this.conquestInProgress) return;
        
        const hexIndex = this.conquestInProgress.hexIndex;
        this.centerOwned[hexIndex] = true;
        this.territorySize++;
        const hex = this.hexMeshes[hexIndex];
        if (hex) (hex.material as THREE.MeshStandardMaterial).color.set(0x3366ff);
        
        console.log(`Conquered hex ${hexIndex} with ${this.conquestInProgress.troopsAllocated} troops`);
        this.conquestInProgress = null;
    }

    update(delta: number, _gameActive: boolean) {
        // Update conquest progress
        if (this.conquestInProgress) {
            this.conquestInProgress.timeElapsed += delta;
            
            // Update hex color to show progress (gradually transition to blue)
            const progress = Math.min(1, this.conquestInProgress.timeElapsed / this.conquestInProgress.totalTimeNeeded);
            const hexIndex = this.conquestInProgress.hexIndex;
            const hex = this.hexMeshes[hexIndex];
            
            if (hex) {
                const material = hex.material as THREE.MeshStandardMaterial;
                const originalColor = new THREE.Color();
                // Interpolate from original color to claimed blue based on progress
                originalColor.setHex(0x4ade80); // Default land color
                originalColor.lerp(new THREE.Color(0x3366ff), progress);
                material.color.copy(originalColor);
            }
            
            if (this.conquestInProgress.timeElapsed >= this.conquestInProgress.totalTimeNeeded) {
                this.completeConquest();
            }
        }
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.progress += delta * p.speed;
            if (p.progress >= 1) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                if (p.onComplete) p.onComplete();
            } else {
                const pos = p.curve.getPoint(p.progress);
                p.mesh.position.copy(pos);
            }
        }
    }

    destroy() {
        for (const m of this.hexMeshes) {
            this.scene.remove(m);
            try { m.geometry.dispose(); } catch { }
            const mat = m.material as any;
            if (Array.isArray(mat)) mat.forEach((mm: any) => mm.dispose()); else if (mat) mat.dispose();
        }
        this.hexMeshes = [];
        if (this.globe) {
            this.scene.remove(this.globe);
            this.globe.geometry.dispose();
            if (Array.isArray(this.globe.material)) {
                this.globe.material.forEach(m => m.dispose());
            } else {
                this.globe.material.dispose();
            }
            this.globe = null;
        }
    }
}

