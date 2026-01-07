import * as THREE from 'three';

export class InputManager {
    domElement: HTMLElement;
    camera: THREE.Camera;
    scene: THREE.Scene;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;

    constructor(domElement: HTMLElement, camera: THREE.Camera, scene: THREE.Scene) {
        this.domElement = domElement;
        this.camera = camera;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.domElement.addEventListener('click', () => this.onClick());
    }

    onMouseMove(event: MouseEvent) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onClick() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // TODO: Emit event for object selection
    }

    getIntersection(): THREE.Intersection | null {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        return intersects.length > 0 ? intersects[0] : null;
    }
}