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
        
        // Check for files or Mermaid diagram data
        const hasFiles = event.dataTransfer?.types.includes('Files') ||
                        event.dataTransfer?.types.includes('application/x-mermaid-file') || // Check for our specific type
                        (event.dataTransfer?.items && Array.from(event.dataTransfer.items).some(item => 
                            item.kind === 'file' || 
                            item.type === 'application/x-mermaid-file' ||
                            item.type === 'image/svg+xml'
                        )) ||
                        (event.dataTransfer?.files && event.dataTransfer.files.length > 0);

        console.log("DRAGOVER Check:", {
            hasFiles,
            types: event.dataTransfer?.types,
            hasMermaidType: event.dataTransfer?.types.includes('application/x-mermaid-file'),
            items: Array.from(event.dataTransfer?.items || []).map(item => ({
                kind: item.kind,
                type: item.type
            }))
        });

        if (hasFiles) {
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

        // Handle files
        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length > 0) {
            // Get the plugin instance
            const plugin = view.plugin(universalDragPlugin);
            
            // If we have a drag start position, remove the original content first
            if (plugin?.dragStartPos) {
                view.dispatch({
                    changes: { 
                        from: plugin.dragStartPos.from, 
                        to: plugin.dragStartPos.to, 
                        insert: '' 
                    }
                });
            }

            // Then process the new files
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    imageUploadProcessor(file, view);
                }
            });
            
            return true;
        }

        // ... rest of the code ...
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

    private base64ToBlob(base64: string): Blob {
        // Correctly parse the base64 string
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1] || 'image/svg+xml';
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
    
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
    
        return new Blob([uInt8Array], { type: contentType });
    }
    
    private setupDragListeners(view: EditorView) {
        view.dom.addEventListener('mousedown', (e) => {
            if (e.detail === 2) return; // Allow double-click text selection

            const target = e.target as HTMLElement;
            if (target.matches('.cm-image-widget img')) {
                const img = target as HTMLImageElement;
                const isMermaid = img.src.startsWith('data:image/svg+xml;base64,');
                const parent = target.closest('.cm-image-widget');

                console.log("MERMAID MOUSEDOWN isMermaid?", isMermaid);
                
                if (parent && isMermaid) {
                    try {
                        // Create the file immediately in mousedown
                        const blob = this.base64ToBlob(img.src);
                        const file = new File([blob], 'mermaid-diagram.svg', { type: 'image/svg+xml' });
                        
                        console.log("MOUSEDOWN Created file:", {
                            name: file.name,
                            size: file.size,
                            type: file.type
                        });

                        // Store the file in the instance for use in dragstart
                        const storedFile = file;  // Keep reference to file

                        // Set up dragstart with the already created file
                        target.addEventListener('dragstart', (dragEvent) => {
                            if (!dragEvent.dataTransfer) return;

                            console.log("DRAGSTART: Beginning file transfer setup");
                            
                            try {
                                // Clear existing data
                                dragEvent.dataTransfer.clearData();
                                
                                // Add the file as a file type
                                dragEvent.dataTransfer.setData('application/x-mermaid-file', 'dummy');  // Needed to register file type
                                dragEvent.dataTransfer.items.add(storedFile);
                                
                                console.log("DRAGSTART: File transfer setup complete", {
                                    file: storedFile,
                                    types: dragEvent.dataTransfer.types,
                                    items: Array.from(dragEvent.dataTransfer.items).map(item => ({
                                        kind: item.kind,
                                        type: item.type
                                    }))
                                });

                            } catch (error) {
                                console.error("Error in dragstart:", error);
                            }

                            dragEvent.dataTransfer.effectAllowed = 'copyMove';
                        }, { once: true });

                        target.draggable = true;
                        view.dom.classList.add('cm-dragging-active');
                    } catch (error) {
                        console.error("Error creating file in mousedown:", error);
                    }
                }
                return;
            }

            // Handle regular text drag
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos === null) return;
    
            const selection = view.state.selection.main;
            if (!selection.empty) {
                this.dragStartPos = { from: selection.from, to: selection.to };
                this.isImage = false;
                this.currentContent = view.state.sliceDoc(selection.from, selection.to);
            }
        });
    }
}

const universalDragPlugin = ViewPlugin.fromClass(UniversalDragPlugin)

export const universalDragExtension = [
    universalDragPlugin,
    universalDragHandler,
    dragStyle
]