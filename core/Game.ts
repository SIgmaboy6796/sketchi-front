import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './World';
import { InputManager } from './InputManager';
import { NetworkManager } from './NetworkManager';
import { useUIStore } from '../uiStore';

export class Game {
    container: HTMLElement;
    width: number;
    height: number;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: any;
    inputManager: InputManager;
    networkManager: NetworkManager;
    world: World;
    isRunning: boolean;
    money: number = 250000;
    troops: number = 500;
    troopTimer: number = 0;
    gameActive: boolean = false;
    stars: THREE.Points | null = null;

    constructor(container?: HTMLElement) {
        this.container = container || (document.getElementById('app') as HTMLElement) || document.body;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Core Three.js components
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xcccccc); // Brighter ambient light
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        this.scene.add(ambientLight);
        this.scene.add(dirLight);

        // Camera Setup
        this.camera.position.set(0, 200, 400);
        this.camera.lookAt(0, 0, 0);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 220;
        this.controls.maxDistance = 800;
        this.controls.autoRotate = true; // Spin while in menu
        this.controls.autoRotateSpeed = 2.0;

        // Subsystems
        this.inputManager = new InputManager(this.renderer.domElement, this.camera, this.scene);
        this.networkManager = new NetworkManager();
        this.world = new World(this.scene);

        // Starfield (Hidden by default)
        this.createStars();

        this.isRunning = false;
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.inputManager.domElement.addEventListener('click', () => this.onMouseClick());
        
        // Subscribe to theme changes
        useUIStore.subscribe((state: any) => this.updateTheme(state.theme));

        this.start();
    }

    createStars() {
        const starGeo = new THREE.BufferGeometry();
        const starCount = 2000;
        const posArray = new Float32Array(starCount * 3);
        
        for(let i = 0; i < starCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 2000;
        }
        
        starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const starMat = new THREE.PointsMaterial({size: 2, color: 0xffffff});
        this.stars = new THREE.Points(starGeo, starMat);
        this.stars.visible = false;
        this.scene.add(this.stars);
    }

    updateTheme(theme: 'light' | 'dark') {
        const isDark = theme === 'dark';
        this.scene.background = new THREE.Color(isDark ? 0x050505 : 0x87CEEB);
        if (this.stars) this.stars.visible = isDark;
    }

    start() {
        this.isRunning = true;
        this.renderer.setAnimationLoop(() => this.loop());
    }

    activateGame() {
        this.gameActive = true;
        this.controls.autoRotate = false; // Stop spinning if auto-rotate was on
    }

    loop() {
        const delta = 0.016; // Fixed step for now, can use clock later
        this.controls.update();
        this.world.update(delta, this.gameActive);
        
        // Troop generation: +1 every 0.1s
        if (this.gameActive) {
            this.troopTimer += delta;
            if (this.troopTimer >= 1.0) { // CHANGE THIS VALUE to slow down/speed up troops (1.0 = 1 second)
                // Troops increase based on cities and territory size
                const growth = this.world.cities.length + Math.floor(this.world.territorySize * 0.01);
                this.troops += Math.max(1, growth);
                this.troopTimer = 0;
            }
        }

        useUIStore.getState().updateStats({ troops: this.troops, cash: this.money });

        this.renderer.render(this.scene, this.camera);
    }

    onMouseClick() {
        const intersection = this.inputManager.getIntersection();
        if (!this.gameActive && intersection && intersection.object === this.world.globe) {
            const started = this.world.startExpansion(intersection, 50.0);
            if (started) {
                this.activateGame();
            }
        }
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
}
