import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType, keymap, ViewUpdate } from "@codemirror/view"
import { StateField, StateEffect, EditorState } from "@codemirror/state"

// Effect to show/hide the menu
const toggleAtMenu = StateEffect.define<{
  show: boolean, 
  pos?: number | null,
  selectedIndex?: number
}>()

class AtMenuWidget extends WidgetType {
  constructor(private readonly pos: number, private readonly selectedIndex: number, private readonly view: EditorView) {
    super()
  }

  eq(other: AtMenuWidget) {
    return other.pos === this.pos && other.selectedIndex === this.selectedIndex
  }

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'at-mentions-dropup'

    const folderFilters = document.createElement('div')
    folderFilters.className = 'folder-filters'
    
    // Add click handlers for each filter
    const items = ["All", "Files", "Keywords", "Fuzzy Search"]
    const icons = ["📁", "📄", "🔑", "🔍"]
    
    folderFilters.innerHTML = items.map((item, index) => `
      <div class="folder-filter ${this.selectedIndex === index ? 'selected' : ''}" data-index="${index}">
        <div class="folder-filter-content">
          <span>${icons[index]}</span>
          <span>${item}</span>
        </div>
        <span class="folder-filter-arrow">→</span>
      </div>
    `).join('')

    // Add click handlers
    folderFilters.addEventListener('click', (e) => {
      const filterEl = (e.target as HTMLElement).closest('.folder-filter')
      if (filterEl) {
        const index = parseInt(filterEl.getAttribute('data-index') || '0')
        const cursorPos = this.view.state.selection.main.head
        
        // Ensure we're not trying to edit before position 0
        const fromPos = Math.max(0, this.pos - 1)
        
        this.view.dispatch({
          changes: {
            from: fromPos,
            to: cursorPos,
            insert: `@${items[index]}`
          },
          effects: toggleAtMenu.of({show: false})
        })
        e.preventDefault()  // Prevent event bubbling
        e.stopPropagation()  // Stop event propagation
      }
    })

    wrapper.appendChild(folderFilters)
    return wrapper
  }
}

const atMenuState = StateField.define<{
  active: boolean,
  pos: number | null,
  selectedIndex: number
}>({
  create() {
    return {active: false, pos: null, selectedIndex: 0}
  },
  update(value, tr) {
    for (let e of tr.effects) {
      if (e.is(toggleAtMenu)) {
        return {
          active: e.value.show, 
          pos: e.value.pos ?? value.pos,
          selectedIndex: e.value.selectedIndex ?? value.selectedIndex
        }
      }
    }
    // Keep existing state if no relevant effects
    if (value.active) {
      return value
    }
    return value
  }
})

const atMenuPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = Decoration.set([])
  }

  update(update: ViewUpdate) {
    const state = update.state.field(atMenuState)
    
    if (state.active && state.pos !== null) {
      const cursor = update.state.selection.main.head
      const text = update.state.doc.sliceString(state.pos, cursor)
      
      if (cursor <= state.pos || /\s/.test(text)) {
        setTimeout(() => {
          update.view.dispatch({
            effects: toggleAtMenu.of({show: false})
          })
        }, 0)
        return
      }

      const widget = Decoration.widget({
        pos: state.pos,
        widget: new AtMenuWidget(state.pos, state.selectedIndex, update.view),
        side: 1
      })
      
      this.decorations = Decoration.set([widget.range(state.pos)])
    } else {
      this.decorations = Decoration.set([])
    }
  }
}, {
  decorations: v => v.decorations
})

const atMentionsKeymap = keymap.of([
  {
    key: "@",
    run: (view: EditorView) => {
      const pos = view.state.selection.main.head
      view.dispatch({
        changes: {from: pos, insert: "@"},
        selection: {anchor: pos + 1}, // Move cursor after @
        effects: toggleAtMenu.of({
          show: true, 
          pos: pos,
          selectedIndex: 0
        })
      })
      return true
    }
  },
  {
    key: "ArrowDown",
    preventDefault: true,
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      if (!state.active) return false

      const maxIndex = 3
      view.dispatch({
        effects: toggleAtMenu.of({
          show: true,
          pos: state.pos,
          selectedIndex: Math.min(state.selectedIndex + 1, maxIndex)
        }),
        // Prevent cursor movement
        selection: view.state.selection
      })
      return true
    }
  },
  {
    key: "ArrowUp",
    preventDefault: true,
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      if (!state.active) return false

      view.dispatch({
        effects: toggleAtMenu.of({
          show: true,
          pos: state.pos,
          selectedIndex: Math.max(state.selectedIndex - 1, 0)
        }),
        // Prevent cursor movement
        selection: view.state.selection
      })
      return true
    }
  },
  {
    key: "ArrowLeft",
    run: (view: EditorView) => {
      return false // Always let cursor movement happen
    }
  },
  {
    key: "ArrowRight",
    run: (view: EditorView) => {
      return false // Always let cursor movement happen
    }
  },
  {
    key: "Enter",
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      if (!state.active) return false

      // Get selected item text based on index
      const items = ["All", "Files", "Keywords", "Fuzzy Search"]
      const selectedText = items[state.selectedIndex]
      
      if (selectedText) {
        // Insert the mention and hide menu
        view.dispatch({
          changes: {
            from: state.pos! - 1, // Include the @ character
            to: view.state.selection.main.head,
            insert: `@${selectedText}` // Include @ in the insertion
          },
          effects: toggleAtMenu.of({show: false}) // Hide menu
        })
        return true
      }
      return false
    }
  },
  {
    key: "Escape",
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      if (!state.active) return false

      // Simply hide the menu on Escape
      view.dispatch({
        effects: toggleAtMenu.of({show: false})
      })
      return true
    }
  }
])

export const atMentionsExtension = [
  atMenuState,
  atMenuPlugin,
  atMentionsKeymap
] 