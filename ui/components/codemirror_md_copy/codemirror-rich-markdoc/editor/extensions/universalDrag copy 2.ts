import { EditorView, ViewPlugin, DecorationSet, Decoration, WidgetType, ViewUpdate } from "@codemirror/view"
import { StateEffect, EditorState, StateField } from "@codemirror/state"

// Effect for the drop target and visual feedback
const setDropTargetEffect = StateEffect.define<{
    pos: number | null,
    height?: number,
    offset?: number
}>()

// Define the drag handler first
const universalDragHandler = EditorView.domEventHandlers({
    dragover(event: DragEvent, view: EditorView) {
        event.preventDefault()
        event.stopPropagation()
        
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return false

        // Show drop target
        const line = view.lineBlockAt(pos)
        view.dispatch({
            effects: setDropTargetEffect.of({ 
                pos,
                height: line.height
            })
        })
        
        console.log('Drag over event triggered at pos:', pos)
        return true
    },
    
    drop(event: DragEvent, view: EditorView) {
        event.preventDefault()
        event.stopPropagation()
        
        // Get the dragged content from the current plugin instance
        const plugin = view.plugin(universalDragPlugin)
        if (!plugin || !plugin.dragStartPos || !plugin.currentContent) {
            console.log('No drag content available in plugin')
            return false
        }

        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (dropPos === null) {
            console.log('Invalid drop position')
            return false
        }

        // Don't allow dropping within the selection
        if (dropPos >= plugin.dragStartPos.from && dropPos <= plugin.dragStartPos.to) {
            console.log('Dropped within selection, canceling')
            view.dispatch({ effects: setDropTargetEffect.of({ pos: null }) })
            return false
        }

        console.log('Performing drop operation', { 
            content: plugin.currentContent, 
            dropPos, 
            range: plugin.dragStartPos 
        })
        
        // Add spaces around the content unless it's an image
        const contentWithSpaces = plugin.isImage 
            ? plugin.currentContent + '\n'
            : ` ${plugin.currentContent} `
        
        // Perform the drop operation
        view.dispatch({
            changes: [
                { from: plugin.dragStartPos.from, to: plugin.dragStartPos.to, insert: '' },  // Remove from original position
                { from: dropPos, insert: contentWithSpaces }  // Insert at new position with spaces
            ],
            effects: setDropTargetEffect.of({ pos: null })
        })
        
        view.dom.classList.remove('cm-dragging-active')
        return true
    },
    
    dragend(event: DragEvent, view: EditorView) {
        event.preventDefault()
        event.stopPropagation()
        
        // Clean up
        view.dom.classList.remove('cm-dragging-active')
        view.dispatch({
            effects: setDropTargetEffect.of({ pos: null })
        })
        
        console.log('Drag end event triggered')
        return true
    }
})

class DropTargetWidget extends WidgetType {
    constructor(readonly height: number) {
        super()
    }

    toDOM() {
        const wrapper = document.createElement('div')
        wrapper.className = 'cm-drop-target-wrapper'
        
        const cursor = document.createElement('div')
        cursor.className = 'cm-drop-target-cursor'
        
        wrapper.appendChild(cursor)
        return wrapper
    }
}

// Create a state field to store the plugin instance
const dragPluginField = StateField.define<UniversalDragPlugin | null>({
    create: () => null,
    update: (value, tr) => value
})

class UniversalDragPlugin {
    decorations: DecorationSet
    dragStartPos: { from: number, to: number } | null = null
    isImage: boolean = false
    currentContent: string = ''
    dropTarget: number | null = null
    lastInsertPos: { from: number, to: number } | null = null

    constructor(view: EditorView) {
        this.decorations = Decoration.none
        
        // Make the editor draggable
        view.dom.setAttribute('draggable', 'true')
        
        console.log('UniversalDragPlugin initialized')
        
        // Setup drag listeners
        this.setupDragListeners(view)
    }

