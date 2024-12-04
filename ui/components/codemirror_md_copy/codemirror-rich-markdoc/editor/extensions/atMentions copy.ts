import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType, keymap, ViewUpdate, MatchDecorator } from "@codemirror/view"
import { StateField, StateEffect, EditorState, Transaction, RangeSet, Range } from "@codemirror/state"
import { SearchIndex } from '../../../../../../memory/local/search_index'

// Effect to show/hide the menu
const toggleAtMenu = StateEffect.define<{
  show: boolean, 
  pos?: number | null,
  selectedIndex?: number,
  subMenuSelectedIndex?: number,
  inSubmenu?: boolean
}>()

// Add this near the top with other state effects
const addMention = StateEffect.define<{from: number, to: number}>()

declare global {
  interface Window {
    globalSearchIndex: SearchIndex;
  }
}

class AtMenuWidget extends WidgetType {
  private selectedItem: string | null = null;
  private showSubMenu: boolean = false;
  private subMenuItems: string[] = [];

  constructor(
    private readonly pos: number, 
    private readonly selectedIndex: number,
    private readonly view: EditorView,
    private readonly subMenuSelectedIndex: number = 0
  ) {
    super()
  }

  private getFilteredItems(category: string): string[] {
    if (!window.globalSearchIndex) return [];
    
    const MAX_ITEMS = 30;
    let items: string[] = [];
    
    // Get current text after @ for filtering
    const doc = this.view.state.doc
    const cursorPos = this.view.state.selection.main.head
    const textAfterAt = doc.sliceString(this.pos + 1, cursorPos).toLowerCase() // +1 to skip the @ symbol
    
    // First get all items based on category
    switch (category) {
      case 'All':
        items = [
          ...Array.from(window.globalSearchIndex.keywords).slice(0, MAX_ITEMS),
          ...window.globalSearchIndex.files.map(f => f.name).slice(0, MAX_ITEMS/2),
          ...window.globalSearchIndex.summaries.map(s => s.fileName).slice(0, MAX_ITEMS/2)
        ];
        break;
      case 'Files':
        items = window.globalSearchIndex.files.map(f => f.name).slice(0, MAX_ITEMS);
        break;
      case 'Keywords':
        items = Array.from(window.globalSearchIndex.keywords).slice(0, MAX_ITEMS);
        break;
      case 'Summaries':
        items = window.globalSearchIndex.summaries.map(s => s.fileName).slice(0, MAX_ITEMS);
        break;
      default:
        items = [];
    }
    
    // Only filter if there's text after the @ symbol
    if (textAfterAt.length > 0) {
      items = items.filter(item => 
        item.toLowerCase().includes(textAfterAt)
      );
    }
    
    return items;
  }

  // Helper method to efficiently sample arrays
  private sampleArray(arr: string[], count: number): string[] {
    if (arr.length <= count) return arr;
    const result: string[] = [];
    const step = Math.floor(arr.length / count);
    for (let i = 0; i < count; i++) {
      result.push(arr[i * step]);
    }
    return result;
  }

  // Cache for keywords
  private _cachedKeywords: string[] | null = null;

