// File: ui/components/codemirror_md/codemirror-rich-markdoc/editor/tabManager.ts

import { EditorView } from "@codemirror/view";
import { createEditorState } from "../index";
import {      
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { p2pSync } from "../../../../../../network/peer2peer_simple"; // Adjust the import path accordingly

import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { YjsPeerJSProvider } from "../../../../../../network/yjs-peerjs-provider";
import indexDBOverlay from "../../../../../../memory/local/file_worker";
import { debounce, generateUniqueId } from "../../../../../../utils/utils";
// @ts-ignore
import {share3dDat} from '../../../../../graph_v2/create.js'
import { BaseEventPayload, ElementDragType } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";

import { marked } from 'marked';
import jsPDF from 'jspdf';

let backupName = ''
// // @ts-ignore
// import switchToggle from '../../../../../../ui/components/mermaidButton.js';
// // @ts-ignore
// import { generateAndSaveMermaidDiagram } from '../../../../../../ai/providers/mermaid/mermaid_api_worker.js';
// // @ts-ignore
// import toast from '../../../../../../ui/components/toast-alert.js';

declare global {
  interface Window {
    handleFileDrop_sphere: (event: any) => void;
    removeGhostCube: () => void;
    onPointerUp: (event: any) => void;
    droppedTabsData: Map<string, {
      content: string;
      title: string;
      docId: string;
      lastModified: number;
    }>;
  }
}

interface TabDragData {
  type: 'tab';
  index: number;
  content: string;
  title: string;
}

// interface ElementDragPayload {
//   data: TabDragData;
// }

const emojis = [
  '🌟', '🎨', '📝', '🎯', '🎸', '🌈', '🎮', '🎭', '📚', '🎪', '🎩', '🌺', '🍕', '🌍', 
  '🚀', '🎵', '🎬', '🎡', '🎢', '🎠', '🦁', '🐘', '🦒', '🦈', '🐋', '🦚', '🦥', 
  '🦊', '🐼', '🦖', '🦕', '🦄', '🦩', '🐢', '🦘', '🦃', '🐸', '🐙',
  '🦑', '🦋', '🌴', '🌵', '🍄', '🌹', '🌻', '🌼', '🌸', '🍀', '🌳', '🌲', '🎋', 
  '🎍', '🍎', '🍇', '🍉', '🥝', '🥥', '🥨', '🌮', '🍣', '🍜', '🍖', '🧀', '🥐', 
  '🥞', '🍪', '⚽', '🏈', '🎾', '🏆', '🎲', '🎳', '🎰', '🚗', '🚁', '✈️', '🚂', 
  '⛵', '🚤', '🛸', '🗽', '🗿', '🏰', '⛩️', '🕌', '🌅', '🌇', '🌉', '🌌', '🎆', 
  '🎇', '🌠', '⭐', '🌙', '☀️', '🪐', '🌊', '⛄', '🤹', '🎫', '💎', '⚡', '🔥', 
  '🌪️', '🦜', '🦢', '🐉', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '👻', '🎃', 
  '🕷️', '🦇', '🐲', '🎄', '🎎', '🎏', '🎐', '🎑', '🎀', '🎁', '🎗️', '🔮', '📯',
  '🎺', '🎻', '🥁', '📻', '🎹', '🪕', '💫', '🌌', '🌕', '🌖', '🌗', '🌘', '🌑', 
  '🌒', '🌓', '🌔', '🪴', '🌱', '🍂', '🍁', '🦋', '🐞', '🐢', '🦎', '🐍', '🦟', 
  '🦗', '🕸️', '🦂', '🦖', '🦕', '🦒', '🦙', '🦛', '🦘', '🦥', '🦨', '🦡', '😍',
  '🫗','🖱️','🧫','🌬️','🖇️','⚙️','🪟','🪣', '🫚','🦪','👁️‍🗨️','🦱','🫸','🫀','🤹',
  '🧌','🧔🏻‍♀️','🧞‍♂️','🤾‍♂️','🤽‍♂️'
];


// const EDITOR_DB_NAME = "editorDB";
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
    this.editorContainer = containerElement.querySelector(
      "#editor-container"
    ) as HTMLElement;
    this.tabList = containerElement.querySelector("#tab-list") as HTMLElement;
    this.addTabButton = containerElement.querySelector(
      "#add-tab"
    ) as HTMLElement;

    this.addTabButton.addEventListener("click", () => this.addTab());
    this.setupDropTarget();

    p2pSync.onPeerConnect((peerId: string) => {
      this.syncTabsWithPeer(peerId);
    });
    // Register a custom message handler
    p2pSync.setCustomMessageHandler((message: any, peerId: string) => {
      if (message.type === "sync_tabs") {
        this.handleTabSync(message.data);
      }
      this.handlePeerMessage(message, peerId);
    });
    this.initializeSyncListeners();
    
    const { renderer } = share3dDat();
    const canvas = renderer?.domElement;

  
    dropTargetForElements({
      element: canvas,
      canDrop: args => {
        const data = args.source.data as unknown as TabDragData;
        return data.type === 'tab';
      },
      onDrop: async args => {
        const data = args.source.data as unknown as TabDragData;
        const { clientX, clientY } = args.location.current.input;
        const index = data.index; // Get index from the drag data

        const docId = this.yjsProviders[index].getDocId();
    
        
        // Create a File object
        const file = new File(
          [data.content],
          `${data.title || 'Untitled'}.md`,
          { 
            type: 'text/markdown',
            lastModified: Date.now()
          }
        );
    
        // Create a proper FileSystemFileEntry that matches what handleFileDrop expects
        const fileEntry = {
          isFile: true,
          isDirectory: false,
          name: file.name,
          fullPath: '/' + file.name,
          file: (callback: any) => callback(file),
          // Add any other FileSystemFileEntry methods that might be needed
          createReader: () => {},
          getMetadata: (callback: any) => callback({
            modificationTime: new Date(file.lastModified),
            size: file.size
          })
        };
    
        // Create a DataTransfer object with proper items structure
        const dt = new DataTransfer();
        dt.items.add(file);
    
        // Create a complete synthetic event that works with both handleFileDrop and handleFileDrop_sphere
        const syntheticEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX,
          clientY,
          dataTransfer: {
            files: dt.files,
            items: [{
              webkitGetAsEntry: () => fileEntry,
              getAsFile: () => file,
              kind: 'file',
              type: file.type
            }],
            getData: () => '',
            types: ['Files']
          },
          source: {
            data: {
              id: docId,
              name: data.title,
              content: data.content,
              type: 'tab'
            }
          },
          // Add properties needed by handleFileDrop_sphere
          tabId: docId,
          fileIds: [docId],
          fileNames: [data.title],
          fileEntries: [fileEntry],
          isTab: true,
          target: canvas
        };

        // dispatchEvent(syntheticEvent)
    
        // Let the drop handler in move.js handle the sphere creation
        // canvas.dispatchEvent(new CustomEvent('drop', { 
        //   bubbles: true,
        //   cancelable: true,
        //   detail: syntheticEvent
        // }));

        canvas.dispatchEvent(new CustomEvent('tabDrop', { 
          bubbles: true,
          cancelable: true,
          detail: syntheticEvent
      }));

      // const tabId = this.yjsProviders[index].getDocId();
  
        
      this.closeTab(null, index, false, false);
      }
    });
  }
  
