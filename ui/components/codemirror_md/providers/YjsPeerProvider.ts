import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { UndoManager } from 'yjs'
import { p2pSync } from '../../../../network/peer2peer_simple'

export class YjsPeerProvider {
  private doc: Y.Doc
  protected _awareness: Awareness
  private undoManager: UndoManager

  constructor(doc: Y.Doc, roomName: string) {
    this.doc = doc
    this._awareness = new Awareness(doc)
    this.undoManager = new UndoManager(doc.getText('codemirror'), {
      trackedOrigins: new Set([doc.clientID])
    })

    this.setupAwareness()
    this.setupP2PSync(roomName)

    // Handle window unload
    window.addEventListener('beforeunload', () => {
      awarenessProtocol.removeAwarenessStates(
        this._awareness,
        [this.doc.clientID],
        'window unload'
      )
    })
  }

  private setupAwareness() {
    if (this._awareness) {
      this._awareness.setLocalState({
        user: {
          name: `User-${Math.floor(Math.random() * 10000)}`,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
        },
        cursor: null
      })
    }
  }

  private setupP2PSync(roomName: string) {
    p2pSync.setCustomMessageHandler((message: any, peerId: string) => {
      if (message.type === 'yjs_update') {
        Y.applyUpdate(this.doc, new Uint8Array(message.data))
      } else if (message.type === 'yjs_awareness') {
        awarenessProtocol.applyAwarenessUpdate(
          this._awareness,
          new Uint8Array(message.data),
          peerId
        )
      }
    })

    this.doc.on('update', (update: Uint8Array) => {
      p2pSync.broadcastCustomMessage({
        type: 'yjs_update',
        data: Array.from(update)
      })
    })

    // Send awareness updates using the correct protocol
    this._awareness.on('update', ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed)
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        this._awareness,
        changedClients
      )
      p2pSync.broadcastCustomMessage({
        type: 'yjs_awareness',
        data: Array.from(awarenessUpdate)
      })
    })

    // Handle new peer connections
    p2pSync.onPeerConnect((peerId: string) => {
      // Send document state
      const state = Y.encodeStateAsUpdate(this.doc)
      p2pSync.sendCustomMessage(peerId, {
        type: 'yjs_update',
        data: Array.from(state)
      })

      // Send complete awareness state for all clients
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        this._awareness,
        Array.from(this._awareness.getStates().keys())
      )
      p2pSync.sendCustomMessage(peerId, {
        type: 'yjs_awareness',
        data: Array.from(awarenessUpdate)
      })
    })
  }

  updateCursor(anchor: number, head: number) {
    const currentState = this._awareness.getLocalState()
    this._awareness.setLocalState({
      ...currentState,
      cursor: { anchor, head }
    })
  }

  get awareness() {
    return this._awareness
  }

  destroy() {
    // Mark all remote clients as offline
    awarenessProtocol.removeAwarenessStates(
      this._awareness,
      Array.from(this._awareness.getStates().keys())
        .filter(client => client !== this.doc.clientID),
      'connection closed'
    )
    
    this.undoManager.destroy()
    this._awareness.destroy()
  }
}