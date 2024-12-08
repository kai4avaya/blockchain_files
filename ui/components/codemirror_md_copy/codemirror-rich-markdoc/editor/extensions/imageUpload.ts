import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType, ViewUpdate, KeyBinding } from "@codemirror/view"
import { StateEffect, StateField } from "@codemirror/state"
import indexDBOverlay from "../../../../../../memory/local/file_worker"
import { generateUniqueId } from "../../../../../../utils/utils"
// import { processImageFile as sharedProcessImageFile } from './imageProcessor'

// Effect to handle image insertion
export const imageEffect = StateEffect.define<{
  from: number,
  to: number,
  imageData: string,
  alt: string
}>()

// Effect to handle image removal
export const imageClearEffect = StateEffect.define<{
  from: number,
  to: number
}>()

// Widget to render the image preview
class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string) {
    super()
  }

  eq(other: ImageWidget) {
    return other.url === this.url && other.alt === this.alt
  }

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-widget'
    
    const img = document.createElement('img')
    img.src = this.url
    img.alt = this.alt
    img.style.maxWidth = '100%'
    img.style.maxHeight = '300px'
    img.draggable = true
    
    // Add loading state handling
    img.style.opacity = '0'
    img.style.transition = 'opacity 0.3s'
    
    img.onload = () => {
      img.style.opacity = '1'
    }
    
    img.onerror = () => {
      console.error('Failed to load image:', this.url)
      wrapper.innerHTML = `<div class="cm-image-error">Failed to load image</div>`
    }
    
    wrapper.appendChild(img)
    return wrapper
  }
}

// ViewPlugin to handle editor initialization and updates
const imageLoaderPlugin = ViewPlugin.fromClass(class {
  private processedImages: Set<string> = new Set()
  private hasInitialized: boolean = false

  constructor(view: EditorView) {
    // Initial load
    this.processImagesInView(view)
  }

  update(update: ViewUpdate) {
    // Only process images when:
    // 1. Initial load (!hasInitialized)
    // 2. Document changes that actually modify content
    // 3. Viewport changes that might reveal new images
    if (
      // !this.hasInitialized || 
        // (update.docChanged && !update.changes.empty) || 
        update.viewportChanged) {
      console.log("Processing images due to:", {
        isInitial: !this.hasInitialized,
        docChanged: update.docChanged,
        viewportChanged: update.viewportChanged
      });
      this.processImagesInView(update.view)
      this.hasInitialized = true
    }
  }

  async processImagesInView(view: EditorView) {
    console.log("Starting processImagesInView");
    this.processedImages.clear()
    
    const doc = view.state.doc
    
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i)
        const text = line.text
        console.log("Processing line:", {
            lineNumber: i,
            text
        }); 

        // Updated regex to match both ![] and <[] patterns
        const regex = /[!<]\[(.*?)\]\((indexdb:\/\/[^)]+)\)/g
        let match

        while ((match = regex.exec(text)) !== null) {
            const fullMatchStart = line.from + match.index
            const fullMatch = match[0]
            const imageId = match[0].match(/indexdb:\/\/(img_[^)\s]+)/)?.[1]
            const altText = match[1] || ''

            console.log("Found image match:", {
                imageId,
                altText,
                fullMatch,
                lineFrom: line.from,
                fullMatchStart,
                fullMatchEnd: fullMatchStart + fullMatch.length,
                lineText: text
            });

            if (imageId && !this.processedImages.has(`${line.from}-${imageId}`)) {
                try {
                    console.log("Fetching image data for:", imageId);
                    const imageData = await indexDBOverlay.getItem('images', imageId)
                    if (imageData?.data) {
                        const from = fullMatchStart
                        const to = from + fullMatch.length

                        console.log("Dispatching image effect:", {
                            from,
                            to,
                            hasImageData: !!imageData.data,
                            imageId
                        });

                        view.dispatch({
                            effects: imageEffect.of({
                                from,
                                to,
                                imageData: imageData.data,
                                alt: altText
                            })
                        })
                        
                        this.processedImages.add(`${line.from}-${imageId}`)
                        console.log("Successfully processed image:", imageId);
                    } else {
                        console.warn("No image data found for:", imageId);
                    }
                } catch (error) {
                    console.error('Failed to load image:', imageId, error)
                }
            }
        }
    }
    console.log("Finished processImagesInView");
  }
})