async initialize() {
  try {
    const savedTabs = await indexDBOverlay.getData("tabs");
    if (savedTabs?.length > 0) {
      // Filter out hidden tabs and sort remaining ones
      const visibleTabs = savedTabs.filter(tab => !tab.isHidden);
      const sortedTabs = [...visibleTabs].sort((a, b) => a.order - b.order);
     
      // Load all visible tabs first
      for (const tabData of sortedTabs) {
        const savedDoc = await indexDBOverlay.getItem("docs", tabData.docId);
        if (savedDoc?.state) {
          await this.loadTabFromIndexedDB(
            tabData.title || "Untitled",
            tabData.docId,
            savedDoc.state
          );
        }
      }

      // Only activate the first tab after all tabs are loaded and DOM is ready
      if (this.editors.length > 0) {
        requestAnimationFrame(() => {
          this.activateTab(0);
        });
      }
    } else {
      backupName="doc-welcome-" + generateUniqueId(3)
      // await this.addTab(this.makeTitle(), "doc-welcome-" + generateUniqueId(3));
      await this.addTab(this.makeTitle(), backupName);

    }

    // Initialize the mermaid switch after tabs are loaded
    // requestAnimationFrame(() => {
    //   switchToggle.initialize();
    // });

  } catch (error) {
    console.error("Error in TabManager initialization:", error);
    await this.addTab(this.makeTitle(), "doc-welcome-" + generateUniqueId(3));
  }
}


  createTab(title: string) {
    const tab = document.createElement("div");
    tab.className = "editor-tab";

    tab.setAttribute('data-title', title); 

    const titleElement = document.createElement("span");
    titleElement.className = "tab-title";
    titleElement.textContent = title;
    titleElement.setAttribute("contenteditable", "true");
    titleElement.style.marginRight = "8px"; // Add margin to create space

    // Handle title editing
    titleElement.addEventListener("blur", () => {
      const index = Array.from(this.tabList.children).indexOf(tab);
      const newTitle = titleElement.textContent?.trim() || "";
      if (newTitle) {
        this.renameTab(index, newTitle);
      } else {
        // Revert to previous title if new title is empty
        titleElement.textContent = this.yjsProviders[index].getDocId();
      }
    });

    // Prevent new lines in title
    titleElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleElement.blur();
      }
    });

    const closeButton = document.createElement("button");
    closeButton.innerHTML = "&times;";
    closeButton.className = "close-tab";

    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = Array.from(this.tabList.children).indexOf(tab);
      this.closeTab(e, index);
    });

    tab.appendChild(titleElement);
    tab.appendChild(closeButton);

    this.setupDraggable(tab);
    tab.addEventListener("click", () => {
      const index = Array.from(this.tabList.children).indexOf(tab);
      this.activateTab(index);
    });

    return tab;
  }

    private closeTab(e: Event | null, index: number, broadcast: boolean = true, isDeleted: boolean = true) {
      // Prevent closing if there's only one tab open
   

      // const tabId = this.editors[index].dom.getAttribute('data-tab-id');
      const docId = this.yjsProviders[index].getDocId();
    
      if (isDeleted && docId !== null) {
        this.deleteTabFromDB(docId); // Delete from IndexDB
      } else {
          this.updateTabInDB(docId, {
          isHidden: true,
          draggedToCanvas: true
      });
      }

      // Remove the editor view from the DOM
      this.editors[index].destroy();
      this.editors.splice(index, 1);

      // Remove the Yjs instances
      this.ydocs[index].destroy();
      this.ydocs.splice(index, 1);
      this.ytexts.splice(index, 1);
      this.awarenessList.splice(index, 1);
      const closedProvider = this.yjsProviders.splice(index, 1)[0];

      // Remove the tab element from the tab list
      const tabToRemove = this.tabList.children[index];
      this.tabList.removeChild(tabToRemove);

      // Update active tab index if the closed tab was active
      if (index === this.activeTabIndex) {
        const newIndex = index > 0 ? index - 1 : 0;
        this.activateTab(newIndex);
      } else if (index < this.activeTabIndex) {
        this.activeTabIndex--;
      }

      // Update tab labels to reflect new order
      this.updateTabNumbers();

      // Broadcast the tab closure if needed
      if (broadcast) {
        p2pSync.broadcastCustomMessage({
          type: "close_tab",
          data: {
            docId: closedProvider.getDocId(),
          },
        });
      }
 
      this.saveTabsToIndexedDB();
        if (this.editors.length < 1) {
        // alert("Cannot close the last tab.");
        // return;
        // const untitledTab = this.makeTitle()
        this.addTab();
      }
    }

  makeTitle(title?: string)
  {
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const tabTitle = title || `Untitled${randomEmoji}`;
    return tabTitle
  }

  addTab(title?: string, docId?: string) {
    console.log("Adding tab - Before:", {
      currentProviders: this.yjsProviders.length,
      currentTabs: this.tabList.children.length
    });

    const tabIndex = this.editors.length;
    const tabTitle = this.makeTitle(title) // title || `Untitled ${randomEmoji}`;
    
    const documentId = docId || this.generateDocId(tabTitle + '-' + Date.now());
    // Check if a tab with this docId already exists
    if (this.yjsProviders.find((provider) => provider.getDocId() === documentId)) {
      console.warn("Tab with this docId already exists.");
      return;
    }
  
    // Rest of your existing addTab code...
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    const awareness = new Awareness(ydoc);
  
    if (ytext.length === 0) {
      ytext.insert(0, "");
    }
  
    const yjsProvider = new YjsPeerJSProvider(
      ydoc,
      p2pSync,
      documentId,
      awareness
    );
  
    this.ydocs.push(ydoc);
    this.ytexts.push(ytext);
    this.awarenessList.push(awareness);
    this.yjsProviders.push(yjsProvider);
  
    const newState = createEditorState(ytext, awareness);
    const newEditor = new EditorView({
      state: newState,
    });
  
    ydoc.on("update", (update: Uint8Array) => {
      this.saveYDocToIndexedDB(documentId, ydoc);
    });
  
    this.editors.push(newEditor);
    this.setupEditorButtons(newEditor, tabIndex);

  
    const newTab = this.createTab(tabTitle);
    this.tabList.appendChild(newTab);
    this.activateTab(tabIndex);
  
    if (!docId) {
      p2pSync.broadcastCustomMessage({
        type: "create_tab",
        data: {
          title: tabTitle,
          docId: documentId,
        },
      });
    }
  
    this.saveTabsToIndexedDB();

    console.log("Adding tab - After:", {
      newProvider: yjsProvider,
      providersCount: this.yjsProviders.length,
      tabsCount: this.tabList.children.length
    });
  }



  activateTab(index: number) {
    // Ensure we have editors and DOM elements before proceeding
    if (!this.editors.length || !this.tabList || !this.editorContainer) {
      console.warn("Required elements not ready");
      return;
    }
  
    // Validate index
    const validIndex = Math.max(0, Math.min(index, this.editors.length - 1));
  
    // Update tab UI
    Array.from(this.tabList.children).forEach((tab, i) => {
      tab.classList.toggle("active", i === validIndex);
    });
  
    // Update editor display
    this.editorContainer.innerHTML = '';
    this.editorContainer.appendChild(this.editors[validIndex].dom);
    this.activeTabIndex = validIndex;
  }


