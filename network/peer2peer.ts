import { Peer, DataConnection } from 'peerjs';

export class P2PSync {
  private peer: Peer;
  private connections: Map<string, DataConnection> = new Map();

  constructor(private sceneState: SceneState) {
    this.peer = new Peer();
    this.peer.on('open', this.handlePeerOpen.bind(this));
    this.peer.on('connection', this.handleConnection.bind(this));
  }

  private handlePeerOpen(id: string) {
    console.log('My peer ID is: ' + id);
    // You can display this ID to the user for sharing
  }

  private handleConnection(conn: DataConnection) {
    conn.on('data', (data: ObjectState) => {
      this.sceneState.mergeUpdate(data);
    });
    this.connections.set(conn.peer, conn);
  }

  connectToPeer(peerId: string) {
    const conn = this.peer.connect(peerId);
    conn.on('open', () => {
      this.connections.set(peerId, conn);
      // Send initial state
      const fullState = this.sceneState.getSerializableState();
      conn.send(fullState);
    });
  }

  broadcastUpdate(state: ObjectState) {
    this.connections.forEach(conn => conn.send(state));
  }
}