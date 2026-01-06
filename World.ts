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
        // Ground
        const geometry = new THREE.PlaneGeometry(200, 200);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x3a7e3a,
            roughness: 0.8 
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    initGame() {
        console.log("Game Initialized");
        // Spawn initial cities
        this.spawnCity(0, 0, 'Capital');
        this.spawnCity(20, 20, 'Enemy Outpost');
    }

    spawnCity(x: number, z: number, name: string) {
        const geometry = new THREE.BoxGeometry(2, 4, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const city = new THREE.Mesh(geometry, material);
        city.position.set(x, 2, z);
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