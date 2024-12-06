import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType, ViewUpdate } from "@codemirror/view"
import { StateEffect, StateField, Transaction } from "@codemirror/state"
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
  constructor(view: EditorView) {
    // Initial load only
    this.processImagesInView(view)
  }

  update(update: ViewUpdate) {
    // Only process if content was pasted or explicit image upload
    if (update.transactions.some(tr => 
      tr.annotation(Transaction.userEvent) === "paste" ||
      tr.annotation(Transaction.userEvent) === "input.drop"
    )) {
      this.processImagesInView(update.view)
    }
  }

  async processImagesInView(view: EditorView) {
    const doc = view.state.doc
    const newDecorations: any[] = []
    
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i)
      const text = line.text
      const regex = /([^[]*?)\]\((indexdb:\/\/[^)\s]+)/g
      let match

      while ((match = regex.exec(text)) !== null) {
        const fullMatchStart = Math.max(0, match.index - 2)
        const fullMatch = text.slice(fullMatchStart, match.index + match[0].length + 1)
        const imageId = match[0].match(/indexdb:\/\/(img_[^)\s]+)/)?.[1]

        if (imageId) {
          const from = line.from + fullMatchStart
          const to = line.from + fullMatchStart + fullMatch.length

          try {
            const imageData = await indexDBOverlay.getItem('images', imageId)
            if (imageData?.data) {
              // Verify positions are still valid
              const currentDoc = view.state.doc
              if (from <= currentDoc.length && to <= currentDoc.length) {
                // Add hiding decoration
                newDecorations.push(Decoration.replace({}).range(from, to))
                // Add image widget
                newDecorations.push(Decoration.widget({
                  widget: new ImageWidget(imageData.data, imageId),
                  block: true,
                  side: 1
                }).range(to))
              }
            }
          } catch (error) {
            console.error('Failed to load image:', imageId, error)
          }
        }
      }
    }

    if (newDecorations.length > 0) {
      view.dispatch({
        effects: StateEffect.appendConfig.of([
          EditorView.decorations.of(Decoration.set(newDecorations, true))
        ])
      })
    }
  }
})

const imageStateField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    // Map existing decorations through document changes
    decorations = decorations.map(tr.changes)
    
    // Handle explicit image effects
    for (let e of tr.effects) {
      if (e.is(imageEffect)) {
        const hide = Decoration.replace({
          inclusive: true,  // Make sure to include the full range
          block: false     // Don't break the line
        }).range(e.value.from, e.value.to)
        
        const widget = Decoration.widget({
          widget: new ImageWidget(e.value.imageData, e.value.alt),
          block: true,
          side: 1
        }).range(e.value.to)
        
        return Decoration.set([hide, widget], true)
      }
    }

    return decorations
  },
  provide: f => EditorView.decorations.from(f)
})

// Process image file function remains the same
export async function processImageFile(file: File, view: EditorView) {
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
    const markdownText = `![${file.name}](indexdb://${imageId})\n`
    
    view.dispatch({
      changes: { from: pos, insert: markdownText },
      effects: imageEffect.of({
        from: pos,
        to: pos + markdownText.length - 1,
        imageData: dataUrl,
        alt: file.name
      })
    })
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

export const imageUploadExtension = [
  imageStateField,
  imageLoaderPlugin,
  imageUploadStyle
] 