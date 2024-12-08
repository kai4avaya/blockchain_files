import { EditorView, ViewPlugin, Decoration } from "@codemirror/view"
// import { StateEffect, EditorState, StateField } from "@codemirror/state"
import { processImageFile as imageUploadProcessor, processImageFileAtPosition} from './imageUpload'
import indexDBOverlay from "../../../../../../memory/local/file_worker"

// Add the helper function
function dataURLtoBlob(dataURL: string): Blob {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

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
        console.log("Drop event initiated:", { dropPos, coords: { x: event.clientX, y: event.clientY } });
        
        if (dropPos === null) {
            console.log("Drop position is null, aborting");
            return false;
        }

        // Check if this is an internal image drag
        const imageId = event.dataTransfer?.getData('application/x-image-id');
        if (imageId) {
            // Find the plugin instance
            const plugin = view.plugin(universalDragPlugin);
            if (plugin && plugin.draggedImageInfo) {
                console.log("Processing internal image drag:", plugin.draggedImageInfo);
                
                // Get the image data from the drag event
                const items = Array.from(event.dataTransfer?.items || []);
                const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
                const imageFile = imageItem?.getAsFile();
                
                if (imageFile) {
                    processImageFileAtPosition(
                        imageFile,
                        view, 
                        dropPos, 
                        false, 
                        plugin.draggedImageInfo
                    );
                } else {
                    console.error("No image file found in drag data");
                }
                
                plugin.draggedImageInfo = null; // Clear the info
                return true;
            }
        }

        // Handle external files
        if (event.dataTransfer?.items) {
            const items = Array.from(event.dataTransfer.items);
            const fileItems = items.filter(item => item.kind === 'file');
            
            console.log("Processing drop items:", {
                totalItems: items.length,
                fileItems: fileItems.map(item => ({
                    kind: item.kind,
                    type: item.type
                }))
            });
            
            fileItems.forEach(item => {
                const file = item.getAsFile();
                if (file && file.type.startsWith('image/')) {
                    console.log("Processing image file:", file.name);
                    // Pass shouldSave: false for internal drags
                    processImageFileAtPosition(file, view, dropPos, false) // will need to fix
                        .catch(error => {
                            console.error("Error processing dropped image:", error);
                        });
                }
            });
            
            return true;
        }

        console.log("No valid items in dataTransfer");
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
    draggedImageInfo: { from: number, to: number, imageId: string } | null = null
    isDragging: boolean = false
    draggedFile: File | null = null

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
            if (e.detail === 2) return;

            const target = e.target as HTMLElement;
            if (target.matches('.cm-image-widget img')) {
                const widget = target.closest('.cm-image-widget');
                if (widget) {
                    const pos = view.posAtDOM(widget);
                    if (pos !== null) {
                        const line = view.state.doc.lineAt(pos);
                        const text = line.text;
                        const imageMatch = text.match(/!\[.*?\]\(indexdb:\/\/(img_[^)\s]+)\)/);
                        
                        if (imageMatch) {
                            // Store the exact coordinates of the original image
                            const from = line.from + text.indexOf(imageMatch[0]);
                            const to = from + imageMatch[0].length;
                            const imageId = imageMatch[1];

                            console.log("Image drag started:", { from, to, imageId });
                            this.draggedImageInfo = { from, to, imageId };
                            this.isDragging = false;
                            
                            target.addEventListener('dragstart', async (dragEvent) => {
                                if (!dragEvent.dataTransfer) return;
                                this.isDragging = true;
                                
                                // Get the original image data from indexDB
                                const originalImageData = await indexDBOverlay.getItem('images', imageId);
                                if (originalImageData?.data) {
                                    this.draggedFile = new File(
                                        [dataURLtoBlob(originalImageData.data)],
                                        'image.png',
                                        { type: 'image/png' }
                                    );
                                }
                                
                                const clone = target.cloneNode() as HTMLImageElement;
                                dragEvent.dataTransfer.setDragImage(clone, 0, 0);
                                dragEvent.dataTransfer.effectAllowed = 'move';
                            }, { once: true });

                            // Handle both mouseup and dragend
                            const dragEndHandler = async (event: MouseEvent | DragEvent) => {
                                if (this.isDragging && this.draggedImageInfo) {
                                    console.log("Processing drag end at position");
                                    const dropPos = view.posAtCoords({ 
                                        x: event.clientX, 
                                        y: event.clientY 
                                    });
                                    
                                    if (dropPos !== null && this.draggedFile) {
                                        try {
                                            await processImageFileAtPosition(
                                                this.draggedFile,
                                                view,
                                                dropPos,
                                                false,
                                                this.draggedImageInfo
                                            );
                                        } catch (error) {
                                            console.error("Failed to process dragged image:", error);
                                        }
                                    }
                                }
                                this.isDragging = false;
                                this.draggedImageInfo = null;
                                this.draggedFile = null;
                                document.removeEventListener('mouseup', dragEndHandler);
                                document.removeEventListener('dragend', dragEndHandler);
                            };

                            document.addEventListener('mouseup', dragEndHandler);
                            document.addEventListener('dragend', dragEndHandler);
                        }
                    }
                }
                target.draggable = true;
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