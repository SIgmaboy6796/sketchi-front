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
    hexMesh: THREE.InstancedMesh | null = null;
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

        // Create hex centers using Fibonacci sphere sampling
        const N = 512; // number of hex tiles (tune for performance)
        this.centers = [];
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < N; i++) {
            const y = 1 - (2 * i) / (N - 1);
            const radius = Math.sqrt(1 - y * y);
            const theta = golden * i;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            const v = new THREE.Vector3(x, y, z).multiplyScalar(this.globeRadius);
            this.centers.push(v);
        }

        // Simple water mask: low latitudes (adjustable)
        this.centerWater = this.centers.map((c) => c.y < this.globeRadius * 0.02);
        this.centerOwned = new Array(this.centers.length).fill(false);

        // Build neighbor list using k nearest neighbors
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

        // Create a single hex geometry in XY plane (normal +Z) and use InstancedMesh
        const hexRadius = 9; // size of each hex tile in world units
        const hexGeo = new THREE.BufferGeometry();
        const verts: number[] = [];
        // Fan: center + 6 outer verts
        verts.push(0, 0, 0);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            verts.push(Math.cos(a) * hexRadius, Math.sin(a) * hexRadius, 0);
        }
        const positions = new Float32Array(verts);
        const indices: number[] = [];
        for (let i = 1; i <= 6; i++) {
            const a = i;
            const b = i % 6 + 1;
            indices.push(0, a, b);
        }
        hexGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        hexGeo.setIndex(indices);
        hexGeo.computeVertexNormals();

        const hexMat = new THREE.MeshStandardMaterial({ color: 0x999999, flatShading: true });
        const inst = new THREE.InstancedMesh(hexGeo, hexMat, this.centers.length);
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Set instance transforms and colors
        const tmpMat = new THREE.Matrix4();
        const tmpQuat = new THREE.Quaternion();
        const tmpPos = new THREE.Vector3();
        const up = new THREE.Vector3(0, 0, 1); // hex plane normal in local geometry
        for (let i = 0; i < this.centers.length; i++) {
            const pos = this.centers[i].clone();
            const normal = pos.clone().normalize();

            // Compute quaternion to rotate hex plane normal to the sphere normal
            tmpQuat.setFromUnitVectors(up, normal);

            // Slightly push out so it sits on the surface
            tmpPos.copy(normal).multiplyScalar(this.globeRadius + 0.5);

            // Small scale on Z to keep hex thin
            const scale = new THREE.Vector3(1, 1, 1);

            tmpMat.compose(tmpPos, tmpQuat, scale);
            inst.setMatrixAt(i, tmpMat);

            // initial color: water or land
            const col = this.centerWater[i] ? new THREE.Color(0x2a66aa) : new THREE.Color(0x8fbf7f);
            inst.setColorAt(i, col);
        }

        inst.instanceColor!.needsUpdate = true;
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = true;
        inst.receiveShadow = true;
        this.hexMesh = inst;
        this.scene.add(inst);
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
        if (this.hexMesh) {
            this.hexMesh.setColorAt(centerIdx, new THREE.Color(0x3366ff));
            this.hexMesh.instanceColor!.needsUpdate = true;
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

    startExpansion(intersection: any, speed: number): boolean {
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

        // Start expansion from this tile
        this.centerOwned[best] = true;
        if (this.hexMesh) {
            this.hexMesh.setColorAt(best, new THREE.Color(0x3366ff));
            this.hexMesh.instanceColor!.needsUpdate = true;
        }

        this.expansions.push({ frontier: [best], speed: Math.max(0.5, speed), timer: 0 });
        return true;
    }

    attack(intersection: THREE.Intersection) {
        // Keep old placeholder behavior: not implemented yet
        console.log('attack called', intersection);
    }

    update(delta: number, _gameActive: boolean) {
        // Process expansions
        const toAdd: { idx: number; color: THREE.Color }[] = [];
        for (const exp of this.expansions) {
            exp.timer += delta * exp.speed;
            if (exp.timer >= 0.25) {
                const newFrontier: number[] = [];
                for (const tile of exp.frontier) {
                    const neighbors = this.centerNeighbors[tile] || [];
                    for (const n of neighbors) {
                        if (this.centerOwned[n]) continue;
                        if (this.centerWater[n]) continue;
                        this.centerOwned[n] = true;
                        newFrontier.push(n);
                        toAdd.push({ idx: n, color: new THREE.Color(0x3366ff) });
                    }
                }
                exp.frontier = newFrontier;
                exp.timer = 0;
            }
        }

        if (this.hexMesh && toAdd.length > 0) {
            for (const t of toAdd) {
                this.hexMesh.setColorAt(t.idx, t.color);
            }
            this.hexMesh.instanceColor!.needsUpdate = true;
        }

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
        if (this.hexMesh) {
            this.scene.remove(this.hexMesh);
            this.hexMesh.geometry.dispose();
            if (Array.isArray(this.hexMesh.material)) {
                this.hexMesh.material.forEach(m => m.dispose());
            } else {
                this.hexMesh.material.dispose();
            }
            this.hexMesh = null;
        }
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

