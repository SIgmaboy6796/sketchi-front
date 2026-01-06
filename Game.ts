import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
    controls: OrbitControls;
    inputManager: InputManager;
    networkManager: NetworkManager;
    world: World;
    isRunning: boolean;
    money: number = 1000;
    troops: number = 500;

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
        this.camera.position.set(0, 100, 200);
        this.camera.lookAt(0, 0, 0);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 120;
        this.controls.maxDistance = 500;

        // Subsystems
        this.inputManager = new InputManager(this.renderer.domElement, this.camera, this.scene);
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
                const hud = document.getElementById('game-hud');
                const resources = document.getElementById('resource-display');
                
                if (menu) menu.style.display = 'none';
                if (hud) hud.style.display = 'flex';
                if (resources) resources.style.display = 'block';
                
                this.world.initGame();
            });
        }

        const attackBtn = document.getElementById('btn-attack');
        if (attackBtn) {
            attackBtn.addEventListener('click', () => {
                console.log('Attack command initiated');
                // TODO: Set game state to attack mode
            });
        }

        const buildBtn = document.getElementById('btn-build');
        if (buildBtn) {
            buildBtn.addEventListener('click', () => {
                console.log('Build command initiated');
                // TODO: Set game state to build mode
            });
        }

        // Context Menu Logic
        const contextMenu = document.getElementById('context-menu');
        
        // Right click to show menu
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const intersection = this.inputManager.getIntersection();
            
            if (intersection && contextMenu) {
                contextMenu.style.display = 'flex';
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                
                // Store the position for actions
                contextMenu.dataset.x = intersection.point.x.toString();
                contextMenu.dataset.y = intersection.point.y.toString();
                contextMenu.dataset.z = intersection.point.z.toString();
            }
        });

        // Left click to hide menu
        window.addEventListener('click', () => {
            if (contextMenu) contextMenu.style.display = 'none';
        });

        // Context Menu Actions
        document.getElementById('ctx-attack')?.addEventListener('click', () => {
            console.log("Attack ordered at", contextMenu?.dataset.x, contextMenu?.dataset.y);
            this.troops -= 10;
            this.updateResources();
        });

        document.getElementById('ctx-build')?.addEventListener('click', () => {
            console.log("Build ordered at", contextMenu?.dataset.x, contextMenu?.dataset.y);
            this.money -= 100;
            this.updateResources();
        });
    }

    updateResources() {
        const moneyEl = document.getElementById('money-counter');
        const troopEl = document.getElementById('troop-counter');
        if (moneyEl) moneyEl.innerText = `💰 ${this.money}`;
        if (troopEl) troopEl.innerText = `⚔️ ${this.troops}`;
    }

    start() {
        this.isRunning = true;
        this.renderer.setAnimationLoop(() => this.loop());
    }

    loop() {
        const delta = 0.016; // Fixed step for now, can use clock later
        this.controls.update();
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