// Update imageStateField to handle both initial load and drag-drop
const imageStateField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    // Map existing decorations through document changes
    decorations = decorations.map(tr.changes)

    for (let e of tr.effects) {
      if (e.is(imageEffect)) {
        // Check if we already have a decoration for this range
        let hasExistingDecoration = false
        decorations.between(e.value.from, e.value.to, () => {
          hasExistingDecoration = true
          return false
        })

        if (!hasExistingDecoration) {
          console.log("Adding new image decoration at:", {
            from: e.value.from,
            to: e.value.to,
            alt: e.value.alt
          });

          const newDecos = [
            Decoration.replace({
              inclusive: true,
              block: false
            }).range(e.value.from, e.value.to),
            
            Decoration.widget({
              widget: new ImageWidget(e.value.imageData, e.value.alt),
              block: true,
              side: 1
            }).range(e.value.to)
          ]
          
          decorations = decorations.update({
            add: newDecos,
            sort: true
          })
        } else {
          console.log("Skipping duplicate decoration at:", {
            from: e.value.from,
            to: e.value.to
          });
        }
      }

      if (e.is(imageClearEffect)) {
        const existingDecos: { from: number; to: number; type: string }[] = [];
        decorations.between(0, tr.state.doc.length, (from, to, value) => {
          existingDecos.push({
            from,
            to,
            type: value.constructor.name
          });
          return false;
        });

        console.log("Attempting to clear decorations in range:", {
          from: e.value.from,
          to: e.value.to,
          existingDecorations: existingDecos
        });
        
        // Find the decoration that corresponds to the image markdown
        const imageMarkdownDeco = existingDecos.find(d => 
          Math.abs(d.from - e.value.from) < 5 || // Allow small offset
          Math.abs(d.to - e.value.to) < 5     // Allow small offset
        );

        if (imageMarkdownDeco) {
          console.log("Found matching decoration to remove:", imageMarkdownDeco);
          decorations = decorations.update({
            filter: (from, to) => {
              const isImageDeco = Math.abs(from - imageMarkdownDeco.from) < 5 && 
                                Math.abs(to - imageMarkdownDeco.to) < 5;
              const keep = !isImageDeco;
              console.log("Filtering decoration:", { from, to, isImageDeco, keep });
              return keep;
            }
          });
        }
      }
    }

    return decorations
  },
  provide: f => EditorView.decorations.from(f)
})

// Process image file function remains the same
export async function processImageFile(file: File, view: EditorView, caption?: string) {
  try {
    const imageId = `img_${generateUniqueId()}`
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    await indexDBOverlay.saveData('images', {
      id: imageId,
      data: dataUrl,
      filename: file.name,
      createdAt: Date.now()
    })

    const pos = view.state.selection.main.head
    const imageMarkdown = `![${file.name}](indexdb://${imageId})`
    const captionText = caption ? `\n*Figure: ${caption}*\n\n` : '\n'
    const markdownText = imageMarkdown + captionText

    view.dispatch({
      changes: { from: pos, insert: markdownText },
      effects: imageEffect.of({
        from: pos,
        to: pos + imageMarkdown.length, // Only hide the image markdown, not the caption
        imageData: dataUrl,
        alt: file.name
      })
    })
  } catch (error) {
    console.error('Failed to process image:', error)
    throw error
  }
}

// Add helper function to convert data URL to blob
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

