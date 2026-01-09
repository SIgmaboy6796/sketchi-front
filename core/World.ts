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
}

export class World {
    scene: THREE.Scene;
    cities: City[];
    units: any[];
    projectiles: Projectile[];
    globe: THREE.Mesh | null = null;
    globeRadius: number = 200;
    
    vertexNeighbors: number[][] = [];
    vertexWater: boolean[] = [];
    vertexOwned: boolean[] = [];
    colorsAttribute: THREE.BufferAttribute | null = null;
    expansions: { frontier: number[], speed: number, timer: number }[] = [];
    territorySize: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.cities = [];
        this.units = [];
        this.projectiles = [];

        this.createEnvironment();
    }

    createEnvironment() {
        // Globe
        // Use Icosahedron for uniform "pixel" distribution (Geodesic Grid)
        const geometry = new THREE.IcosahedronGeometry(this.globeRadius, 8); // Higher detail for smaller pixels
        
        const count = geometry.attributes.position.count;
        this.vertexNeighbors = new Array(count).fill(0).map(() => []);
        this.vertexWater = new Array(count).fill(false);
        this.vertexOwned = new Array(count).fill(false);
        
        const colors = new Float32Array(count * 3);
        const pos = geometry.attributes.position;
        const vec = new THREE.Vector3();

        const getTerrain = (u: number, v: number) => {
            // More complex noise for a more "earth-like" feel
            const continents = Math.sin(u * Math.PI * 2 * 2) * 0.4 + Math.sin(v * Math.PI * 3) * 0.4;
            const mountains = Math.sin(u * Math.PI * 2 * 12) * Math.sin(v * Math.PI * 18) * 0.2;
            const details = Math.sin(u * Math.PI * 2 * 30 + v * Math.PI * 30) * 0.1;
            
            const noise = continents + mountains + details;
            const isLand = noise > 0.1; // Adjust threshold for land mass
            const isIce = v < 0.1 || v > 0.9; // Smaller ice caps
            return { isLand, isIce };
        };

        for (let i = 0; i < count; i++) {
            vec.fromBufferAttribute(pos, i);
            const dir = vec.clone().normalize();
            
            // Map 3D direction to 2D noise coordinates
            const u = 0.5 + Math.atan2(dir.z, dir.x) / (2 * Math.PI);
            const v = 0.5 + Math.asin(dir.y) / Math.PI;
            
            const { isLand, isIce } = getTerrain(u, v);
            
            this.vertexWater[i] = !isLand && !isIce;

            let r = 0, g = 0, b = 0;
            if (isIce) {
                r = 1.0; g = 1.0; b = 1.0;
            } else if (isLand) {
                r = 0.13; g = 0.55; b = 0.13; // Forest Green
            } else {
                r = 0.12; g = 0.56; b = 1.0; // Blue
            }
            
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.colorsAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;

        // Build Adjacency Graph
        const index = geometry.index;
        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                const a = index.getX(i);
                const b = index.getX(i + 1);
                const c = index.getX(i + 2);
                this.addNeighbor(a, b);
                this.addNeighbor(b, c);
                this.addNeighbor(c, a);
            }
        }

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });
        
        const globe = new THREE.Mesh(geometry, material);
        globe.receiveShadow = true;
        globe.castShadow = true;
        this.globe = globe;
        this.scene.add(globe);
    }

    addNeighbor(a: number, b: number) {
        if (!this.vertexNeighbors[a].includes(b)) this.vertexNeighbors[a].push(b);
        if (!this.vertexNeighbors[b].includes(a)) this.vertexNeighbors[b].push(a);
    }

    initGame() {
        console.log("Game Initialized");
        // Spawn initial cities (Lat, Lon)
        this.spawnCity(45, 0, 'Capital');
        this.spawnCity(-30, 90, 'Enemy Outpost');
    }

    spawnCity(lat: number, lon: number, name: string) {
        const radius = this.globeRadius;
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
        const projectile = new THREE.Mesh(
            new THREE.SphereGeometry(2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        
        // Calculate midpoint for the arc (higher than the surface)
        const midPoint = fromPos.clone().add(toPos).multiplyScalar(0.5).normalize().multiplyScalar(this.globeRadius + 50);
        
        const curve = new THREE.QuadraticBezierCurve3(
            fromPos,
            midPoint,
            toPos
        );

        this.scene.add(projectile);
        
        this.projectiles.push({
            mesh: projectile,
            curve: curve,
            progress: 0,
            speed: 0.5 // Speed of the nuke
        });
    }

    startExpansion(point: THREE.Vector3, speed: number): boolean {
        if (this.expansions.length > 0) return false; // Prevent multiple countries
        if (!this.globe) return false;

        // Find closest vertex to the click point
        let closestDist = Infinity;
        let closestIdx = -1;
        const pos = this.globe.geometry.attributes.position;
        const vec = new THREE.Vector3();
        const localPoint = this.globe.worldToLocal(point.clone());

        for (let i = 0; i < pos.count; i++) {
            vec.fromBufferAttribute(pos, i);
            const dist = vec.distanceToSquared(localPoint);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = i;
            }
        }

        if (closestIdx === -1) return false;
        if (this.vertexWater[closestIdx]) return false; // Can't start on water
        
        this.vertexOwned[closestIdx] = true;
        this.territorySize++;

        this.expansions.push({
            frontier: [closestIdx],
            speed: speed,
            timer: 0
        });
        return true;
    }

    update(delta: number, gameActive: boolean) {
        // Rotate globe (Menu Mode)
        if (!gameActive && this.globe) {
            this.globe.rotation.y += delta * 0.1;
            return;
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.progress += delta * p.speed;
            
            if (p.progress >= 1) {
                // Impact
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                (p.mesh.material as THREE.Material).dispose();
                this.projectiles.splice(i, 1);
                // TODO: Add explosion effect here
            } else {
                const point = p.curve.getPoint(p.progress);
                p.mesh.position.copy(point);
            }
        }

        // Update Expansions (Graph-based territory)
        if (this.expansions.length > 0 && this.colorsAttribute) {
            let needsUpdate = false;

            this.expansions.forEach(exp => {
                exp.timer += delta * exp.speed;
                
                while (exp.timer > 0.02) { // Expansion tick
                    exp.timer -= 0.02;
                    const newFrontier: number[] = [];
                    
                    for (const idx of exp.frontier) {
                        const neighbors = this.vertexNeighbors[idx];
                        for (const nIdx of neighbors) {
                            if (!this.vertexOwned[nIdx] && !this.vertexWater[nIdx]) {
                                this.vertexOwned[nIdx] = true;
                                this.territorySize++;
                                
                                // Paint Red
                                this.colorsAttribute!.setXYZ(nIdx, 1.0, 0.2, 0.2);
                                needsUpdate = true;
                                
                                newFrontier.push(nIdx);
                            }
                        }
                    }
                    
                    if (newFrontier.length > 0) {
                        exp.frontier = newFrontier;
                    }
                }
            });

            if (needsUpdate) {
                this.colorsAttribute.needsUpdate = true;
            }
        }
    }

    destroy() {
        // Dispose of all disposable objects in the scene
        (this.scene as any).traverse((object: any) => {
            if (object.isMesh) {
                object.geometry.dispose();
                if (object.material.isMaterial) {
                    object.material.dispose();
                } else if (Array.isArray(object.material)) {
                    object.material.forEach((material: any) => material.dispose());
                }
            }
        });
    }
}
