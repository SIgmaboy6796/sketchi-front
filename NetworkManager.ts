export class NetworkManager {
    isConnected: boolean;

    constructor() {
        this.isConnected = false;
    }

    connect(serverUrl: string) {
        console.log(`Connecting to ${serverUrl}...`);
        // Placeholder for WebSocket connection
        // this.socket = new WebSocket(serverUrl);
        this.isConnected = true;
    }
}