// Modify your saveYDocToIndexedDB method
private saveYDocToIndexedDB = debounce(async (docId: string, ydoc: Y.Doc) => {
  const ydocState = Y.encodeStateAsUpdate(ydoc);
  await indexDBOverlay.saveData(
    "docs",
    {
      docId: docId,
      state: Array.from(ydocState),
    },
    
  );
  await this.triggerFullSyncToPeers(); // Add this line
}, 1000);


  private async saveTabsToIndexedDB() {
    const tabsData = this.yjsProviders.map((provider, index) => ({
      title: (this.tabList.children[index].querySelector(".tab-title") as HTMLElement).textContent,
      docId: provider.getDocId(),
      order: index,
      isHidden: false 
    }));
  
    await indexDBOverlay.saveData("tabs", tabsData);
    await this.triggerFullSyncToPeers(); // Add this line
  }

  private async triggerFullSyncToPeers() {
    if (p2pSync.isConnected()) {
      const allStates = this.getAllDocsState();
      p2pSync.broadcastCustomMessage({
        type: 'full_state_all',
        data: allStates
      });
    }
  }
  private setupDraggable(tab: HTMLElement) {
    draggable({
      element: tab,
      getInitialData: (args: unknown): Record<string, unknown> => {
        const index = Array.from(this.tabList.children).indexOf(tab);
        const editor = this.editors[index];
        const content = editor.state.doc.toString();
        const title = (tab.querySelector(".tab-title") as HTMLElement).textContent || "Untitled";
        
        return {
          type: "tab",
          index,
          content,
          title,
        };
      },
      onDragStart: () => {
      },
      onDrop: async (args: BaseEventPayload<ElementDragType>) => {
        const tabId = args.source.data.index as string;
       
      }
    });
  }  // // Fix the renameTab method to update existing data instead of creating new
  
  private async renameTab(index: number, newTitle: string) {
    const provider = this.yjsProviders[index];
    const oldDocId = provider.getDocId();
  
    // Update the tab title
    const tab = this.tabList.children[index];
    const titleElement = tab.querySelector(".tab-title") as HTMLElement;
    titleElement.textContent = newTitle;
  
    // Save to IndexedDB and broadcast to peers
    try {
      await this.saveTabsToIndexedDB();
      
      // Broadcast the rename to peers
      if (p2pSync.isConnected()) {
        p2pSync.broadcastCustomMessage({
          type: "rename_tab",
          data: {
            oldDocId,
            newTitle
          }
        });
      }
    } catch (error) {
      console.error("Error updating tab:", error);
      titleElement.textContent = oldDocId.replace("doc-", "");
    }
  }
  public async restoreHiddenTab(tabId: string) {
    const tabData = await indexDBOverlay.getItem('tabs', tabId);
    if (tabData) {
        await this.updateTabInDB(tabId, {
            ...tabData,
            isHidden: false
        });
        // Add logic to recreate the tab in UI
    }
  }

  private generateDocId(tabTitle: string): string {
    return `doc-${encodeURIComponent(tabTitle)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async syncTabsWithPeer(peerId: string) {
    try {
      // Send our tabs to the peer
      const ourTabs = this.yjsProviders.map((provider, index) => ({
        title: (
          this.tabList.children[index].querySelector(
            ".tab-title"
          ) as HTMLElement
        ).textContent,
        docId: provider.getDocId(),
        state: Array.from(Y.encodeStateAsUpdate(this.ydocs[index])),
      }));

      p2pSync.sendCustomMessage(peerId, {
        type: "sync_tabs",
        data: ourTabs,
      });
    } catch (error) {
      console.error("Error syncing tabs:", error);
    }
  }

  private async handleTabSync(peerTabs: any[]) {
    for (const peerTab of peerTabs) {
      // Check if we already have this tab
      const existingProviderIndex = this.yjsProviders.findIndex(
        (provider) => provider.getDocId() === peerTab.docId
      );

      if (existingProviderIndex === -1) {
        // If we don't have this tab, create it
        await this.loadTabFromIndexedDB(
          peerTab.title,
          peerTab.docId,
        );

        // Apply the peer's state to the newly created tab
        if (peerTab.state) {
          const lastDoc = this.ydocs[this.ydocs.length - 1];
          Y.applyUpdate(lastDoc, new Uint8Array(peerTab.state));
        }
      }
    }
  }

private handlePeerMessage(message: any, peerId: string) {
  switch (message.type) {
    case "create_tab":
      const { title, docId } = message.data;
      if (!this.yjsProviders.find(provider => provider.getDocId() === docId)) {
        this.addTab(title, docId);
      }
      break;
      
    case "close_tab":
      this.closeTabByDocId(message.data.docId);
      break;
      
      case "rename_tab":
        const index = this.yjsProviders.findIndex(
          provider => provider.getDocId() === message.data.oldDocId
        );
        if (index !== -1) {
          const titleElement = this.tabList.children[index].querySelector(".tab-title") as HTMLElement;
          titleElement.textContent = message.data.newTitle;
          this.saveTabsToIndexedDB(); // Save the new state
        }
        break;
      
    case "request_current_state":
      const docState = this.getDocState(message.docId);
      if (docState) {
        p2pSync.broadcastCustomMessage({
          type: "full_state",
          docId: message.docId,
          data: docState
        });
      }
      break;
      
    case "full_state":
      if (message.docId && message.data) {
        this.handleFullState([{ docId: message.docId, state: message.data }]);
      }
      break;
      
    case "request_all_states":
      const allStates = this.getAllDocsState();
      p2pSync.broadcastCustomMessage({
        type: "full_state_all",
        data: allStates
      });
      break;
      
    case "full_state_all":
      this.handleFullState(message.data);
      break;

    case "yjs_sync":
    case "yjs_update":
    case "yjs_awareness":
      // Forward to YjsPeerJSProvider
      const provider = this.yjsProviders.find(p => p.getDocId() === message.docId);
      provider?.handlePeerMessage(message, peerId);
      break;
  }
}

  private closeTabByDocId(docId: string) {
    const index = this.yjsProviders.findIndex(
      (provider) => provider.getDocId() === docId
    );
    if (index !== -1) {
      this.closeTab(null, index, false); // Pass false to indicate it's from a peer
    }
  }

  private setupDropTarget() {
    dropTargetForElements({
      element: this.tabList,
      canDrop: ({ source }) => source.data.type === "tab",
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

        // Only move if we're actually changing position
        if (
          fromIndex !== toIndex &&
          fromIndex >= 0 &&
          fromIndex < this.editors.length
        ) {
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
      tabElements[hoverIndex].classList.add("highlight");
    }
  }

  private clearTabHighlights() {
    this.tabList.querySelectorAll(".editor-tab.highlight").forEach((tab) => {
      tab.classList.remove("highlight");
    });
  }
  private moveTab(fromIndex: number, toIndex: number) {
    // Ensure toIndex is valid before any operations
    const finalIndex = Math.min(toIndex, this.editors.length - 1);

    // Reorder the editors array
    this.editors = reorder({
      list: this.editors,
      startIndex: fromIndex,
      finishIndex: finalIndex,
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
  private async loadTabFromIndexedDB(
    title: string,
    docId: string, 
    savedState?: number[]
  ) {
    try {
      // Create Yjs document and get text
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("codemirror");
      const awareness = new Awareness(ydoc);
  
      
      // Important: Apply saved state BEFORE creating the editor
      if (savedState) {
        Y.applyUpdate(ydoc, new Uint8Array(savedState));
      }
  
      // Set up awareness after state is loaded
      const clientId = ydoc.clientID;
      const userName = p2pSync.getCurrentPeerId() || `User-${clientId}`;
      const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1"];
      awareness.setLocalStateField("user", {
        name: userName,
        color: colors[clientId % colors.length]
      });
  
      // Create provider after state is loaded
      const yjsProvider = new YjsPeerJSProvider(ydoc, p2pSync, docId, awareness);
  
      // Store instances in class arrays
      this.ydocs.push(ydoc);
      this.ytexts.push(ytext);
      this.awarenessList.push(awareness);
      this.yjsProviders.push(yjsProvider);
  
      // Create editor state after Yjs document is fully initialized
      const newState = createEditorState(ytext, awareness);
      
      // Create and initialize editor view
      const newEditor = new EditorView({
        state: newState,
        parent: undefined // Don't attach to DOM yet
      });
  
    
this.setupEditorButtons(newEditor, this.editors.length);
      // Verify editor content
  
      this.editors.push(newEditor);
  
      // Create tab UI
      const newTab = this.createTab(title);
      this.tabList.appendChild(newTab);
  
      // Setup auto-save with debounce
      ydoc.on("update", (update: Uint8Array) => {
        this.saveYDocToIndexedDB(docId, ydoc);
      });
  
      // Verify final state
      if (savedState) {
        const currentState = Y.encodeStateAsUpdate(ydoc);
    
      }
  
      return newEditor;
  
    } catch (error) {
      console.error(`Error loading tab from IndexedDB:`, error);
      throw error;
    }
  }
  
  // Helper method to compare Uint8Arrays
  private compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  /**
   * Ensure editor content matches Yjs content
   */
  private ensureEditorContent(editor: EditorView, ytext: Y.Text): void {
    const editorContent = editor.state.doc.toString();
    const ytextContent = ytext.toString();

    if (editorContent !== ytextContent) {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: ytextContent
        }
      });
    }
  }

  /**
   * Initialize sync listeners
   */
  private initializeSyncListeners(): void {
    // Listen for Yjs updates
    this.ydocs.forEach((ydoc, index) => {
      ydoc.on('update', (update: Uint8Array) => {
        // Save to IndexedDB
        this.saveYDocToIndexedDB(
          this.yjsProviders[index].getDocId(),
          ydoc
        );
      });
    });

    // Setup custom message handler
    p2pSync.setCustomMessageHandler((message: any, peerId: string) => {
      if (message.type === 'yjs_update' || message.type === 'yjs_sync') {
        const provider = this.yjsProviders.find(p => p.getDocId() === message.docId);
        provider?.handlePeerMessage(message, peerId);
      }
    });
  }

  /**
   * Handle incoming state updates from peers
   */
  public async handleFullState(docsState: any[]): Promise<void> {
    
    for (const docState of docsState) {
      const { docId, state, title } = docState;
      
      // Find if we already have this document
      const existingIndex = this.yjsProviders.findIndex(
        provider => provider.getDocId() === docId
      );

      if (existingIndex === -1) {
        // New document - create it
        await this.loadTabFromIndexedDB(
          title || 'Untitled',
          docId,
          state
        );
      } else {
        // Existing document - merge states
        const ydoc = this.ydocs[existingIndex];
        
        // Apply the update
        Y.applyUpdate(ydoc, new Uint8Array(state));
        
        // Ensure editor content is updated
        const editor = this.editors[existingIndex];
        this.ensureEditorContent(editor, this.ytexts[existingIndex]);
      }
    }

    // Save the updated states to IndexedDB
    await this.saveAllDocsToIndexedDB();
  }


  
  /**
   * Save all document states to IndexedDB
   */
  private async saveAllDocsToIndexedDB(): Promise<void> {
    const allStates = this.yjsProviders.map((provider, index) => {
      const ydoc = this.ydocs[index];
      const state = Y.encodeStateAsUpdate(ydoc);
      
      return {
        docId: provider.getDocId(),
        title: (this.tabList.children[index].querySelector('.tab-title') as HTMLElement)?.textContent,
        state: Array.from(state),
        order: index,
        isHidden: false
      };
    });

    // Save tab information
    await indexDBOverlay.saveData(
      'tabs',
      allStates.map(({ docId, title, order,isHidden  }) => ({ docId, title, order })),
    );

    // Save document states
    for (const { docId, state } of allStates) {
      await indexDBOverlay.saveData(
        'docs',
        {
          docId,
          state
        },
      );
    }
  }

  /**
  * Gets the state of all documents for syncing
  */
 public getAllDocsState(): any[] {
   const allStates = this.yjsProviders.map((provider, index) => {
     const ydoc = this.ydocs[index];
     const docState = Y.encodeStateAsUpdate(ydoc);
     
     return {
       docId: provider.getDocId(),
       title: (this.tabList.children[index].querySelector('.tab-title') as HTMLElement)?.textContent || 'Untitled',
       state: Array.from(docState),
       order: index
     };
   });

   return allStates;
 }
  
  /**
   * Get state of a specific document
   */
  public getDocState(docId: string): any {
    const index = this.yjsProviders.findIndex(
      provider => provider.getDocId() === docId
    );

    if (index !== -1) {
      const ydoc = this.ydocs[index];
      const state = Y.encodeStateAsUpdate(ydoc);
      return Array.from(state);
    }

    return null;
  }

  private async updateTabInDB(tabId: string, data: any) {
    await indexDBOverlay.saveData('tabs', {
      docId: tabId,  // Changed from id to docId
      ...data,
      timestamp: Date.now()
  });
}

private async deleteTabFromDB(tabId: string) {
  await indexDBOverlay.deleteItem('tabs', tabId);
}

private setupEditorButtons(editor: EditorView, index: number) {
  const buttonGroup = document.querySelector('.editor-button-group');
  if (!buttonGroup) return;

  const copyBtn = buttonGroup.querySelector('.copy-btn');
  const shareBtn = buttonGroup.querySelector('.share-btn');
  const downloadMd = buttonGroup.querySelector('.download-md');
  const downloadPdf = buttonGroup.querySelector('.download-pdf');

  // Define handlers
  const handleCopy = async () => {
    const activeEditor = this.editors[this.activeTabIndex];
    const content = activeEditor.state.doc.toString();
    await navigator.clipboard.writeText(content);
    
    // Get the button that was actually clicked
    const svg = buttonGroup.querySelector('.copy-btn svg');
    if (!svg) return;

    const originalPath = svg.innerHTML;
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />';
    
    setTimeout(() => {
      svg.innerHTML = originalPath;
    }, 1000);
  };

  const handleDownloadMd = () => {
    const activeEditor = this.editors[this.activeTabIndex];
    const content = activeEditor.state.doc.toString();
    const title = this.getTabTitle(this.activeTabIndex);
    this.downloadFile(content, `${title}.md`, 'text/markdown');
  };

  const handleDownloadPdf = async () => {
    const activeEditor = this.editors[this.activeTabIndex];
    const content = activeEditor.state.doc.toString();
    const title = this.getTabTitle(this.activeTabIndex);
    const htmlContent = `
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.2;
          max-width: 170mm;
        }
        h1 { font-size: 16pt; margin: 8pt 0; }
        h2 { font-size: 14pt; margin: 6pt 0; }
        h3 { font-size: 12pt; margin: 4pt 0; }
        p { margin: 4pt 0; white-space: normal; }
        pre, code { font-size: 8pt; padding: 2pt; }
      </style>
      ${marked(content, { breaks: true, gfm: true })}
    `;

    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4'
    });
    
    doc.html(htmlContent, {
      callback: function(pdf) {
        pdf.save(`${title}.pdf`);
      },
      margin: [20, 20, 20, 20],
      autoPaging: true,
      width: 500,
      windowWidth: 800
    });
  };

  // Remove old listeners and create new elements
  const newCopyBtn = copyBtn?.cloneNode(true);
  const newShareBtn = shareBtn?.cloneNode(true);
  const newDownloadMd = downloadMd?.cloneNode(true);
  const newDownloadPdf = downloadPdf?.cloneNode(true);

  // Replace old elements with new ones
  if (copyBtn?.parentNode) copyBtn.parentNode.replaceChild(newCopyBtn!, copyBtn);
  if (shareBtn?.parentNode) shareBtn.parentNode.replaceChild(newShareBtn!, shareBtn);
  if (downloadMd?.parentNode) downloadMd.parentNode.replaceChild(newDownloadMd!, downloadMd);
  if (downloadPdf?.parentNode) downloadPdf.parentNode.replaceChild(newDownloadPdf!, downloadPdf);

  // Add new listeners with debounce
  newCopyBtn?.addEventListener('click', debounce(handleCopy, 300));
  newDownloadMd?.addEventListener('click', debounce(handleDownloadMd, 300));
  newDownloadPdf?.addEventListener('click', debounce(handleDownloadPdf, 300));

}



private downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

private getTabTitle(index: number): string {
  return (this.tabList.children[index].querySelector('.tab-title') as HTMLElement)?.textContent || 'Untitled';
}

  
 /**
   * Request a resync of a specific document
   */
 public async requestResync(): Promise<void> {
  if (p2pSync.isConnected()) {
    p2pSync.broadcastCustomMessage({
      type: 'request_all_states'
    });
  }
}

public async clearAllTabs() {
  // Close all tabs in reverse order to avoid index issues
  for (let i = this.editors.length - 1; i >= 0; i--) {
    this.closeTab(null, i, false);
  }

  // Clear arrays just in case
  this.editors = [];
  this.ydocs = [];
  this.ytexts = [];
  this.awarenessList = [];
  this.yjsProviders = [];
  
  // Clear the tab list
  this.tabList.innerHTML = '';
  
  // Clear the editor container
  this.editorContainer.innerHTML = '';
  
  // Reset active tab index
  this.activeTabIndex = 0;

  // Add a fresh initial tab
  await this.addTab();
}


public async saveCurrentTabState() {
  try {
    const currentDb = localStorage.getItem('latestDBName');
    if (!currentDb) {
      console.warn('No current database found');
      return;
    }

    console.log("Current tab state:", {
      tabListLength: this.tabList?.children?.length || 0,
      editorsLength: this.editors?.length || 0,
      providersLength: this.yjsProviders?.length || 0
    });

    const savedTabStates = JSON.parse(localStorage.getItem('savedTabStates') || '{}');
    const currentTabs = await Promise.all(Array.from(this.tabList.children).map(async (tab, index) => {
      const titleElement = tab.querySelector(".tab-title") as HTMLElement;
      const title = titleElement?.textContent || 'Untitled';
      let docId;

      // First try: Check for YJS provider
      const provider = this.yjsProviders[index];
      if (provider) {
        docId = provider.getDocId();
        console.log(`Using YJS provider docId for tab ${index}:`, docId);
      } 
      // Second try: Check for backupName
      else if (backupName) {
        docId = backupName;
        console.log(`Using backupName for tab ${index}:`, docId);
      }
      // Third try: Get first docId from docs table
      else {
        const docs = await indexDBOverlay.getAll('docs');
        if (docs.length > 0) {
          docId = docs[index].docId;
          console.log(`Using first docId from docs table for tab ${index}:`, docId);
        } else {
          console.warn(`No documents found in docs table for tab ${index}`);
        }
      }

      return {
        docId: docId,
        title: title,
        order: index,
        isActive: tab.classList.contains('active'),
        state: {
          awarenessStates: this.awarenessList[index] 
            ? Array.from(this.awarenessList[index].getStates().keys())
            : [],
          lastModified: Date.now()
        }
      };
    }));

    const validTabs = currentTabs.filter(tab => tab && tab.docId);
    
    savedTabStates[currentDb] = validTabs;
    localStorage.setItem('savedTabStates', JSON.stringify(savedTabStates));

    console.log(`Saved ${validTabs.length} tabs for database: ${currentDb}`, validTabs);
  } catch (error) {
    console.error('Error saving tab state:', error, {
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
// Add new method to restore saved tab state
public async restoreSavedTabState(dbName: string) {
  try {
    await this.clearAllTabs();

    const savedTabStates = JSON.parse(localStorage.getItem('savedTabStates') || '{}');
    const savedTabs = savedTabStates[dbName];

    if (!savedTabs?.length) {
      console.log('No saved tabs found for database:', dbName);
      await this.addTab();
      return;
    }

    // Sort tabs by their saved order
    const sortedTabs = [...savedTabs].sort((a, b) => a.order - b.order);
    
    // Restore each saved tab
    for (const tabData of sortedTabs) {
      const savedDoc = await indexDBOverlay.getItem("docs", tabData.docId);
      if (savedDoc?.state) {
        await this.loadTabFromIndexedDB(
          tabData.title,
          tabData.docId,
          savedDoc.state
        );
      }
    }

    // Activate the previously active tab, or first tab as fallback
    const activeTabIndex = sortedTabs.findIndex(tab => tab.isActive);
    this.activateTab(activeTabIndex >= 0 ? activeTabIndex : 0);

    console.log(`Restored ${sortedTabs.length} tabs for database: ${dbName}`);
  } catch (error) {
    console.error('Error restoring tab state:', error);
    await this.addTab();
  }
}
}