// Update the drag handler part in processImageFileAtPosition
export async function processImageFileAtPosition(
    file: File, 
    view: EditorView, 
    position: number, 
    shouldSave: boolean = true,
    originalImage?: { from: number, to: number, imageId: string }
) {
    try {
        // If we have original image info, remove it first
        if (originalImage) {
            console.log("Removing original image at:", originalImage);
            
            // Remove the original image markdown and decoration
            view.dispatch({
                changes: { from: originalImage.from, to: originalImage.to + 1, insert: '' }, // +1 for newline
                effects: imageClearEffect.of({ from: originalImage.from, to: originalImage.to })
            });
            
            // Wait for the removal to complete
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Use the original image data
            const originalImageData = await indexDBOverlay.getItem('images', originalImage.imageId);
            if (originalImageData?.data) {
                file = new File(
                    [dataURLtoBlob(originalImageData.data)],
                    file.name,
                    { type: 'image/png' }
                );
            }
        }

        // Ensure position is within document bounds
        const docLength = view.state.doc.length;
        position = Math.min(position, docLength);
        
        console.log("Processing image at position:", {
            requestedPosition: position,
            docLength,
            adjustedPosition: position,
            shouldSave
        });

        const imageId = `img_${generateUniqueId()}`
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })

        if (shouldSave) {
            await indexDBOverlay.saveData('images', {
                id: imageId,
                data: dataUrl,
                filename: file.name,
                createdAt: Date.now()
            })
        }

        const imageMarkdown = `![${file.name}](indexdb://${imageId})\n`

        console.log("decorations shouldSave", shouldSave)

        // Find and remove the original image if it exists (when repositioning)
        if (!shouldSave) {
            const doc = view.state.doc
            const docText = doc.toString()
            // Updated regex to be more flexible with newlines and handle escaped characters
            const regex = new RegExp(`!\\[${file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(indexdb://[^)]+\\)\\n?`, 'g')
            
            let match
            while ((match = regex.exec(docText)) !== null) {
                const from = match.index
                const to = from + match[0].length

                // Get current decorations in a type-safe way
                const currentDecos: { from: number; to: number; type: string }[] = [];
                view.state.field(imageStateField).between(0, doc.length, (from, to, value) => {
                    currentDecos.push({
                        from,
                        to,
                        type: value.constructor.name
                    });
                    return false;
                });

                console.log("Found original image at:", { 
                    from, 
                    to, 
                    matchedText: match[0],
                    currentDecorations: currentDecos
                })
                
                // Dispatch the removal separately to ensure it's processed first
                view.dispatch({
                    changes: { from, to, insert: '' },
                    effects: imageClearEffect.of({ from, to })
                })
                
                // Wait for next tick before adding the new image
                await new Promise(resolve => setTimeout(resolve, 0))
                break
            }
        }

        console.log("Adding new image at:", { position, markdown: imageMarkdown });

        // Add the image at the new position
        view.dispatch({
            changes: { from: position, insert: imageMarkdown },
            effects: imageEffect.of({
                from: position,
                to: position + imageMarkdown.length - 1,
                imageData: dataUrl,
                alt: file.name
            })
        })

        return true
    } catch (error) {
        console.error('Failed to process image:', error)
        throw error
    }
}

// Update the CSS to include the overlay
const imageUploadStyle = EditorView.theme({
  '.cm-image-drop-overlay': {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(79, 70, 229, 0.1)',
    border: '2px dashed #4f46e5',
    pointerEvents: 'none',
    zIndex: '1000',
    transition: 'all 0.2s ease'
  },
  '&.cm-image-dropzone': {
    position: 'relative'
  },
  '&.cm-image-dropzone-active': {
    background: 'rgba(79, 70, 229, 0.05)'
  },
  '.cm-image-widget': {
    display: 'block',
    width: '100%',
    margin: '1em 0',
    padding: '0.5em 0',
    position: 'relative',
    minHeight: '50px',
    
    '& img': {
      display: 'block',
      maxWidth: '100%',
      margin: '0 auto',
      borderRadius: '4px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
    },
    
    '& .cm-image-error': {
      color: '#ef4444',
      padding: '8px',
      border: '1px solid #ef4444',
      borderRadius: '4px',
      margin: '8px 0'
    }
  }
})

// Add this paste handler function
const handlePaste = EditorView.domEventHandlers({
  paste(event: ClipboardEvent, view: EditorView) {
    const items = event.clipboardData?.items
    if (!items) return false

    const imageItems = Array.from(items).filter(item => 
      item.type.startsWith('image/')
    )

    if (imageItems.length > 0) {
      event.preventDefault()
      
      const pos = view.state.selection.main.head
      // Process each image in the clipboard
      imageItems.forEach(async (item) => {
        const file = item.getAsFile()
        if (file) {
          try {
            // await processImageFile(file, view)
            processImageFileAtPosition(file, view, pos, true)
          } catch (error) {
            console.error('Failed to process pasted image:', error)
          }
        }
      })
      
      return true
    }

    return false
  }
})


// Update the extension export to include the paste handler
export const imageUploadExtension = [
  imageStateField,
  imageLoaderPlugin,
  imageUploadStyle,
  handlePaste
] 