import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType } from "@codemirror/view"
import { StateEffect } from "@codemirror/state"
import indexDBOverlay from "../../../../../../memory/local/file_worker"
import { generateUniqueId } from "../../../../../../utils/utils"


// Effect to handle image insertion
export const insertImageEffect = StateEffect.define<{
  url: string,
  pos: number,
  id?: string
}>()

// Effect for markers
const insertMarkerEffect = StateEffect.define<{
  id: string,
  pos: number
}>()

// Widget to render the image preview
class ImageWidget extends WidgetType {
  constructor(readonly url: string) {
    super()
  }

  eq(other: ImageWidget) {
    return other.url === this.url
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-image-widget'
    
    const img = document.createElement('img')
    img.src = this.url
    img.style.maxWidth = '100%'
    img.style.maxHeight = '300px'
    
    wrapper.appendChild(img)
    return wrapper
  }
}

// Add this widget for invisible markers
// class MarkerWidget extends WidgetType {
//   constructor(readonly id: string) {
//     super()
//   }

//   eq(other: MarkerWidget) {
//     return other.id === this.id
//   }

//   toDOM() {
//     const marker = document.createElement('span')
//     marker.style.display = 'none'
//     marker.dataset.imageId = this.id
//     marker.textContent = `[!@image:${this.id}]`
//     return marker
//   }
// }

// Add this function to scan and restore images
async function restoreImagesFromDoc(view: EditorView) {
  console.log('=== Starting Image Restoration Process ===')
  const content = view.state.doc.toString()
  console.log('Document Content:', content)
  
  // Match both blob URLs and base64 data
  const imageRegex = /!\[(.*?)\](?:\(blob:.*?\)|\(data:.*?\)).*?\u200B\[!@image:(img_[a-zA-Z0-9_]+)\]\u200B/g
  
  let match
  while ((match = imageRegex.exec(content))) {
    const imageId = match[2] // Group 2 contains the image ID
    console.log('Found image to restore:', imageId)
    
    try {
      const imageData = await indexDBOverlay.getItem('images', imageId)
      if (imageData?.data) {
        console.log('Restoring image from IndexedDB:', {
          id: imageId,
          filename: imageData.filename
        })
        
        // Replace entire match with base64 data and marker
        view.dispatch({
          changes: {
            from: match.index,
            to: match.index + match[0].length,
            insert: `![${imageData.filename}](${imageData.data})\u200B[!@image:${imageId}]\u200B`
          },
          effects: insertImageEffect.of({
            url: imageData.data,
            pos: match.index,
            id: imageId
          })
        })
      }
    } catch (error) {
      console.error('Failed to restore image:', error)
    }
  }
}

// Add this helper function
async function handleFilePath(filePath: string, view: EditorView) {
  console.log('Handling file path:', filePath)
  
  try {
    // For Chrome, handle local file path
    if (filePath.startsWith('/')) {
      // Create a file input element
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          await processImageFile(file, view)
        }
      }
      
      // Trigger file input
      input.click()
    }
  } catch (error) {
    console.error('Failed to handle file path:', error)
  }
}

// Add this helper function to process image files
export async function processImageFile(file: File, view: EditorView) {
  console.log('Processing image file:', file.name)
  
  const imageId = `img_${generateUniqueId(8)}`
  const pos = view.state.selection.main.head
  
  try {
    const reader = new FileReader()
    reader.onloadend = async () => {
      if (reader.result && typeof reader.result === 'string') {
        console.log('Image read successfully:', {
          id: imageId,
          name: file.name,
          size: reader.result.length
        })

        // Save to IndexedDB first
        await indexDBOverlay.saveData('images', {
          id: imageId,
          data: reader.result,
          filename: file.name,
          createdAt: Date.now()
        })
        console.log('Saved to IndexedDB:', imageId)

        // Insert into editor
        view.dispatch({
          changes: {
            from: pos,
            insert: `![${file.name}](${reader.result})\u200B[!@image:${imageId}]\u200B\n`
          },
          effects: insertImageEffect.of({
            url: reader.result,
            pos,
            id: imageId
          })
        })
        console.log('Image inserted into editor:', imageId)
      }
    }
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error)
    }
    
    reader.readAsDataURL(file)
  } catch (error) {
    console.error('Failed to process image:', error)
  }
}

// Plugin to handle drag and drop
class ImageUploadPlugin {
  decorations: DecorationSet = Decoration.none
  imageWidgets: Map<string, DecorationSet> = new Map()

