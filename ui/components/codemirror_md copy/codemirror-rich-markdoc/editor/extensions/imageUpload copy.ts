import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType } from "@codemirror/view"
import { StateField, StateEffect } from "@codemirror/state"

// Effect to handle image insertion
const insertImageEffect = StateEffect.define<{
  url: string,
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

// Plugin to handle drag and drop
const imageUploadPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = Decoration.none
    
    // Add drop zone styling to editor
    view.dom.classList.add('cm-image-dropzone')

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

    view.dom.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dom.classList.remove('cm-image-dropzone-active')

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      const file = files[0]
      if (!file.type.startsWith('image/')) return

      // Use cursor position if no specific drop position
      const pos = view.state.selection.main.head

      // Create a temporary URL for the image
      const url = URL.createObjectURL(file)

      // Insert markdown image syntax at cursor position
      view.dispatch({
        changes: {
          from: pos,
          insert: `![${file.name}](${url})\n`
        },
        effects: insertImageEffect.of({ url, pos })
      })
    })
  }

  update(update: any) {
    // Update decorations if needed
    for (let tr of update.transactions) {
      for (let e of tr.effects) {
        if (e.is(insertImageEffect)) {
          const widget = Decoration.widget({
            widget: new ImageWidget(e.value.url),
            side: 1
          })
          this.decorations = Decoration.set([widget.range(e.value.pos)])
        }
      }
    }
  }
}, {
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