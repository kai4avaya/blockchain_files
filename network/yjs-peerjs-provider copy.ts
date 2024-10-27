import * as Y from 'yjs';
import { p2pSync } from './peer2peer_simple'; // Adjust the import path accordingly

export class YjsPeerJSProvider {
  private ydoc: Y.Doc;
  private p2pSync: typeof p2pSync;

  constructor(ydoc: Y.Doc, p2pSync: any) {
    this.ydoc = ydoc;
    this.p2pSync = p2pSync;

    // Listen for local Yjs updates and broadcast them
    this.ydoc.on('update', this.handleLocalUpdate.bind(this));

    // Handle incoming Yjs updates from peers
    this.p2pSync.setCustomMessageHandler(this.handlePeerMessage.bind(this));
  }

  private handleLocalUpdate(update: Uint8Array) {
    this.p2pSync.broadcastCustomMessage({
      type: 'yjs_update',
      data: Array.from(update),
    });
  }

  private handlePeerMessage(message: any, peerId: string) {
    if (message.type === 'yjs_update') {
      Y.applyUpdate(this.ydoc, new Uint8Array(message.data));
    }
  }
}
