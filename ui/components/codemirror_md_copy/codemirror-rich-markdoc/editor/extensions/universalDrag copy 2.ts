import { EditorView, ViewPlugin } from "@codemirror/view"
// import { StateEffect, EditorState, StateField } from "@codemirror/state"
import { processImageFile as imageUploadProcessor } from './imageUpload'

// Define the drag handler first
const universalDragHandler = EditorView.domEventHandlers({
    dragenter(event: DragEvent) {
        event.preventDefault();
        return false;
    },

    dragover(event: DragEvent, view: EditorView) {
        event.preventDefault();
        
        // Check for files in different ways
        const hasFiles = event.dataTransfer?.types.includes('Files') ||
                        (event.dataTransfer?.items && Array.from(event.dataTransfer.items).some(item => item.kind === 'file')) ||
                        (event.dataTransfer?.files && event.dataTransfer.files.length > 0);

        if (hasFiles) {
            // Visual feedback that we can handle the drop
            view.dom.classList.add('cm-file-drag-active');
        }

        // Set dropEffect based on content type
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = hasFiles ? 'copy' : 'move';
        }

        return true;
    },

    dragleave(event: DragEvent, view: EditorView) {
        view.dom.classList.remove('cm-file-drag-active');
        return false;
    },
    
    drop(event: DragEvent, view: EditorView) {
        event.preventDefault();
        view.dom.classList.remove('cm-file-drag-active');
        
        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (dropPos === null) return false;

        // Update cursor position
        view.dispatch({
            selection: { anchor: dropPos }
        });

        // Handle files from different sources
        let files: File[] = [];

        // Check DataTransfer.files
        if (event.dataTransfer?.files?.length) {
            files = Array.from(event.dataTransfer.files);
        }
        // Check DataTransfer.items
        else if (event.dataTransfer?.items?.length) {
            files = Array.from(event.dataTransfer.items)
                .filter(item => item.kind === 'file')
                .map(item => item.getAsFile())
                .filter((file): file is File => file !== null);
        }

        // Process image files
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length) {
            Promise.all(imageFiles.map(file => 
                imageUploadProcessor(file, view)
                    .catch(error => {
                        console.error('Error processing dropped image:', error);
                        // Show error to user
                        view.dispatch({
                            changes: {
                                from: dropPos,
                                insert: `\nError uploading image ${file.name}: ${error.message}\n`
                            }
                        });
                    })
            ));
            return true;
        }

        // Handle regular text drag and drop
        const plugin = view.plugin(universalDragPlugin);
        if (plugin?.dragStartPos && plugin.currentContent) {
            // Handle internal drag and drop
            if (dropPos >= plugin.dragStartPos.from && dropPos <= plugin.dragStartPos.to) {
                return false;
            }

            const contentWithNewline = plugin.isImage 
                ? plugin.currentContent + '\n'
                : plugin.currentContent;

            view.dispatch({
                changes: [
                    { from: plugin.dragStartPos.from, to: plugin.dragStartPos.to, insert: '' },
                    { from: dropPos, insert: contentWithNewline }
                ]
            });
            return true;
        }

        // Handle text from external sources
        if (event.dataTransfer?.getData('text/plain')) {
            const text = event.dataTransfer.getData('text/plain');
            view.dispatch({
                changes: { from: dropPos, insert: text }
            });
            return true;
        }

        return false;
    }
});

// Add CSS for drag feedback
const dragStyle = EditorView.theme({
    '&.cm-file-drag-active': {
        border: '2px dashed #007bff',
        borderRadius: '4px',
        background: 'rgba(0, 123, 255, 0.1)'
    }
});

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
                const img = target as HTMLImageElement
                const isMermaid = img.src.startsWith('data:image/svg+xml;base64,')
                
                const parent = target.closest('.cm-image-widget')
                if (parent) {
                    const imgPos = view.posAtDOM(parent)
                    if (imgPos !== null) {
                        const line = view.state.doc.lineAt(imgPos)
                        const text = line.text
                        const imageMatch = text.match(/!\[.*?\]\(indexdb:\/\/.*?\)/)
                        
                        if (imageMatch) {
                            const matchStart = line.from + text.indexOf(imageMatch[0])
                            const matchEnd = matchStart + imageMatch[0].length
                            
                            // Look for caption in next line
                            const nextLine = view.state.doc.lineAt(Math.min(line.to + 1, view.state.doc.length))
                            const hasCaption = nextLine.text.startsWith('*Figure:')

                            this.dragStartPos = {
                                from: matchStart,
                                to: hasCaption ? nextLine.to : matchEnd
                            }
                            this.isImage = true
                            this.currentContent = view.state.sliceDoc(
                                this.dragStartPos.from,
                                this.dragStartPos.to
                            )

                            // Only add file handling for SVG base64 images (Mermaid)
                            if (isMermaid) {
                                target.addEventListener('dragstart', (dragEvent) => {
                                    if (!dragEvent.dataTransfer) return
                                    
                                    // Create the file from base64
                                    const blob = this.base64ToBlob(img.src)
                                    const file = new File([blob], 'mermaid-diagram.svg', { type: 'image/svg+xml' })
                                    
                                    // Clear existing items
                                    for (let i = dragEvent.dataTransfer.items.length - 1; i >= 0; i--) {
                                        dragEvent.dataTransfer.items.remove(i)
                                    }
                                    
                                    // Add the file using items.add()
                                    dragEvent.dataTransfer.items.add(file)
                                    
                                    // Set additional data
                                    dragEvent.dataTransfer.setData('text/plain', this.currentContent)
                                    dragEvent.dataTransfer.setData('application/json', JSON.stringify({
                                        type: 'mermaid-diagram',
                                        content: this.currentContent
                                    }))
                                    
                                    // Set effectAllowed to all possible operations
                                    dragEvent.dataTransfer.effectAllowed = 'all'
                                }, { once: true })
                            }

                            target.draggable = true
                            view.dom.classList.add('cm-dragging-active')
                        }
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

    // Helper function to convert base64 to Blob
    private base64ToBlob(base64: string): Blob {
        const parts = base64.split(';base64,')
        const contentType = parts[0].split(':')[1] || 'image/svg+xml'
        const raw = window.atob(parts[1])
        const rawLength = raw.length
        const uInt8Array = new Uint8Array(rawLength)
        
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i)
        }
        
        return new Blob([uInt8Array], { type: contentType })
    }
}

const universalDragPlugin = ViewPlugin.fromClass(UniversalDragPlugin)

export const universalDragExtension = [
    universalDragPlugin,
    universalDragHandler,
    dragStyle
]