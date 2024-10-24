import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { Block, BlockArray, BlockMap } from './types'
import { blockRegistry } from './registry'
import { getMarkdownEditor, setMarkdownContent } from '../markdownEditor.js' // Assuming this is your main editor file

export class BlockSync {
  private doc: Y.Doc
  private blocks: BlockArray
  private provider: WebrtcProvider
  
  constructor(roomId: string) {
    this.doc = new Y.Doc()
    this.blocks = this.doc.getArray('blocks')
    this.provider = new WebrtcProvider(roomId, this.doc)
    
    // Set up observers
    this.blocks.observe(this.handleBlocksChange.bind(this))
  }

  private handleBlocksChange(event: Y.YArrayEvent<BlockMap>): void {
    // Convert blocks to markdown content
    const content = this.blocksToMarkdown()
    
    // Update the editor content
    setMarkdownContent(content)
  }

  private blocksToMarkdown(): string {
    const contents: string[] = []
    
    this.blocks.forEach((block: BlockMap) => {
      const type = block.get('type') as string
      const handler = blockRegistry.getHandler(type)
      
      if (handler) {
        const content = handler.deserialize(block.get('content') as string)
        contents.push(content as string)
      }
    })
    
    return contents.join('\n\n')
  }

  createBlock(content: string, type = 'markdown'): void {
    const handler = blockRegistry.getHandler(type)
    if (!handler) return

    const block = new Y.Map() as BlockMap
    block.set('id', this.generateBlockId())
    block.set('type', type)
    block.set('version', 1)
    block.set('content', handler.serialize(content))

    this.blocks.push([block])
  }

  private generateBlockId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  // Convert editor content to blocks
  syncFromEditor(): void {
    const editor = getMarkdownEditor()
    if (!editor) return

    const content = editor.state.doc.toString()
    const blocks = content.split('\n\n').filter(Boolean)

    this.doc.transact(() => {
      this.blocks.delete(0, this.blocks.length)
      blocks.forEach(block => this.createBlock(block))
    })
  }

  destroy(): void {
    this.provider.destroy()
    this.doc.destroy()
  }
}