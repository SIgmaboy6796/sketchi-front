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
    money: number = 1000;
    troops: number = 500;
    troopTimer: number = 0;
    gameActive: boolean = false;

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
        this.camera.position.set(0, 200, 400);
        this.camera.lookAt(0, 0, 0);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 220;
        this.controls.maxDistance = 800;

        // Subsystems
        this.inputManager = new InputManager(this.renderer.domElement, this.camera, this.scene);
        this.networkManager = new NetworkManager();
        this.world = new World(this.scene);

        this.isRunning = false;
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.createMenu();
        this.start();
    }

    start() {
        this.isRunning = true;
        this.renderer.setAnimationLoop(() => this.loop());
    }

    loop() {
        const delta = 0.016; // Fixed step for now, can use clock later
        this.controls.update();
        this.world.update(delta, this.gameActive);
        
        // Troop generation: +1 every 0.1s
        if (this.gameActive) {
            this.troopTimer += delta;
            if (this.troopTimer >= 0.1) {
                this.troops += 1;
                this.troopTimer = 0;
            }
        }

        useUIStore.getState().updateStats({ troops: this.troops, cash: this.money });

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    createMenu() {
        const menu = document.createElement('div');
        menu.id = 'main-menu';
        menu.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); z-index: 100;
        `;
        
        const title = document.createElement('h1');
        title.innerText = 'SKETCHI';
        title.style.cssText = 'font-size: 80px; color: white; text-shadow: 0 0 20px rgba(0,0,0,0.5); margin-bottom: 40px; font-family: sans-serif;';
        
        const btn = document.createElement('button');
        btn.innerText = 'START GAME';
        btn.style.cssText = `
            padding: 20px 60px; font-size: 24px; border: none; border-radius: 50px;
            background: rgba(255,255,255,0.9); color: #333; cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: transform 0.2s;
        `;
        btn.onclick = () => {
            this.gameActive = true;
            menu.remove();
            this.createGameUI();
        };
        
        menu.appendChild(title);
        menu.appendChild(btn);
        this.container.appendChild(menu);
    }

    createGameUI() {
        const container = document.createElement('div');
        container.style.cssText = 'position: absolute; bottom: 40px; right: 40px; display: flex; gap: 20px;';
        
        const createBtn = (text: string, color: string) => {
            const b = document.createElement('button');
            b.innerText = text;
            b.style.cssText = `width: 80px; height: 80px; border-radius: 50%; border: none; background: ${color}; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.3);`;
            return b;
        };

        container.appendChild(createBtn('ATTACK', '#ff4757'));
        container.appendChild(createBtn('BUILD', '#2ed573'));
        this.container.appendChild(container);
    }
}
