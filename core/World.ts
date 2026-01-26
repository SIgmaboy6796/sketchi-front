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
        
        try {
            const response = await fetch('/world-data.json');
            if (response.ok) {
                const data: WorldData = await response.json();
                console.log('Loading pre-generated world data from cache...');
                this.buildWorldFromData(data);
                cachedDataLoaded = true;
            }
        } catch (e) {
            console.warn('Could not load cached world data:', e);
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
        console.log('Attempting to save world data to public/world-data.json');
        const jsonString = JSON.stringify(data);
        console.log('Data size:', jsonString.length, 'bytes');
        
        fetch('/api/save-world', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: jsonString,
        })
            .then(res => res.json())
            .then(result => {
                console.log('World data saved successfully:', result);
            })
            .catch(err => {
                console.warn('Failed to save world data to file (this is OK for development):', err);
                console.log('For production, copy this JSON to public/world-data.json:');
                console.log(jsonString);
            });
    }

    generateWorldData(): WorldData {
        const resolution = 3; // Much lower resolution = fewer hexagons
        const r = this.globeRadius;

        console.log('Generating H3 hexagons at resolution', resolution);
        const polygon = {
            type: 'Polygon',
            coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]]
        };

        const hexagons = h3.polygonToCells(polygon.coordinates[0], resolution);
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

        const fract = (v: number) => v - Math.floor(v);
        const hash = (x: number) => fract(Math.sin(x) * 43758.5453123);

        for (let i = 0; i < centers.length; i++) {
            const lat = centerLat[i];
            const lon = centerLng[i];
            let elevation: number;
            const seaLevel = 0.5;

            // Simple procedural elevation
            const e1 = 0.5 * (Math.sin(lon * 1.7) * Math.cos(lat * 0.9) + 1);
            const e2 = 0.5 * (Math.sin(lon * 3.3 + 1.2) * Math.cos(lat * 1.7) + 1);
            const e3 = hash(lon * 12.34 + lat * 5.67);
            elevation = Math.max(0, Math.min(1, e1 * 0.6 + e2 * 0.25 + e3 * 0.15));

            const isPole = Math.abs(lat) > 72;

            let biome: Biome = 'land';
            if (isPole) biome = 'pole';
            else if (elevation < seaLevel) biome = 'ocean';
            else if (elevation < seaLevel + 0.03) biome = 'coast';
            else if (elevation > 0.8) biome = 'mountain';
            else {
                const dry = hash(centers[i].x * 5.23 + centers[i].z * 1.77);
                biome = dry > 0.7 ? 'desert' : 'land';
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
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x4477aa, roughness: 0.9, metalness: 0.0, opacity: 0.0, transparent: true });
        const globe = new THREE.Mesh(sphereGeo, sphereMat);
        globe.receiveShadow = true;
        globe.castShadow = false;
        this.globe = globe;
        this.scene.add(globe);

        this.hexMeshes = [];

        // Reuse cone geometry for all hexes (much faster)
        const coneGeometry = new THREE.ConeGeometry(15, 2, 6);
        
        const biomeColors: Record<string, number> = {
            'ocean': 0x2a66aa,
            'coast': 0x88d0ff,
            'desert': 0xffdd66,
            'land': 0x88cc88,
            'mountain': 0x999999,
            'pole': 0xffffff
        };

        const materials = new Map<string, THREE.MeshStandardMaterial>();
        for (const [biome, color] of Object.entries(biomeColors)) {
            materials.set(biome, new THREE.MeshStandardMaterial({ color, flatShading: true }));
        }

        console.log(`Building ${this.centers.length} hex meshes...`);
        const startTime = performance.now();

        for (let i = 0; i < this.centers.length; i++) {
            const center = this.centers[i];
            const biome = this.biomes[i];
            const elevation = this.elevations[i];

            const mesh = new THREE.Mesh(coneGeometry, materials.get(biome) || materials.get('land')!);
            mesh.position.copy(center);
            
            // Simple rotation to point outward - use lookAt to orient the cone
            const target = center.clone().multiplyScalar(1.1);
            mesh.lookAt(target);
            mesh.rotateX(Math.PI / 2); // Adjust for cone's natural orientation
            
            // Scale based on elevation for mountains
            const scale = biome === 'mountain' ? 1 + elevation * 0.3 : 1;
            mesh.scale.set(scale, scale, scale);
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;
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

