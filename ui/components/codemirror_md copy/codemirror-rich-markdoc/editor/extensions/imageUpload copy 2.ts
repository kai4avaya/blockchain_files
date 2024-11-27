import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType } from "@codemirror/view"
import { StateEffect } from "@codemirror/state"
import indexDBOverlay from "../../../../../../memory/local/file_worker"
import { generateUniqueId } from "../../../../../../utils/utils"


// Effect to handle image insertion
const insertImageEffect = StateEffect.define<{
  url: string,
  pos: number,
  id?: string
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

// Add this function to scan and restore images
async function restoreImagesFromDoc(view: EditorView) {
  const content = view.state.doc.toString()
  // Match markers between zero-width spaces
  const imageRegex = /\u200B\u200B\[!@image\](img_[a-zA-Z0-9]+)\u200B\u200B/g
  
  let match
  while ((match = imageRegex.exec(content))) {
    const imageId = match[1]
    try {
      const imageData = await indexDBOverlay.getItem('images', imageId)
      if (imageData) {
        // Find the previous markdown image
        const prevLines = content.substring(0, match.index).split('\n')
        const lastLine = prevLines[prevLines.length - 1]
        
        if (lastLine.startsWith('![')) {
          const pos = view.state.doc.lineAt(prevLines.length - 1).from
          view.dispatch({
            changes: {
              from: pos,
              to: pos + lastLine.length,
              insert: `![${imageData.filename}](${imageData.data})`
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to restore image:', imageId, error)
    }
  }
}

// Plugin to handle drag and drop
class ImageUploadPlugin {
  decorations: DecorationSet = Decoration.none
  imageWidgets: Map<string, DecorationSet> = new Map()

  constructor(view: EditorView) {
    this.decorations = Decoration.none
    view.dom.classList.add('cm-image-dropzone')

    // Restore images when editor loads
    restoreImagesFromDoc(view).catch(error => {
      console.error('Failed to restore images:', error)
    })

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

    view.dom.addEventListener('drop', async (e) => {
      e.preventDefault()
      e.stopPropagation()

      console.log("i got dropped!", e)
      view.dom.classList.remove('cm-image-dropzone-active')
    
      const files = e.dataTransfer?.files

      console.log("yo i got files", files)
      if (!files || files.length === 0) return
    
      const file = files[0]
      if (!file.type.startsWith('image/')) return
    
      const pos = view.state.selection.main.head
      
      // Generate unique ID using the utility function
      const imageId = `img_${generateUniqueId(8)}`
      const tempUrl = URL.createObjectURL(file)
      
      // First show the image
      view.dispatch({
        changes: {
          from: pos,
          insert: `![${file.name}](${tempUrl})\n`
        },
        effects: insertImageEffect.of({ url: tempUrl, pos, id: imageId })
      })

      // Save to DB and add invisible marker
      try {
        const reader = new FileReader()
        reader.onloadend = async () => {
          if (reader.result && typeof reader.result === 'string') {
            await indexDBOverlay.saveData('images', {
              id: imageId,
              data: reader.result,
              filename: file.name,
              createdAt: Date.now()
            })

            // Add zero-width spaces around marker to make it invisible
            view.dispatch({
              changes: {
                from: pos + `![${file.name}](${tempUrl})\n`.length,
                insert: `\u200B\u200B[!@image]${imageId}\u200B\u200B`
              }
            })
          }
        }
        reader.readAsDataURL(file)
      } catch (error) {
        console.error('Failed to save image:', error)
      }
    })
  }

  update(update: any) {
    // Update decorations for each transaction
    for (let tr of update.transactions) {
      for (let e of tr.effects) {
        if (e.is(insertImageEffect)) {
          const widget = Decoration.widget({
            widget: new ImageWidget(e.value.url),
            side: 1
          })
          
          // Create new decoration set for this widget
          const newDeco = Decoration.set([widget.range(e.value.pos)])
          
          // Store widget if it has an ID
          if (e.value.id) {
            this.imageWidgets.set(e.value.id, newDeco)
          }
          
          // Combine all decorations properly
          const allDecorations: { from: number, to: number, value: Decoration }[] = []
          
          // Properly iterate over DecorationSets
          this.imageWidgets.forEach(decoSet => {
            decoSet.between(0, update.view.state.doc.length, (from, to, deco) => {
              allDecorations.push({ from, to, value: deco })
              return false
            })
          })
          
          // Create a new DecorationSet with the combined decorations
          this.decorations = Decoration.set(allDecorations)
        }
      }
    }
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
    maxWidth: '100%',
    margin: '8px 0'
  }
})

export const imageUploadExtension = [
  imageUploadPlugin,
  imageUploadStyle
] 