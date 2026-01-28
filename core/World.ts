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
    landImg?: HTMLImageElement;
    landCanvas?: HTMLCanvasElement;
    landCtx?: CanvasRenderingContext2D | null;
    capitalPlaced: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.cities = [];
        this.units = [];
        this.projectiles = [];
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
        
        // Try loading from localStorage first
        try {
            const cached = localStorage.getItem('world-data');
            if (cached) {
                const data: WorldData = JSON.parse(cached);
                console.log('Loading world data from localStorage cache...');
                this.buildWorldFromData(data);
                cachedDataLoaded = true;
            }
        } catch (e) {
            console.warn('Could not load world data from localStorage:', e);
        }
        
        // Try loading from server cache if localStorage failed
        if (!cachedDataLoaded) {
            try {
                const response = await fetch('/world-data.json');
                if (response.ok) {
                    const data: WorldData = await response.json();
                    console.log('Loading pre-generated world data from server cache...');
                    this.buildWorldFromData(data);
                    cachedDataLoaded = true;
                }
            } catch (e) {
                console.warn('Could not load cached world data from server:', e);
            }
        }
        
        if (!cachedDataLoaded) {
            console.warn('No cached world data found. Generating new world...');
            try {
                await this.loadLandMask('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_bathymetry_4096.jpg');
                console.log('Land mask loaded successfully for generation.');
            } catch (err) {
                console.warn('Failed to load land mask image, falling back to procedural generation:', err);
            }
            const worldData = this.generateWorldData();
            this.buildWorldFromData(worldData);
            this.saveWorldDataToFile(worldData);
        }
        
        console.log('World.init() completed');
    }

    saveWorldDataToFile(data: WorldData) {
        console.log('--- WORLD DATA TO CACHE ---');
        const jsonString = JSON.stringify(data);
        console.log('Generated world data size:', jsonString.length, 'bytes');
        
        // Save to localStorage
        try {
            localStorage.setItem('world-data', jsonString);
            console.log('World data saved to browser cache (localStorage)');
        } catch (err) {
            console.warn('Failed to save to localStorage:', err);
        }
        
        // Try to save to server if endpoint exists (optional)
        try {
            fetch('/api/save-world', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: jsonString,
            }).catch(() => {
                // Silently fail if endpoint doesn't exist
            });
        } catch (err) {
            // Silently fail
        }
    }

    generateWorldData(): WorldData {
        const resolution = 4; // Resolution 4 gives better coverage with ~5000 hexes
        const r = this.globeRadius;

        console.log('Generating H3 hexagons at resolution', resolution);
        
        // Generate hexagons by sampling latitude/longitude points across the globe
        const hexagonsSet = new Set<string>();
        
        // Sample points across the globe and get H3 cells
        const latStep = 5;  // Sample every 5 degrees of latitude
        const lngStep = 5;  // Sample every 5 degrees of longitude
        
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
        console.log(`Generated ${hexagons.length} hexagons`);

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

        this.hexMeshes = [];

        // Use very simple flat cylinder geometry to avoid overlap issues
        const cylinderGeometry = new THREE.CylinderGeometry(12, 12, 1, 6);
        
        const biomeColors: Record<string, number> = {
            'ocean': 0x1e40af,
            'coast': 0x60a5fa,
            'desert': 0xfbbf24,
            'land': 0x4ade80,
            'mountain': 0x6b7280,
            'pole': 0xe5e7eb
        };

        const materials = new Map<string, THREE.MeshStandardMaterial>();
        for (const [biome, color] of Object.entries(biomeColors)) {
            materials.set(biome, new THREE.MeshStandardMaterial({ 
                color, 
                flatShading: true,
                roughness: 0.8,
                metalness: 0.0
            }));
        }

        console.log(`Building ${this.centers.length} hex meshes...`);
        const startTime = performance.now();

        for (let i = 0; i < this.centers.length; i++) {
            const center = this.centers[i];
            const biome = this.biomes[i];
            const elevation = this.elevations[i];

            // Create a unique material for each mesh so color changes don't affect others
            const baseMaterial = materials.get(biome) || materials.get('land')!;
            const uniqueMaterial = baseMaterial.clone();
            
            const mesh = new THREE.Mesh(cylinderGeometry, uniqueMaterial);
            mesh.position.copy(center);
            
            // Point the cylinder outward from sphere
            const normal = center.clone().normalize();
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            
            // Scale height based on elevation (very small to avoid overlaps)
            const heightScale = biome === 'mountain' ? 1.5 + elevation * 0.5 : 1 + elevation * 0.2;
            mesh.scale.z = heightScale;
            
            // Disable shadows to reduce rendering overhead
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.userData = { index: i, biome };
            this.scene.add(mesh);
            this.hexMeshes.push(mesh);
        }
        
        const elapsed = performance.now() - startTime;
        console.log(`Built ${this.hexMeshes.length} meshes in ${elapsed.toFixed(1)}ms`);
    }

    async loadLandMask(url: string) {
        console.log('loadLandMask started for URL:', url);
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Land mask loading timeout')), 5000)
        );
        const loadPromise = new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                console.log('Land mask image loaded successfully');
                this.landImg = img;
                const c = document.createElement('canvas');
                c.width = img.width;
                c.height = img.height;
                const ctx = c.getContext('2d');
                if (!ctx) return reject(new Error('Could not create canvas context'));
                ctx.drawImage(img, 0, 0);
                this.landCanvas = c;
                this.landCtx = ctx;
                resolve();
            };
            img.onerror = (e) => {
                console.log('Land mask image failed to load', e);
                reject(e);
            };
            img.src = url;
        });
        return Promise.race([loadPromise, timeoutPromise]);
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
        const pt: THREE.Vector3 = intersection.point;

        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return false;
        if (this.centerWater[best]) return false;

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

    startExpansion(intersection: any, _speed: number): boolean {
        if (!intersection || !intersection.point) return false;
        const pt: THREE.Vector3 = intersection.point;

        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return false;

        if (this.centerWater[best]) return false;

        const anyOwned = this.centerOwned.some(v => v);
        if (anyOwned) {
            const neigh = this.centerNeighbors[best] || [];
            const adjacent = neigh.some(n => this.centerOwned[n]);
            if (!adjacent) return false;
        }

        this.centerOwned[best] = true;
        this.territorySize++;
        const hex = this.hexMeshes[best];
        if (hex) (hex.material as THREE.MeshStandardMaterial).color.set(0x3366ff);
        return true;
    }

    attack(intersection: THREE.Intersection) {
        console.log('attack called', intersection);
    }

    update(delta: number, _gameActive: boolean) {
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

