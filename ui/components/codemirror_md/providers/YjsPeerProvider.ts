import * as Y from 'yjs'
import { Observable } from 'lib0/observable'
import { p2pSync } from '../../../../network/peer2peer_simple'  // Import your existing P2P system
import { Awareness } from 'y-protocols/awareness'
import { IndexeddbPersistence } from 'y-indexeddb'
import { UndoManager } from 'y-codemirror.next'

export class YjsPeerProvider extends Observable<string> {
  public doc: Y.Doc
  public awareness: Awareness
  private persistence: IndexeddbPersistence
  private undoManager: UndoManager
  private synced: boolean = false

  constructor(doc: Y.Doc, roomName: string) {
    super()
    this.doc = doc
    
    // Initialize awareness
    this.awareness = new Awareness(doc)
    this.setupAwareness()
    
    // Setup persistence
    this.persistence = new IndexeddbPersistence(roomName, doc)
    this.persistence.once('synced', () => {
      this.synced = true
      this.emit('synced', [true])
    })

    // Initialize undo manager
    this.undoManager = new UndoManager(doc.getText('codemirror'), {
      trackedOrigins: new Set([this.doc.clientID])
    })

    // Set up message handlers
    p2pSync.setCustomMessageHandler((message: any, peerId: string) => {
      switch (message.type) {
        case 'yjs_sync':
          Y.applyUpdate(this.doc, new Uint8Array(message.data))
          break
        case 'yjs_sync_request':
          this.sendStateUpdate(peerId)
          break
        case 'yjs_awareness':
          this.awareness.applyUpdate(new Uint8Array(message.data))
          break
      }
    })

    // Subscribe to document updates
    this.doc.on('update', (update: Uint8Array) => {
      if (p2pSync.isConnected()) {
        p2pSync.broadcastCustomMessage({
          type: 'yjs_sync',
          data: Array.from(update)
        })
      }
    })

    // Handle awareness updates
    this.awareness.on('update', ({ added, updated, removed }) => {
      const awarenessUpdate = this.awareness.encodeUpdate(added.concat(updated))
      if (awarenessUpdate.length > 0) {
        p2pSync.broadcastCustomMessage({
          type: 'yjs_awareness',
          data: Array.from(awarenessUpdate)
        })
      }
    })

    // Handle new peer connections
    p2pSync.onPeerConnect((peerId: string) => {
      this.sendStateUpdate(peerId)
      this.sendAwarenessUpdate(peerId)
    })
  }

  private setupAwareness(): void {
    // Set default user data
    this.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      cursor: null
    })

    // Clean up awareness state when user leaves
    window.addEventListener('beforeunload', () => {
      this.awareness.setLocalStateField('user', null)
    })
  }

  private sendStateUpdate(peerId: string): void {
    const state = Y.encodeStateVector(this.doc)
    p2pSync.sendCustomMessage(peerId, {
      type: 'yjs_sync_request',
      data: Array.from(state)
    })
  }

  private sendAwarenessUpdate(peerId: string): void {
    const awarenessUpdate = this.awareness.encodeUpdate([this.awareness.clientID])
    if (awarenessUpdate.length > 0) {
      p2pSync.sendCustomMessage(peerId, {
        type: 'yjs_awareness',
        data: Array.from(awarenessUpdate)
      })
    }
  }

  updateCursor(anchor: number, head: number): void {
    this.awareness.setLocalStateField('user', {
      ...this.awareness.getLocalState().user,
      cursor: { anchor, head }
    })
  }

  undo(): void {
    this.undoManager.undo()
  }

  redo(): void {
    this.undoManager.redo()
  }

  destroy(): void {
    this.awareness.destroy()
    this.persistence.destroy()
    this.undoManager.destroy()
    this.doc.off('update', this.broadcastUpdate)
    super.destroy()
  }

  private broadcastUpdate = (update: Uint8Array): void => {
    if (p2pSync.isConnected()) {
      p2pSync.broadcastCustomMessage({
        type: 'yjs_sync',
        data: Array.from(update)
      })
    }
  }
}