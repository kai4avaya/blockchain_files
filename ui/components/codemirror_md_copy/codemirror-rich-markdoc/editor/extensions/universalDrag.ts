import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view"
// import { StateEffect, EditorState, StateField } from "@codemirror/state"
import { processImageFile as imageUploadProcessor } from './imageUpload'

// Define the drag handler first
const universalDragHandler = EditorView.domEventHandlers({
    dragover(event: DragEvent, view: EditorView) {
        console.log("dragover detected! inside of universalDragHandler")
        // Check if this is an image being dragged in from outside
        if (event.dataTransfer?.items) {
            const hasImageFile = Array.from(event.dataTransfer.items).some(item => 
                item.kind === 'file' && item.type.startsWith('image/')
            )
            if (hasImageFile) {
                // Let the image upload handler handle this
                return false
            }
        }
        
        event.preventDefault()
        event.stopPropagation()
        return true
    },
    
    drop(event: DragEvent, view: EditorView) {
        console.log("drop detected! inside of universalDragHandler")
        
        // Handle image files
        if (event.dataTransfer?.files.length) {
            const imageFiles = Array.from(event.dataTransfer.files)
                .filter(file => file.type.startsWith('image/'))
            
            if (imageFiles.length) {
                event.preventDefault()
                event.stopPropagation()
                
                const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY })
                if (dropPos === null) return false

                // Update cursor position before processing files
                view.dispatch({
                    selection: { anchor: dropPos }
                })

                // Process files using imageUpload's processor
                imageFiles.forEach(file => {
                    imageUploadProcessor(file, view)
                        .catch(error => {
                            console.error('Error processing dropped image:', error)
                        })
                })
                
                return true
            }
        }

        // Handle regular text drag and drop
        const plugin = view.plugin(universalDragPlugin)
        if (!plugin || !plugin.dragStartPos || !plugin.currentContent) {
            return false
        }

        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (dropPos === null) return false

        if (dropPos >= plugin.dragStartPos.from && dropPos <= plugin.dragStartPos.to) {
            return false
        }

        // Add newline after image content
        const contentWithNewline = plugin.isImage 
            ? plugin.currentContent + '\n'
            : plugin.currentContent

        view.dispatch({
            changes: [
                { from: plugin.dragStartPos.from, to: plugin.dragStartPos.to, insert: '' },
                { from: dropPos, insert: contentWithNewline }
            ]
        })
        
        view.dom.classList.remove('cm-dragging-active')
        return true
    }
})

class UniversalDragPlugin {
    dragStartPos: { from: number, to: number } | null = null
    currentContent: string = ''
    isImage: boolean = false

    constructor(view: EditorView) {
        this.setupDragListeners(view)
    }

    private setupDragListeners(view: EditorView) {
        view.dom.addEventListener('mousedown', (e) => {
            if (e.detail === 2) return // Allow double-click text selection
            
            const target = e.target as HTMLElement
            if (target.matches('.cm-image-widget img')) {
                // Handle image widget drag
                const parent = target.closest('.cm-image-widget')
                if (parent) {
                    const imgPos = view.posAtDOM(parent)
                    if (imgPos !== null) {
                        const line = view.state.doc.lineAt(imgPos)
                        this.dragStartPos = { from: line.from, to: line.to }
                        this.isImage = true
                        this.currentContent = view.state.sliceDoc(line.from, line.to)
                        target.draggable = true
                        view.dom.classList.add('cm-dragging-active')
                        console.log('Image drag setup:', { content: this.currentContent, pos: this.dragStartPos })
                    }
                }
                return
            }

            // Handle regular text drag
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
            if (pos === null) return

            const selection = view.state.selection.main
            if (!selection.empty) {
                this.dragStartPos = { from: selection.from, to: selection.to }
                this.isImage = false
                this.currentContent = view.state.sliceDoc(selection.from, selection.to)
            }
        })
    }
}

const universalDragPlugin = ViewPlugin.fromClass(UniversalDragPlugin)

export const universalDragExtension = [
    universalDragPlugin,
    universalDragHandler
]