  // Clear cache when widget is destroyed
  destroy() {
    this._cachedKeywords = null;
  }

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'at-mentions-dropup'
    wrapper.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: 8px;
      min-width: 500px;
    `
    
    // Create main menu first
    const folderFilters = document.createElement('div')
    folderFilters.className = 'folder-filters'
    folderFilters.style.cssText = `
      min-width: 150px;
      flex-shrink: 0;
      border-right: 1px solid #e5e7eb;
      padding-right: 8px;
    `
    
    const items = ["All", "Files", "Keywords", "Summaries"]
    const icons = ["📁", "📄", "🔑", "📝"]
    
    folderFilters.innerHTML = items.map((item, index) => `
      <div class="folder-filter ${this.selectedIndex === index ? 'selected' : ''}" data-index="${index}">
        <div class="folder-filter-content">
          <span>${icons[index]}</span>
          <span style="white-space: nowrap;">${item}</span>
        </div>
        <span class="folder-filter-arrow">→</span>
      </div>
    `).join('')

    wrapper.appendChild(folderFilters)

    // Add submenu if category is selected
    if (this.selectedIndex >= 0) {
      const selectedCategory = items[this.selectedIndex]
      const subMenuItems = this.getFilteredItems(selectedCategory)
      
      if (subMenuItems.length > 0) {
        const subMenu = document.createElement('div')
        subMenu.className = 'submenu-list'
        
        console.log("Rendering submenu with selected index:", this.subMenuSelectedIndex)
        
        subMenu.innerHTML = subMenuItems.map((item, index) => `
          <div class="submenu-item ${index === this.subMenuSelectedIndex ? 'selected' : ''}" 
               data-index="${index}"
               style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${item}
          </div>
        `).join('')

        wrapper.appendChild(subMenu)
      }
    }

    return wrapper
  }

  // private insertMention(text: string) {
  //   const cursorPos = this.view.state.selection.main.head
  //   const fromPos = Math.max(0, this.pos - 1)
    
  //   this.view.dispatch({
  //     changes: {
  //       from: fromPos,
  //       to: cursorPos,
  //       insert: `@${text}`
  //     },
  //     effects: toggleAtMenu.of({show: false})
  //   })
  // }
}


// Update the matcher to support special characters but not spaces
const mentionMatcher = new MatchDecorator({
  regexp: /@([^\s@\n]+)/g,  // Match everything except whitespace, @ and newline
  decoration: match => Decoration.mark({class: "cm-mention"})
})

// Create a plugin that handles both decorations and atomic ranges
const mentionsPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.createDecorations(view)
  }

  createDecorations(view: EditorView) {
    // Just use the matcher's decorations directly
    return mentionMatcher.createDeco(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.createDecorations(update.view)
    }
  }
}, {
  decorations: instance => instance.decorations,
  provide: plugin => EditorView.atomicRanges.of(view => {
    return view.plugin(plugin)?.decorations || Decoration.none
  })
})

// First, let's define our state interface clearly
const atMenuState = StateField.define<{
  active: boolean,
  pos: number | null,
  selectedIndex: number,
  subMenuSelectedIndex: number,
  inSubmenu: boolean
}>({
  create() {
    return {
      active: false,
      pos: null,
      selectedIndex: 0,
      subMenuSelectedIndex: 0,
      inSubmenu: false
    }
  },
  update(value, tr) {
    for (let e of tr.effects) {
      if (e.is(toggleAtMenu)) {
        return {
          active: e.value.show,
          pos: e.value.pos ?? value.pos,
          selectedIndex: e.value.selectedIndex ?? value.selectedIndex,
          subMenuSelectedIndex: e.value.subMenuSelectedIndex ?? value.subMenuSelectedIndex,
          inSubmenu: e.value.inSubmenu ?? value.inSubmenu
        }
      }
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
      const widget = Decoration.widget({
        pos: state.pos,
        widget: new AtMenuWidget(
          state.pos, 
          state.selectedIndex, 
          update.view,
          state.subMenuSelectedIndex
        ),
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

// Update the keymap with better arrow handling
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
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      console.log("ARROW DOWN", state)
      if (!state.active) return false

      if (state.inSubmenu) {
        // Get actual submenu items length for bounds checking
        const widget = view.dom.querySelector('.at-mentions-dropup') as HTMLElement
        const submenuItems = widget?.querySelectorAll('.submenu-item') || []
        const maxIndex = submenuItems.length - 1
        
        view.dispatch({
          effects: toggleAtMenu.of({
            show: true,
            pos: state.pos,
            selectedIndex: state.selectedIndex,
            subMenuSelectedIndex: Math.min(state.subMenuSelectedIndex + 1, maxIndex),
            inSubmenu: true
          })
        })
      } else {
        const maxIndex = 3 // Main menu has 4 items (0-3)
        view.dispatch({
          effects: toggleAtMenu.of({
            show: true,
            pos: state.pos,
            selectedIndex: Math.min(state.selectedIndex + 1, maxIndex),
            subMenuSelectedIndex: state.subMenuSelectedIndex,
            inSubmenu: false
          })
        })
      }
      return true
    },
    preventDefault: true
  },
  {
    key: "ArrowUp",
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      console.log("ARROW UP", state)
      if (!state.active) return false

      if (state.inSubmenu) {
        // When in submenu, only move within submenu
        view.dispatch({
          effects: toggleAtMenu.of({
            show: true,
            pos: state.pos,
            selectedIndex: state.selectedIndex,
            subMenuSelectedIndex: Math.max(state.subMenuSelectedIndex - 1, 0),
            inSubmenu: true
          })
        })
      } else {
        // When in main menu, only move within main menu
        view.dispatch({
          effects: toggleAtMenu.of({
            show: true,
            pos: state.pos,
            selectedIndex: Math.max(state.selectedIndex - 1, 0),
            subMenuSelectedIndex: state.subMenuSelectedIndex,
            inSubmenu: false
          })
        })
      }
      return true
    },
    preventDefault: true
  },
  {
    key: "ArrowRight",
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      console.log("ARROW RIGHT", state)
      if (!state.active) return false

      // Move from main menu to submenu
      if (!state.inSubmenu) {
        const widget = view.dom.querySelector('.at-mentions-dropup') as HTMLElement
        const submenuItems = widget?.querySelectorAll('.submenu-item') || []
        
        if (submenuItems.length > 0) {
          view.dispatch({
            effects: toggleAtMenu.of({
              show: true,
              pos: state.pos,
              selectedIndex: state.selectedIndex,
              subMenuSelectedIndex: 0,
              inSubmenu: true
            })
          })
          return true
        }
      }

      // Existing logic for when already in submenu
      if (state.inSubmenu) {
        const newPos = view.state.selection.main.head + 1
        if (newPos <= view.state.doc.length) {
          view.dispatch({
            effects: toggleAtMenu.of({ show: false }),
            selection: { anchor: newPos }
          })
          return true
        }
        view.dispatch({
          effects: toggleAtMenu.of({ show: false })
        })
        return true
      }

      return false
    },
    preventDefault: true
  },
  {
    key: "ArrowLeft",
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      if (!state.active) return false

      // If in submenu, move back to main menu
      if (state.inSubmenu) {
        view.dispatch({
          effects: toggleAtMenu.of({
            show: true,
            pos: state.pos,
            selectedIndex: state.selectedIndex,
            subMenuSelectedIndex: 0,
            inSubmenu: false
          })
        })
        return true
      }

      return false
    },
    preventDefault: true
  },
  {
    key: "Enter",
    run: (view: EditorView) => {
      const state = view.state.field(atMenuState)
      if (!state.active || state.pos === null) return false

      const items = ["All", "Files", "Keywords", "Summaries"]
      const selectedCategory = items[state.selectedIndex]
      
      if (selectedCategory) {
        const widget = view.dom.querySelector('.at-mentions-dropup') as HTMLElement
        const submenuItems = widget?.querySelectorAll('.submenu-item') || []
        if (submenuItems.length > 0) {
          const selectedItem = submenuItems[state.subMenuSelectedIndex]?.textContent?.trim()
          if (selectedItem) {
            const cursorPos = view.state.selection.main.head
            const fromPos = Math.max(0, state.pos - 1)
            
            // First dispatch: Add the text change
            view.dispatch({
              changes: {
                from: fromPos,
                to: cursorPos,
                insert: `@${selectedItem}`
              },
              effects: [
                toggleAtMenu.of({show: false}),
                addMention.of({from: fromPos, to: fromPos + selectedItem.length + 1})
              ]
            })
            return true
          }
        }
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

// Update the theme definition
const mentionTheme = EditorView.baseTheme({
  ".cm-mention": {
    color: "#2196f3 !important",
    fontWeight: "bold !important"
  }
})

export const atMentionsExtension = [
  atMenuState,
  atMenuPlugin,
  atMentionsKeymap,
  mentionsPlugin,
  mentionTheme
] 
