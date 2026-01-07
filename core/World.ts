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
    
    terrainData: Uint8Array | null = null;
    terrainTexture: THREE.DataTexture | null = null;
    expansions: { x: number, y: number, radius: number, speed: number, lastRadius: number }[] = [];
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
        const geometry = new THREE.SphereGeometry(this.globeRadius, 64, 64);
        
        // Generate Pixelated Terrain Texture
        const width = 256;
        const height = 128;
        const size = width * height;
        const data = new Uint8Array(4 * size);

        const getTerrain = (u: number, v: number) => {
            const noise = Math.sin(u * Math.PI * 2 * 4) + Math.sin(v * Math.PI * 4) + Math.sin(u * Math.PI * 2 * 10 + v * Math.PI * 10) * 0.5;
            const isLand = noise > 0.5;
            const isIce = v < 0.15 || v > 0.85;
            return { noise, isLand, isIce };
        };

        for (let i = 0; i < size; i++) {
            const stride = i * 4;
            const x = i % width;
            const y = Math.floor(i / width);
            
            const u = x / width;
            const v = y / height;
            
            const { isLand, isIce } = getTerrain(u, v);

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
        
        this.terrainData = data;
        this.terrainTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
        this.terrainTexture.needsUpdate = true;
        this.terrainTexture.magFilter = THREE.NearestFilter; // Pixelated look
        this.terrainTexture.minFilter = THREE.NearestFilter;

        const material = new THREE.MeshStandardMaterial({ 
            map: this.terrainTexture,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });
        
        // Displace vertices for terrain
        const pos = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        const vec = new THREE.Vector3();

        if (pos && uv) {
            for (let i = 0; i < pos.count; i++) {
                vec.fromBufferAttribute(pos, i);
                const u = uv.getX(i);
                const v = uv.getY(i);
                
                const { noise, isLand, isIce } = getTerrain(u, v);
                
                let h = 0;
                if (isIce) {
                    h = Math.random() * 2; // Small bumps
                } else if (isLand) {
                    h = (noise - 0.5) * 2; // Subtle mountains
                    if (h < 0) h = 0;
                }
                
                vec.normalize().multiplyScalar(this.globeRadius + h);
                pos.setXYZ(i, vec.x, vec.y, vec.z);
            }
        }
        
        geometry.computeVertexNormals();

        const globe = new THREE.Mesh(geometry, material);
        globe.receiveShadow = true;
        globe.castShadow = true;
        this.globe = globe;
        this.scene.add(globe);
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

    startExpansion(uv: THREE.Vector2, speed: number) {
        if (!this.terrainTexture) return;
        
        const width = this.terrainTexture.image.width;
        const height = this.terrainTexture.image.height;
        
        // Convert UV to texture coordinates
        this.expansions.push({
            x: Math.floor(uv.x * width),
            y: Math.floor(uv.y * height),
            radius: 1,
            speed: speed,
            lastRadius: 0
        });
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

        // Update Expansions (Pixel-based territory)
        if (this.expansions.length > 0 && this.terrainData && this.terrainTexture) {
            const width = this.terrainTexture.image.width;
            const height = this.terrainTexture.image.height;
            let needsUpdate = false;

            this.expansions.forEach(exp => {
                exp.radius += delta * exp.speed * 0.1;
                const r = Math.floor(exp.radius); 
                
                // Optimization: Only update if radius has grown by at least 1 pixel
                if (r <= exp.lastRadius) return;
                exp.lastRadius = r;

                const rSq = r * r;

                // Simple bounding box loop to paint pixels
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (dx*dx + dy*dy <= rSq) {
                            let px = exp.x + dx;
                            let py = exp.y + dy;

                            // Wrap X (longitude)
                            if (px < 0) px += width;
                            if (px >= width) px -= width;
                            // Clamp Y (latitude)
                            if (py < 0) py = 0;
                            if (py >= height) py = height - 1;

                            const idx = (py * width + px) * 4;
                            if (this.terrainData) {
                                // Paint Red (Territory)
                                // Check if not already territory (Green channel is 50 for territory)
                                if (this.terrainData[idx + 1] !== 50) {
                                    this.territorySize++;
                                }
                                this.terrainData[idx] = 255;     // R
                                this.terrainData[idx + 1] = 50;  // G
                                this.terrainData[idx + 2] = 50;  // B
                                needsUpdate = true;
                            }
                        }
                    }
                }
            });

            if (needsUpdate) {
                this.terrainTexture.needsUpdate = true;
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

        if (this.terrainTexture) {
            this.terrainTexture.dispose();
        }
    }
}
