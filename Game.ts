import * as THREE from 'three';
import { World } from './World';
import { InputManager } from './InputManager';
import { NetworkManager } from './NetworkManager';

export class Game {
    container: HTMLElement;
    width: number;
    height: number;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    inputManager: InputManager;
    networkManager: NetworkManager;
    world: World;
    isRunning: boolean;

    constructor() {
        this.container = document.getElementById('app') as HTMLElement;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Core Three.js components
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 500);

        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x606060);
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
        this.camera.position.set(0, 30, 30);
        this.camera.lookAt(0, 0, 0);

        // Subsystems
        this.inputManager = new InputManager(this.renderer.domElement, this.camera);
        this.networkManager = new NetworkManager();
        this.world = new World(this.scene);

        this.isRunning = false;
        
        // UI Setup
        this.setupUI();
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupUI() {
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const menu = document.getElementById('main-menu');
                if (menu) menu.style.display = 'none';
                this.world.initGame();
            });
        }
    }

    start() {
        this.isRunning = true;
        this.renderer.setAnimationLoop(() => this.loop());
    }

    loop() {
        const delta = 0.016; // Fixed step for now, can use clock later
        this.world.update(delta);
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
}