  constructor(view: EditorView) {
    this.decorations = Decoration.none
    view.dom.classList.add('cm-image-dropzone')

    console.log('Initializing ImageUploadPlugin')
    // Single restoration attempt with longer delay
    setTimeout(async () => {
      try {
        console.log('Starting delayed image restoration...')
        // Check if IndexedDB is ready
        const allImages = await indexDBOverlay.getAll('images')
        console.log('Available images in IndexedDB:', allImages.map(img => ({
          id: img.id,
          filename: img.filename
        })))
        
        await restoreImagesFromDoc(view)
      } catch (error) {
        console.error('Failed to restore images:', error)
      }
    }, 1500)

    // Add drag event listeners directly to ensure they work
    view.dom.addEventListener('dragenter', (e) => {
      e.preventDefault()
      view.dom.classList.add('cm-image-dropzone-active')
    })

    view.dom.addEventListener('dragover', (e) => {
      e.preventDefault()
      view.dom.classList.add('cm-image-dropzone-active')
    })

    view.dom.addEventListener('dragleave', (e) => {
      e.preventDefault()
      view.dom.classList.remove('cm-image-dropzone-active')
    })

    // Update the drop handler
    view.dom.addEventListener('drop', async (e) => {
      e.preventDefault()
      console.log('Drop event detected:', e)

      // First try to get files directly
      let files: File[] = []
      
      if (e.dataTransfer?.items) {
        files = Array.from(e.dataTransfer.items)
          .filter(item => item.kind === 'file')
          .map(item => item.getAsFile())
          .filter((file): file is File => file !== null)
      } else if (e.dataTransfer?.files?.length) {
        files = Array.from(e.dataTransfer.files)
      }

      if (files.length > 0) {
        console.log('Processing dropped files:', files.length)
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            await processImageFile(file, view)
          }
        }
      } else {
        // If no files, check for file path (Chrome behavior)
        const filePath = e.dataTransfer?.getData('text/plain')
        if (filePath) {
          await handleFilePath(filePath, view)
        }
      }
    })

    // Add deletion handler
    this.handleImageDeletion(view)
  }

  update(update: any) {
    for (let tr of update.transactions) {
      for (let e of tr.effects) {
        if (e.is(insertImageEffect)) {
          const widget = Decoration.widget({
            widget: new ImageWidget(e.value.url),
            side: 1,
          })
          
          // Create new decoration set for this widget
          const newDeco = widget.range(e.value.pos)
          
          // Store widget if it has an ID
          if (e.value.id) {
            this.imageWidgets.set(e.value.id, Decoration.set([newDeco]))
          }
          
          // Update the decorations
          this.decorations = this.decorations.update({
            add: [newDeco]
          })
        }
      }
    }
  }

  private handleImageDeletion(view: EditorView) {
    view.dom.addEventListener('keydown', async (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const content = view.state.doc.toString()
        const imageRegex = /!\[(.*?)\]\((.*?)\)\n?<span.*?data-image-id="(.*?)".*?>/g
        
        let match
        while ((match = imageRegex.exec(content))) {
          const [fullMatch, alt, url, imageId] = match
          const pos = match.index
          const length = fullMatch.length
          
          // Check if deletion is at or near this image
          if (view.state.selection.main.from >= pos && 
              view.state.selection.main.from <= pos + length) {
            console.log('Deleting image:', imageId)
            try {
              // Remove from IndexedDB
              await indexDBOverlay.markDeletedAcrossTables(imageId)
              // Remove the marker and image from editor
              view.dispatch({
                changes: {
                  from: pos,
                  to: pos + length,
                  insert: ''
                }
              })
            } catch (error) {
              console.error('Failed to delete image:', error)
            }
          }
        }
      }
    })
  }
}

const imageUploadPlugin = ViewPlugin.fromClass(ImageUploadPlugin, {
  decorations: v => v.decorations
})

// Add some CSS for the dropzone
const imageUploadStyle = EditorView.theme({
  '&.cm-image-dropzone': {
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      border: '2px dashed transparent'
    }
  },
  '&.cm-image-dropzone-active::after': {
    border: '2px dashed #4f46e5',
    backgroundColor: 'rgba(79, 70, 229, 0.1)'
  },
  '.cm-image-widget': {
    display: 'inline-block',
    width: '100%',
    margin: '8px 0'
  }
})

export const imageUploadExtension = [
  imageUploadPlugin,
  imageUploadStyle
] 