import { initializeMarkdownEditor } from './markdownEditor.js'
import { initializeBlocks } from './blocks/manager'

export function initializeCollaborativeEditor(roomId: string, initialContent = '') {
  // First initialize the regular editor
  const editor = initializeMarkdownEditor(initialContent)
  
  // Then initialize the block system
  const blockManager = initializeBlocks(roomId)
  
  return {
    editor,
    blockManager
  }
}