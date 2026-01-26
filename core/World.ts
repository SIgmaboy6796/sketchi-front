import * as THREE from 'three';
import * as h3 from 'h3-js';

// Define the City interface
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

    // Hexasphere structures
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
    // Optional landmask image for real-world map project
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
        try {
            await this.loadLandMask('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_bathymetry_4096.jpg');
            console.log('Land mask loaded successfully');
            const response = await fetch('/world-data.json');
            if (!response.ok) {
                throw new Error('world-data.json not found');
            }
            const data: WorldData = await response.json();
            console.log('Loading pre-generated world data...');
            this.buildWorldFromData(data);
        } catch (e) {
            console.warn('Failed to load land mask image, falling back to procedural generation:', e);
            console.warn('Could not load pre-generated world data. Generating a new world. To optimize, save the data from the console to public/world-data.json');
            try {
                await this.loadLandMask('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_bathymetry_4096.jpg');
                console.log('Land mask loaded successfully for generation.');
            } catch (err) {
                console.warn('Failed to load land mask image, falling back to procedural generation:', err);
            }
            const worldData = this.generateWorldData();
            this.buildWorldFromData(worldData);
            this.saveGeneratedDataToConsole(worldData);
        }
        console.log('Starting createEnvironment()');
        this.createEnvironment();
        console.log('World.init() completed');
    }

    createEnvironment() {
        // Base globe (visual)
        const sphereGeo = new THREE.SphereGeometry(this.globeRadius, 64, 32);
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x4477aa, roughness: 0.9, metalness: 0.0, opacity: 0.0, transparent: true });
        const globe = new THREE.Mesh(sphereGeo, sphereMat);
        globe.receiveShadow = true;
        globe.castShadow = false;
        this.globe = globe;
        this.scene.add(globe);
    saveGeneratedDataToConsole(data: WorldData) {
        console.log('--- WORLD DATA TO CACHE ---');
        console.log('Copy the following JSON and save it as `public/world-data.json` in your project to speed up loading times.');
        console.log(JSON.stringify(data));
        console.log('---------------------------');
    }

        // Create H3-based hexagonal grid on the sphere
        this.centers = [];
        this.centerNeighbors = [];
        this.centerWater = [];
        this.centerOwned = [];
        this.hexMeshes = [];

    generateWorldData(): WorldData {
        const resolution = 6;
        const r = this.globeRadius;

        // Define a polygon covering the entire globe
        const polygon = {
            type: 'Polygon',
            coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]]
        };

        // Get all H3 hexagons at the specified resolution within the polygon
        const hexagons = h3.polygonToCells(polygon.coordinates[0], resolution);

        // Create mapping from H3 index to array index
        const hexToIndex = new Map<string, number>();
        hexagons.forEach((h, i) => hexToIndex.set(h, i));

        // Generate centers from H3 hexagon centers
        this.centers = hexagons.map(h => {
        const centers = hexagons.map(h => {
            const [lat, lng] = h3.cellToLatLng(h);
            return this.latLngToVector3(lat, lng, r);
        });

        this.centerLat = hexagons.map(h => h3.cellToLatLng(h)[0]);
        this.centerLng = hexagons.map(h => h3.cellToLatLng(h)[1]);
        this.hexagons = hexagons;
        const centerLat = hexagons.map(h => h3.cellToLatLng(h)[0]);
        const centerLng = hexagons.map(h => h3.cellToLatLng(h)[1]);

        // Build neighbor lists using H3
        this.centerNeighbors = hexagons.map(h => {
        const centerNeighbors = hexagons.map(h => {
            const neighbors = h3.gridDisk(h, 1).filter(n => n !== h);
            return neighbors.map(n => hexToIndex.get(n)!).filter(idx => idx !== undefined);
        });

        this.centerWater = this.centers.map(() => false);
        this.centerOwned = new Array(this.centers.length).fill(false);
        const centerWater: boolean[] = [];
        const biomes: Biome[] = [];
        const elevations: number[] = [];

        // Helper function for land mask sampling with bilinear interpolation
        const sampleBrightness = (u: number, v: number): number => {
            const x = u * this.landImg!.width;
            const y = v * this.landImg!.height;
            const x0 = Math.floor(x);
            const y0 = Math.floor(y);
            const x1 = Math.min(x0 + 1, this.landImg!.width - 1);
            const y1 = Math.min(y0 + 1, this.landImg!.height - 1);
            const fx = x - x0;
            const fy = y - y0;
            const data00 = this.landCtx!.getImageData(x0, y0, 1, 1).data;
            const data01 = this.landCtx!.getImageData(x0, y1, 1, 1).data;
            const data10 = this.landCtx!.getImageData(x1, y0, 1, 1).data;
            const data11 = this.landCtx!.getImageData(x1, y1, 1, 1).data;
            const b00 = (data00[0] + data00[1] + data00[2]) / (3 * 255);
            const b01 = (data01[0] + data01[1] + data01[2]) / (3 * 255);
            const b10 = (data10[0] + data10[1] + data10[2]) / (3 * 255);
            const b11 = (data11[0] + data11[1] + data11[2]) / (3 * 255);
            const b0 = b00 * (1 - fx) + b10 * fx;
            const b1 = b01 * (1 - fx) + b11 * fx;
            return b0 * (1 - fy) + b1 * fy;
        };

        // Helper noise function (deterministic)
        const hash = (x: number) => {
            return fract(Math.sin(x) * 43758.5453123);
        };
        const hash = (x: number) => fract(Math.sin(x) * 43758.5453123);
        function fract(v: number) { return v - Math.floor(v); }

        // Create each hex as a prism mesh using H3 boundaries
        const hexDepth = 2;
        for (let i = 0; i < this.centers.length; i++) {
            const center = this.centers[i].clone();

            // Use H3 boundary for vertices
            const hexagon = this.hexagons[i];
            const boundary = h3.cellToBoundary(hexagon);

            // Compute spherical coordinates for more realistic continents
            const lat = this.centerLat[i];
            const lon = this.centerLng[i];

            // If land image is provided, sample it to derive land/water and elevation
        for (let i = 0; i < centers.length; i++) {
            const lat = centerLat[i];
            const lon = centerLng[i];
            let elevation: number;
            const seaLevel = 0.5; // aligned with brightness > 0.5 for land
            const seaLevel = 0.5;
            if (this.landCtx && this.landImg) {
                const u = (lon / (Math.PI * 2) + 0.5) % 1; // 0..1
                const v = 0.5 - lat / Math.PI; // 0..1
                // map brightness to elevation
                const u = (h3.degsToRads(lon) / (Math.PI * 2) + 0.5);
                const v = 0.5 - h3.degsToRads(lat) / Math.PI;
                elevation = sampleBrightness(u, v);
            } else {
                // Elevation via simple layered trig-based noise (deterministic, approximates continents)
                const e1 = 0.5 * (Math.sin(lon * 1.7) * Math.cos(lat * 0.9) + 1);
                const e2 = 0.5 * (Math.sin(lon * 3.3 + 1.2) * Math.cos(lat * 1.7) + 1);
                const e3 = hash(lon * 12.34 + lat * 5.67);
                elevation = Math.max(0, Math.min(1, e1 * 0.6 + e2 * 0.25 + e3 * 0.15));
            }
            const isPole = Math.abs(lat) > (Math.PI * 0.4);

            // classify biome
            let biome: 'ocean'|'coast'|'desert'|'land'|'mountain'|'pole' = 'land';
            elevations[i] = elevation;
            const isPole = Math.abs(lat) > 72;
            let biome: Biome = 'land';
            if (isPole) biome = 'pole';
            else if (elevation < seaLevel) biome = 'ocean';
            else if (elevation < seaLevel + 0.03) biome = 'coast';
            else if (elevation > 0.8) biome = 'mountain';
            else {
                const dry = hash(center.x * 5.23 + center.z * 1.77);
                const dry = hash(centers[i].x * 5.23 + centers[i].z * 1.77);
                biome = dry > 0.7 ? 'desert' : 'land';
            }
            biomes[i] = biome;
            centerWater[i] = (biome === 'ocean');
        }

        return { centers: centers.map(c=>({x: c.x, y: c.y, z: c.z})), centerNeighbors, centerWater, centerLat, centerLng, hexagons, biomes, elevations };
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

        // Base globe (visual)
        const sphereGeo = new THREE.SphereGeometry(this.globeRadius, 64, 32);
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x4477aa, roughness: 0.9, metalness: 0.0, opacity: 0.0, transparent: true });
        const globe = new THREE.Mesh(sphereGeo, sphereMat);
        globe.receiveShadow = true;
        globe.castShadow = false;
        this.globe = globe;
        this.scene.add(globe);

        this.hexMeshes = [];
        const r = this.globeRadius;

        // Create each hex as a prism mesh using H3 boundaries
        const hexDepth = 2;
        for (let i = 0; i < this.centers.length; i++) {
            // Use H3 boundary for vertices
            const hexagon = this.hexagons[i];
            const boundary = h3.cellToBoundary(hexagon);
            const biome = this.biomes[i];
            const elevation = this.elevations[i];

            // determine top radius (height)
            let topR = r + (biome === 'mountain' ? 8 + elevation * 12 : elevation * 3);
            if (biome === 'ocean' || biome === 'coast') topR = r - 1; // slightly inset for water

            // build vertices from H3 boundary projected to topR
            const vertsTop: THREE.Vector3[] = boundary.map(([bLat, bLng]) => this.latLngToVector3(bLat, bLng, topR));

            // bottom verts slightly inset towards sphere center
            const vertsBottom: THREE.Vector3[] = vertsTop.map(v => v.clone().normalize().multiplyScalar(r - hexDepth));

            // Build BufferGeometry for prism
            const geom = new THREE.BufferGeometry();
            const positionsArr: number[] = [];
            const indicesArr: number[] = [];

            // push top verts
            for (const v of vertsTop) positionsArr.push(v.x, v.y, v.z);
            // push bottom verts
            for (const v of vertsBottom) positionsArr.push(v.x, v.y, v.z);

            const numSides = vertsTop.length;

            // top center index for fan
            const topCenter = vertsTop.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / numSides);
            const topCenterIdx = positionsArr.length / 3;
            positionsArr.push(topCenter.x, topCenter.y, topCenter.z);

            // indices: top face
            for (let kIdx = 0; kIdx < numSides; kIdx++) {
                const a = topCenterIdx;
                const b = kIdx;
                const c = (kIdx + 1) % numSides;
                indicesArr.push(a, b, c);
            }

            const baseOffset = 0;
            const bottomOffset = numSides;

            // side faces (quads -> two triangles)
            for (let kIdx = 0; kIdx < numSides; kIdx++) {
                const a = baseOffset + kIdx;
                const b = baseOffset + ((kIdx + 1) % numSides);
                const c = bottomOffset + ((kIdx + 1) % numSides);
                const d = bottomOffset + kIdx;
                indicesArr.push(a, b, c);
                indicesArr.push(a, c, d);
            }

            // bottom face (optional cap)
            const bottomCenter = vertsBottom.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / numSides);
            const bottomCenterIdx = positionsArr.length / 3;
            positionsArr.push(bottomCenter.x, bottomCenter.y, bottomCenter.z);
            for (let kIdx = 0; kIdx < numSides; kIdx++) {
                const a = bottomCenterIdx;
                const b = bottomOffset + ((kIdx + 1) % numSides);
                const c = bottomOffset + kIdx;
                indicesArr.push(a, b, c);
            }

            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positionsArr), 3));
            geom.setIndex(indicesArr);
            geom.computeVertexNormals();

            // color/material based on biome
            let matColor = 0x88cc88;
            if (biome === 'ocean') matColor = 0x2a66aa;
            else if (biome === 'coast') matColor = 0x88d0ff;
            else if (biome === 'desert') matColor = 0xffdd66;
            else if (biome === 'mountain') matColor = 0x999999;
            else if (biome === 'pole') matColor = 0xffffff;

            const mat = new THREE.MeshStandardMaterial({ color: matColor, flatShading: true });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { index: i, biome };
            this.scene.add(mesh);
            this.hexMeshes.push(mesh);

            // mark water
            this.centerWater[i] = (biome === 'ocean');
        }

    }

    // Load an equirectangular land/height image (RGBA) to base the map on real-world data.
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
        // Initialization complete. Capital placement is manual via UI (right-click -> build).
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

        // Flag
        const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 10, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.copy(pos).add(pos.clone().normalize().multiplyScalar(6));
        pole.quaternion.copy(city.quaternion);
        this.scene.add(pole);

        const flagGeo = new THREE.PlaneGeometry(6, 4);
        const flagMat = new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        // compute a right-vector from pole quaternion and offset the flag
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(pole.quaternion).multiplyScalar(3);
        flag.position.copy(pole.position).add(right);
        flag.quaternion.copy(pole.quaternion);
        this.scene.add(flag);

        this.cities.push({ mesh: city, name, health: 100 });

        // Mark tile owned
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

        // find nearest center
        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return false;
        if (this.centerWater[best]) return false; // can't place in ocean

        // Place capital at this hex
        this.spawnCityAtIndex(best, 'Capital');
        return true;
    }

    // Accept either an Intersection or a Vector3
    isSea(input: any) {
        let pt: THREE.Vector3 | null = null;
        if (input && input.point) pt = (input.point as THREE.Vector3);
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

        // Find nearest center
        let best = -1;
        let bestd = Infinity;
        for (let i = 0; i < this.centers.length; i++) {
            const d = pt.distanceToSquared(this.centers[i]);
            if (d < bestd) { bestd = d; best = i; }
        }
        if (best === -1) return false;

        if (this.centerWater[best]) return false;

        // If no owned tiles yet, allow starting anywhere. Otherwise only allow if adjacent to owned.
        const anyOwned = this.centerOwned.some(v => v);
        if (anyOwned) {
            const neigh = this.centerNeighbors[best] || [];
            const adjacent = neigh.some(n => this.centerOwned[n]);
            if (!adjacent) return false; // can't take distant hex
        }

        // Claim single tile
        this.centerOwned[best] = true;
        this.territorySize++;
        const hex = this.hexMeshes[best];
        if (hex) (hex.material as THREE.MeshStandardMaterial).color.set(0x3366ff);
        return true;
    }

    attack(intersection: THREE.Intersection) {
        // Keep old placeholder behavior: not implemented yet
        console.log('attack called', intersection);
    }

    update(delta: number, _gameActive: boolean) {
        // No automatic expansions; captures are single-hex and handled by `startExpansion`

        // Update projectiles (simple linear progress along curves)
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
        // dispose per-hex meshes
        for (const m of this.hexMeshes) {
            this.scene.remove(m);
            try { m.geometry.dispose(); } catch {}
            const mat = m.material as any;
            if (Array.isArray(mat)) mat.forEach((mm:any)=>mm.dispose()); else if (mat) mat.dispose();
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

