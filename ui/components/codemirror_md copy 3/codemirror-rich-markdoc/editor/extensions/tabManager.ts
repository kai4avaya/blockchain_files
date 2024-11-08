// File: ui/components/codemirror_md/codemirror-rich-markdoc/editor/tabManager.ts

import { EditorView } from '@codemirror/view';
import { createEditorState } from '../index';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';
import { p2pSync } from '../../../../../../network/peer2peer_simple'; // Adjust the import path accordingly


import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { YjsPeerJSProvider } from '../../../../../../network/yjs-peerjs-provider'



export class TabManager {
  private tabList: HTMLElement;
  private addTabButton: HTMLElement;
  private editorContainer: HTMLElement;
  private editors: EditorView[] = [];
  private activeTabIndex: number = 0;

  // New properties to store Yjs instances per tab
  private ydocs: Y.Doc[] = [];
  private ytexts: Y.Text[] = [];
  private awarenessList: Awareness[] = [];
  private yjsProviders: YjsPeerJSProvider[] = [];

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

  private closeTab(e: Event, index: number) {
    // Prevent closing if there's only one tab open
    if (this.editors.length <= 1) {
        alert("Cannot close the last tab.");
        return;
    }

    // Remove the editor view from the DOM
    this.editors[index].destroy();
    this.editors.splice(index, 1);

    // Remove the Yjs document, text, awareness, and provider instances
    this.ydocs[index].destroy();
    this.ydocs.splice(index, 1);
    this.ytexts.splice(index, 1);
    this.awarenessList.splice(index, 1);
    this.yjsProviders.splice(index, 1);

    // Remove the tab element from the tab list
    const tabToRemove = this.tabList.children[index];
    this.tabList.removeChild(tabToRemove);

    // Update active tab index if the closed tab was active
    if (index === this.activeTabIndex) {
        // If closing the last tab, activate the previous one, otherwise the next
        const newIndex = index > 0 ? index - 1 : 0;
        this.activateTab(newIndex);
    } else if (index < this.activeTabIndex) {
        // Adjust the active tab index if a tab before it was closed
        this.activeTabIndex--;
    }

    // Update tab labels to reflect new order
    this.updateTabNumbers();
}


  
    addTab() {
      if (this.editors.length >= 4) {
        alert('Maximum number of tabs (4) reached.');
        return;
      }

      const tabIndex = this.editors.length;

      // Create a new Y.Doc for the tab
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('codemirror');
      const awareness = new Awareness(ydoc);

      // Set initial content if needed
      if (ytext.length === 0) {
        ytext.insert(0, ''); // Or insert initial content
      }

      // Create a unique document ID for this tab
      const docId = `tab-${tabIndex}`;

      // Create a YjsPeerJSProvider for this tab, passing the docId
      const yjsProvider = new YjsPeerJSProvider(ydoc, p2pSync, docId, awareness);

      // Store Yjs instances
      this.ydocs.push(ydoc);
      this.ytexts.push(ytext);
      this.awarenessList.push(awareness);
      this.yjsProviders.push(yjsProvider);

      // Create the editor state and view
      const newState = createEditorState(ytext, awareness);
      const newEditor = new EditorView({
        state: newState,
      });

      this.editors.push(newEditor);

      // Create and append the new tab
      const newTab = this.createTab();
      this.tabList.appendChild(newTab);
      this.activateTab(tabIndex);
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

             // Add early return if source is not a valid tab
            //   if (fromIndex < 0 || fromIndex >= this.editors.length) {
            //     return;
            // }
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
  private handleDragOver(location: any) {
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
    console.log("moving tab yeowser boom!")
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
