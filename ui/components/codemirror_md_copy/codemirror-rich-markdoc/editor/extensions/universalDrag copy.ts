import { EditorView, ViewPlugin, DecorationSet, Decoration, WidgetType, ViewUpdate } from "@codemirror/view"
import { StateEffect, EditorState, StateField } from "@codemirror/state"

// Effect for the drop target and visual feedback
const setDropTargetEffect = StateEffect.define<{
    pos: number | null,
    height?: number
}>()

class DropTargetWidget extends WidgetType {
    constructor(readonly height: number = 20) {
        super()
    }

    toDOM() {
        const element = document.createElement('div')
        element.className = 'cm-drop-target-widget'
        element.style.height = `${this.height}px`
        return element
    }
}

class UniversalDragPlugin {
    decorations: DecorationSet
    dropTarget: number | null = null
    dragStartPos: { from: number, to: number } | null = null
    isImage: boolean = false

    constructor(view: EditorView) {
        this.decorations = Decoration.none

        view.dom.addEventListener('mousedown', (e) => {
            if (e.detail === 2) return // Allow double-click text selection
            
            const target = e.target as HTMLElement
            if (target.matches('.cm-image-widget img')) {
                const parent = target.closest('.cm-image-widget')
                if (parent) {
                    const imgPos = view.posAtDOM(parent)
                    if (imgPos !== null) {
                        const line = view.state.doc.lineAt(imgPos)
                        this.dragStartPos = { from: line.from, to: line.to }
                        this.isImage = true
                        target.draggable = true
                        view.dom.classList.add('cm-dragging-active')
                    }
                }
                return
            }

            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
            if (pos === null) return

            // Handle text selection
            const selection = view.state.selection.main
            if (!selection.empty) {
                this.dragStartPos = { from: selection.from, to: selection.to }
                this.isImage = false
                view.dom.classList.add('cm-dragging-active')
            }
        })

        view.dom.addEventListener('dragstart', (e) => {
            if (!this.dragStartPos) return
            
            const content = view.state.sliceDoc(this.dragStartPos.from, this.dragStartPos.to)
            e.dataTransfer?.setData('text/plain', content)
            e.dataTransfer?.setData('application/x-editor-range', 
                JSON.stringify(this.dragStartPos))
            e.dataTransfer?.setData('application/x-is-image', String(this.isImage))

            if (this.isImage) {
                const target = e.target as HTMLImageElement
                if (target.matches('.cm-image-widget img')) {
                    // Use the actual image as drag image
                    e.dataTransfer?.setDragImage(target, 0, 0)
                }
            } else {
                // Create text preview
                const ghost = document.createElement('div')
                ghost.className = 'cm-drag-ghost'
                ghost.textContent = content.length > 50 ? content.slice(0, 47) + '...' : content
                
                // Style the ghost element before measuring
                ghost.style.position = 'fixed'
                ghost.style.top = '-1000px' // Move off-screen for measurement
                ghost.style.left = '-1000px'
                document.body.appendChild(ghost)
                
                // Set the drag image
                e.dataTransfer?.setDragImage(ghost, 10, 10)
                
                // Remove the ghost element after a short delay
                setTimeout(() => ghost.remove(), 0)
            }
        })
    }

    update(update: ViewUpdate) {
        for (const tr of update.transactions) {
            for (const effect of tr.effects) {
                if (effect.is(setDropTargetEffect)) {
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

const universalDragHandler = EditorView.domEventHandlers({
    dragover(event: DragEvent, view: EditorView) {
        event.preventDefault()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return false

        const line = view.lineBlockAt(pos)
        view.dispatch({
            effects: setDropTargetEffect.of({ 
                pos,
                height: Math.min(line.height, 40)
            })
        })
        return true
    },

    drop(event: DragEvent, view: EditorView) {
        event.preventDefault()
        view.dom.classList.remove('cm-dragging-active')
        
        const content = event.dataTransfer?.getData('text/plain')
        const rangeStr = event.dataTransfer?.getData('application/x-editor-range')
        const isImage = event.dataTransfer?.getData('application/x-is-image') === 'true'
        
        if (!content || !rangeStr) return false

        const range = JSON.parse(rangeStr)
        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (dropPos === null) return false

        // Don't do anything if dropping at the same position
        if (dropPos >= range.from && dropPos <= range.to) {
            view.dispatch({ effects: setDropTargetEffect.of({ pos: null }) })
            return false
        }

        view.dispatch({
            changes: [
                { from: range.from, to: range.to, insert: '' },
                { from: dropPos, insert: content + (isImage ? '\n' : '') }
            ],
            effects: setDropTargetEffect.of({ pos: null })
        })
        return true
    },

    dragend(event: DragEvent, view: EditorView) {
        view.dom.classList.remove('cm-dragging-active')
        view.dispatch({
            effects: setDropTargetEffect.of({ pos: null })
        })
        return false
    }
})

const universalDragStyle = EditorView.theme({
    '.cm-drop-target-widget': {
        position: 'relative',
        borderTop: '2px solid #4f46e5',
        margin: '2px 0',
        transition: 'all 0.15s ease-in-out'
    },
    '.cm-dragging-active .cm-line': {
        transition: 'transform 0.15s ease-in-out, margin 0.15s ease-in-out'
    },
    '.cm-drag-ghost': {
        backgroundColor: 'white',
        color: '#1f2937',
        padding: '8px 12px',
        borderRadius: '6px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: '300px',
        fontSize: '14px',
        lineHeight: '1.5',
        border: '1px solid #e5e7eb',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none'
    },
    '.cm-dragging': {
        opacity: '0.5',
        backgroundColor: '#f3f4f6'
    },
    '.cm-image-widget img': {
        cursor: 'move'
    }
})

const universalDragPlugin = ViewPlugin.fromClass(UniversalDragPlugin, {
    decorations: v => v.decorations
})

export const universalDragExtension = [
    universalDragPlugin,
    universalDragStyle,
    universalDragHandler
]