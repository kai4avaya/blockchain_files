import { BlockSync } from './sync'
import { getMarkdownEditor } from '../markdownEditor.js'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'

export class BlockManager {
  private sync: BlockSync
  private updateTimeout: NodeJS.Timeout | null = null

  constructor(roomId: string) {
    this.sync = new BlockSync(roomId)
    this.setupEditorListeners()
  }

  private setupEditorListeners(): void {
    const editor = getMarkdownEditor()
    if (!editor) return

    // Add listener for editor changes
    editor.dispatch({
      effects: EditorState.transactionExtender.of(tr => {
        if (!tr.docChanged) return null
        
        // Debounce updates to avoid too frequent syncs
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout)
        }
        
        this.updateTimeout = setTimeout(() => {
          this.sync.syncFromEditor()
        }, 500)
        
        return null
      })
    })
  }

  // Method to manually trigger sync
  forceSyncFromEditor(): void {
    this.sync.syncFromEditor()
  }

  destroy(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout)
    }
    this.sync.destroy()
  }
}

// Export a function to initialize the block system
export function initializeBlocks(roomId: string): BlockManager {
  return new BlockManager(roomId)
}