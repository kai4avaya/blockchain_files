import * as Y from 'yjs';
import { p2pSync } from './peer2peer_simple'; // Adjust the import path accordingly


export class YjsPeerJSProvider {
    private ydoc: Y.Doc;
    private p2pSync: typeof p2pSync;
    private docId: string;
  
    constructor(ydoc: Y.Doc, p2pSync: any, docId: string) {
      this.ydoc = ydoc;
      this.p2pSync = p2pSync;
      this.docId = docId;
  
      // Listen for local Yjs updates
      this.ydoc.on('update', this.handleLocalUpdate.bind(this));
  
      // Handle incoming messages
      this.p2pSync.setCustomMessageHandler(this.handlePeerMessage.bind(this));
    }
  
    private handleLocalUpdate(update: Uint8Array) {
      this.p2pSync.broadcastCustomMessage({
        type: 'yjs_update',
        docId: this.docId,
        data: Array.from(update),
      });
    }
  
    updateDocId(newDocId: string) {
        this.docId = newDocId;
      }
    private handlePeerMessage(message: any, peerId: string) {
      if (message.type === 'yjs_update' && message.docId === this.docId) {
        Y.applyUpdate(this.ydoc, new Uint8Array(message.data));
      }
    }
  }
  