    private setupDragListeners(view: EditorView) {
        view.dom.addEventListener('mousedown', (e) => {
            console.log('mousedown event', e)
            if (e.detail === 2) return // Allow double-click text selection
            
            const target = e.target as HTMLElement
            if (target.matches('.cm-image-widget img')) {
                console.log('Found image widget')
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

            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
            if (pos === null) return

            const selection = view.state.selection.main
            if (!selection.empty) {
                this.dragStartPos = { from: selection.from, to: selection.to }
                this.isImage = false
                this.currentContent = view.state.sliceDoc(selection.from, selection.to)
                
                // Create a draggable overlay for the selection
                const selectionCoords = view.coordsAtPos(selection.from)
                const endCoords = view.coordsAtPos(selection.to)
                if (selectionCoords && endCoords) {
                    const overlay = document.createElement('div')
                    overlay.setAttribute('draggable', 'true')
                    overlay.className = 'cm-drag-overlay'
                    overlay.style.position = 'absolute'
                    overlay.style.left = `${selectionCoords.left}px`
                    overlay.style.top = `${selectionCoords.top}px`
                    overlay.style.width = `${endCoords.right - selectionCoords.left}px`
                    overlay.style.height = `${endCoords.bottom - selectionCoords.top}px`
                    overlay.style.pointerEvents = 'all'
                    overlay.style.cursor = 'move'
                    
                    view.dom.appendChild(overlay)
                    
                    // Add dragstart event listener to the overlay
                    overlay.addEventListener('dragstart', (e) => {
                        console.log('Overlay dragstart event', e)
                        if (!this.dragStartPos || !this.currentContent) {
                            console.log('No drag content available')
                            return
                        }
                        
                        e.dataTransfer?.setData('text/plain', this.currentContent)
                        e.dataTransfer?.setData('application/x-editor-range', 
                            JSON.stringify(this.dragStartPos))
                        e.dataTransfer?.setData('application/x-is-image', String(this.isImage))

                        const ghost = document.createElement('div')
                        ghost.className = 'cm-drag-ghost'
                        ghost.textContent = this.currentContent.length > 50 
                            ? this.currentContent.slice(0, 47) + '...' 
                            : this.currentContent
                        document.body.appendChild(ghost)
                        e.dataTransfer?.setDragImage(ghost, 10, 10)
                        setTimeout(() => ghost.remove(), 0)
                        
                        console.log('Drag initiated with:', { 
                            content: this.currentContent, 
                            range: this.dragStartPos,
                            isImage: this.isImage 
                        })
                    })

                    // Remove overlay after drag starts or mouseup
                    const cleanup = () => {
                        overlay.remove()
                        view.dom.removeEventListener('dragstart', cleanup)
                        view.dom.removeEventListener('mouseup', cleanup)
                    }
                    
                    view.dom.addEventListener('dragstart', cleanup)
                    view.dom.addEventListener('mouseup', cleanup)
                }
                
                view.dom.classList.add('cm-dragging-active')
                console.log('Text drag setup:', { content: this.currentContent, pos: this.dragStartPos })
            }
        })

        // Add cleanup on mouseup
        view.dom.addEventListener('mouseup', () => {
            // Remove any temporary draggable spans
            view.dom.querySelectorAll('span[draggable="true"]').forEach(span => {
                const parent = span.parentNode;
                if (parent) {
                    while (span.firstChild) {
                        parent.insertBefore(span.firstChild, span);
                    }
                    parent.removeChild(span);
                }
            });
        });
    }

    update(update: ViewUpdate) {
        for (const tr of update.transactions) {
            for (const effect of tr.effects) {
                if (effect.is(setDropTargetEffect)) {
                    console.log('Drop target effect:', effect.value)
                    this.dropTarget = effect.value.pos
                    if (this.dropTarget !== null) {
                        const widget = Decoration.widget({
                            widget: new DropTargetWidget(effect.value.height || 20),
                            side: 1
                        })
                        this.decorations = Decoration.set([widget.range(this.dropTarget)])
                    } else {
                        this.decorations = Decoration.none
                    }
                }
            }
        }
    }
}

const universalDragPlugin = ViewPlugin.fromClass(UniversalDragPlugin, {
    decorations: v => v.decorations
})

export const universalDragExtension = [
    dragPluginField,
    universalDragPlugin,
    universalDragHandler
]