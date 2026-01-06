import * as THREE from 'three';

export class InputManager {
    domElement: HTMLElement;
    camera: THREE.Camera;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;

    constructor(domElement: HTMLElement, camera: THREE.Camera) {
        this.domElement = domElement;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.domElement.addEventListener('click', (e) => this.onClick(e));
    }

    onMouseMove(event: MouseEvent) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onClick(event: MouseEvent) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // TODO: Emit event for object selection
    }
}