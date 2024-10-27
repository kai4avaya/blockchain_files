// File: ui/components/codemirror_md/codemirror-rich-markdoc/editor/tabManager.ts

import { EditorView } from '@codemirror/view';
import { createEditorState } from '../index';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';

export class TabManager {
  private tabList: HTMLElement;
  private addTabButton: HTMLElement;
  private editorContainer: HTMLElement;
  private editors: EditorView[] = [];
  private activeTabIndex: number = 0;

  constructor(containerElement: Element) {
    this.editorContainer = containerElement.querySelector('#editor-container') as HTMLElement;
    this.tabList = containerElement.querySelector('#tab-list') as HTMLElement;
    this.addTabButton = containerElement.querySelector('#add-tab') as HTMLElement;

    this.addTabButton.addEventListener('click', () => this.addTab());
    this.setupDropTarget();
  }

  createTab() {
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    const number = this.editors.length;  // Don't add 1 since array was already pushed to
    tab.appendChild(document.createTextNode(`Tab ${number}`));
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'close-tab';

    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = Array.from(this.tabList.children).indexOf(tab);
      this.closeTab(e, index);
    });

    tab.appendChild(closeButton);

    this.setupDraggable(tab);
    tab.addEventListener('click', () => {
      const index = Array.from(this.tabList.children).indexOf(tab);
      this.activateTab(index);
    });

    return tab;
  }

  addTab() {
    if (this.editors.length >= 4) {
      alert('Maximum number of tabs (4) reached.');
      return;
    }

    const newState = createEditorState();
    const newEditor = new EditorView({ state: newState });
    this.editors.push(newEditor);

    const newTab = this.createTab();
    this.tabList.appendChild(newTab);
    this.activateTab(this.editors.length - 1);
  }

  closeTab(e: Event, index: number) {
    e.stopPropagation();
    if (confirm('Are you sure you want to close this tab?')) {
      this.editors[index].destroy();
      this.editors.splice(index, 1);
      this.tabList.children[index].remove();

      if (this.activeTabIndex === index) {
        this.activateTab(Math.max(0, index - 1));
      } else if (this.activeTabIndex > index) {
        this.activeTabIndex--;
      }

      this.updateTabNumbers();
    }
  }

  activateTab(index: number) {
    if (index < 0 || index >= this.editors.length) {
      console.error('Invalid tab index:', index);
      index = Math.max(0, Math.min(index, this.editors.length - 1));
    }

    this.tabList.querySelectorAll('.editor-tab').forEach((tab, i) => {
      tab.classList.toggle('active', i === index);
    });

    this.editorContainer.innerHTML = '';
    if (this.editors[index]) {
      this.editorContainer.appendChild(this.editors[index].dom);
    }
    this.activeTabIndex = index;

    console.log('Activated tab', index);
  }

  private setupDraggable(tab: HTMLElement) {
    draggable({
      element: tab,
      getInitialData: () => {
        return {
          type: 'tab',
          index: Array.from(this.tabList.children).indexOf(tab),
        };
      },
      onDragStart: () => {
        console.log('Started dragging tab', tab.textContent);
      },
      onDrop: () => {
        console.log('Finished dragging tab', tab.textContent);
      },
    });
  }

  private setupDropTarget() {
    dropTargetForElements({
        element: this.tabList,
        canDrop: ({ source }) => source.data.type === 'tab',
        onDragEnter: ({ location }) => this.handleDragOver(location),
        onDrag: ({ location }) => this.handleDragOver(location),
        onDragLeave: () => {
            this.clearTabHighlights();
        },
        onDrop: ({ source, location }) => {
            this.clearTabHighlights();
            
            const fromIndex = source.data.index as number;
            const tabElements = Array.from(this.tabList.children);
            const dropX = location.current.input.clientX;
            
            // Find the drop position based on the mouse position
            let toIndex = -1;
            for (let i = 0; i < tabElements.length; i++) {
                const tab = tabElements[i] as HTMLElement;
                const rect = tab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                
                if (dropX < midpoint) {
                    toIndex = i;
                    break;
                }
            }
            
            // If we didn't find a position, it means we're dropping at the end
            if (toIndex === -1) {
                toIndex = tabElements.length;
            }

            console.log('Drop position:', { fromIndex, toIndex });
            
            // Only move if we're actually changing position
            if (fromIndex !== toIndex && fromIndex >= 0 && fromIndex < this.editors.length) {
                this.moveTab(fromIndex, toIndex);
            }
        },
    });
}
  private handleDragOver(location) {
    const tabElements = Array.from(this.tabList.children) as HTMLElement[];
    const dragX = location.current.input.clientX;

    let hoverIndex = tabElements.findIndex((tab) => {
      const rect = tab.getBoundingClientRect();
      return dragX >= rect.left && dragX <= rect.right;
    });

    this.clearTabHighlights();

    if (hoverIndex !== -1) {
      tabElements[hoverIndex].classList.add('highlight');
    }
  }

  private clearTabHighlights() {
    this.tabList.querySelectorAll('.editor-tab.highlight').forEach((tab) => {
      tab.classList.remove('highlight');
    });
  }
  private moveTab(fromIndex: number, toIndex: number) {
    // Ensure toIndex is valid before any operations
    const finalIndex = Math.min(toIndex, this.editors.length - 1);

    // Reorder the editors array
    this.editors = reorder({
        list: this.editors,
        startIndex: fromIndex,
        finishIndex: finalIndex
    });

    // Move the tab element
    const tabElements = Array.from(this.tabList.children);
    const tabToMove = tabElements[fromIndex];

    this.tabList.removeChild(tabToMove);

    if (finalIndex >= this.tabList.children.length) {
        this.tabList.appendChild(tabToMove);
    } else {
        this.tabList.insertBefore(tabToMove, this.tabList.children[finalIndex]);
    }

    // this.updateTabNumbers();
    this.activateTab(finalIndex); // Use the validated index
}
  private updateTabNumbers() {
    Array.from(this.tabList.children).forEach((tab, i) => {
      const textNode = Array.from(tab.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE
      );
      if (textNode) {
        textNode.textContent = `Tab ${i + 1}`;
      }
    });
  }

  initialize() {
    this.addTab();
  }
}
