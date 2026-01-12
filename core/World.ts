import * as THREE from 'three';

// Define the City interface
export interface City {
    mesh: THREE.Mesh;
    name: string;
    health: number;
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
    globeRadius: number = 200;
    territorySize: number = 0;

    // Hexasphere structures
    centers: THREE.Vector3[] = [];
    centerNeighbors: number[][] = [];
    centerWater: boolean[] = [];
    centerOwned: boolean[] = [];
    hexMeshes: THREE.Mesh[] = [];
    expansions: { frontier: number[]; speed: number; timer: number }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.cities = [];
        this.units = [];
        this.projectiles = [];

        this.createEnvironment();
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

        // Create spherical hex grid using latitudinal bands and staggered columns
        this.centers = [];
        this.centerNeighbors = [];
        this.centerWater = [];
        this.centerOwned = [];
        this.hexMeshes = [];

        const latBands = 32; // more bands -> more hexes
        const colsBase = 64; // approximate columns at equator
        const hexRadius = 9; // controls tile spacing
        const r = this.globeRadius;

        const centersTemp: THREE.Vector3[] = [];
        for (let iy = -latBands; iy <= latBands; iy++) {
            const v = iy / latBands; // -1..1
            const lat = v * (Math.PI / 2); // -pi/2..pi/2
            const cosLat = Math.cos(lat);
            const cols = Math.max(6, Math.round(colsBase * cosLat));
            const offset = (iy % 2) ? (Math.PI / cols) : 0;
            for (let ix = 0; ix < cols; ix++) {
                const lon = (ix / cols) * Math.PI * 2 + offset;
                const x = Math.cos(lat) * Math.cos(lon);
                const y = Math.sin(lat);
                const z = Math.cos(lat) * Math.sin(lon);
                centersTemp.push(new THREE.Vector3(x * r, y * r, z * r));
            }
        }

        // Assign centers
        this.centers = centersTemp;
        this.centerWater = this.centers.map(() => false);
        this.centerOwned = new Array(this.centers.length).fill(false);

        // Build approximate neighbor list: find 6 nearest
        const k = 6;
        this.centerNeighbors = this.centers.map(() => []);
        for (let i = 0; i < this.centers.length; i++) {
            const dists: { idx: number; d2: number }[] = [];
            for (let j = 0; j < this.centers.length; j++) {
                if (i === j) continue;
                dists.push({ idx: j, d2: this.centers[i].distanceToSquared(this.centers[j]) });
            }
            dists.sort((a, b) => a.d2 - b.d2);
            this.centerNeighbors[i] = dists.slice(0, k).map(d => d.idx);
        }

        // Helper noise function (deterministic)
        const hash = (x: number) => {
            return fract(Math.sin(x) * 43758.5453123);
        };
        function fract(v: number) { return v - Math.floor(v); }

        // Create each hex as a prism mesh based on tangent plane vertices
        const hexDepth = 2;
        for (let i = 0; i < this.centers.length; i++) {
            const center = this.centers[i].clone().normalize();

            // Local tangent basis
            const north = new THREE.Vector3(0, 1, 0);
            let tangent = new THREE.Vector3().crossVectors(north, center);
            if (tangent.lengthSq() < 1e-6) tangent = new THREE.Vector3(1, 0, 0);
            tangent.normalize();
            const bitangent = new THREE.Vector3().crossVectors(center, tangent).normalize();

            // Elevation via simple noise
            const nval = hash(center.x * 12.9898 + center.y * 78.233 + center.z * 37.719);
            const nval2 = hash(center.x * 93.9898 + center.y * 67.345 + center.z * 24.123);
            const elevation = nval * 0.7 + nval2 * 0.3; // 0..1
            const seaLevel = 0.35;
            const isPole = Math.abs(center.y) > 0.88;

            // classify biome
            let biome: 'ocean'|'coast'|'desert'|'land'|'mountain'|'pole' = 'land';
            if (isPole) biome = 'pole';
            else if (elevation < seaLevel) biome = 'ocean';
            else if (elevation < seaLevel + 0.03) biome = 'coast';
            else if (elevation > 0.8) biome = 'mountain';
            else {
                const dry = hash(center.x * 5.23 + center.z * 1.77);
                biome = dry > 0.7 ? 'desert' : 'land';
            }

            // determine top radius (height)
            let topR = r + (biome === 'mountain' ? 8 + elevation * 12 : elevation * 3);
            if (biome === 'ocean' || biome === 'coast') topR = r - 1; // slightly inset for water

            // build 6 vertices around center in tangent plane
            const vertsTop: THREE.Vector3[] = [];
            for (let kIdx = 0; kIdx < 6; kIdx++) {
                const ang = (kIdx / 6) * Math.PI * 2;
                const local = tangent.clone().multiplyScalar(Math.cos(ang) * hexRadius).add(bitangent.clone().multiplyScalar(Math.sin(ang) * hexRadius));
                const worldPos = center.clone().multiplyScalar(r).add(local).normalize().multiplyScalar(topR);
                vertsTop.push(worldPos);
            }

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

            // top center index for fan
            const topCenter = vertsTop.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / 6);
            const topCenterIdx = positionsArr.length / 3;
            positionsArr.push(topCenter.x, topCenter.y, topCenter.z);

            // indices: top face
            for (let kIdx = 0; kIdx < 6; kIdx++) {
                const a = topCenterIdx;
                const b = kIdx;
                const c = (kIdx + 1) % 6;
                indicesArr.push(a, b, c);
            }

            const baseOffset = 0;
            const bottomOffset = 6;

            // side faces (quads -> two triangles)
            for (let kIdx = 0; kIdx < 6; kIdx++) {
                const a = baseOffset + kIdx;
                const b = baseOffset + ((kIdx + 1) % 6);
                const c = bottomOffset + ((kIdx + 1) % 6);
                const d = bottomOffset + kIdx;
                indicesArr.push(a, b, c);
                indicesArr.push(a, c, d);
            }

            // bottom face (optional cap)
            const bottomCenter = vertsBottom.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / 6);
            const bottomCenterIdx = positionsArr.length / 3;
            positionsArr.push(bottomCenter.x, bottomCenter.y, bottomCenter.z);
            for (let kIdx = 0; kIdx < 6; kIdx++) {
                const a = bottomCenterIdx;
                const b = bottomOffset + ((kIdx + 1) % 6);
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

    initGame() {
        console.log('Game Initialized');
        // Choose a starting tile for the capital (prefer a land tile near top)
        let startIdx = 0;
        // try to pick a land tile near +Y hemisphere
        for (let i = 0; i < this.centers.length; i++) {
            if (!this.centerWater[i] && this.centers[i].y > 0) { startIdx = i; break; }
        }
        this.spawnCityAtIndex(startIdx, 'Capital');
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

