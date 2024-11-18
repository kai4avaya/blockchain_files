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
  '🦗', '🕸️', '🦂', '🦖', '🦕', '🦒', '🦙', '🦛', '🦘', '🦥', '🦨', '🦡', 
];


const EDITOR_DB_NAME = "editorDB";
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
  }

  

// Modify initialize() to properly handle the loaded editor
async initialize() {
  try {
    const savedTabs = await indexDBOverlay.getData("tabs");
    if (savedTabs?.length > 0) {
      const sortedTabs = [...savedTabs].sort((a, b) => a.order - b.order);
      
      // Load all tabs first
      for (const tabData of sortedTabs) {
        const savedDoc = await indexDBOverlay.getItem("docs", tabData.docId);
        if (savedDoc?.state) {
          await this.loadTabFromIndexedDB(
            tabData.title || "Untitled", 
            tabData.docId,
            EDITOR_DB_NAME,
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
      // await this.addTab("Untitled", "doc-welcome-" + generateUniqueId(3));
      await this.addTab(this.makeTitle(), "doc-welcome-" + generateUniqueId(3));

    }
  } catch (error) {
    console.error("Error in TabManager initialization:", error);
    await this.addTab(this.makeTitle(), "doc-welcome-" + generateUniqueId(3));
  }
}




  createTab(title: string) {
    const tab = document.createElement("div");
    tab.className = "editor-tab";

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

  private closeTab(e: Event | null, index: number, broadcast: boolean = true) {
    // Prevent closing if there's only one tab open
    if (this.editors.length <= 1) {
      alert("Cannot close the last tab.");
      return;
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
  }

  makeTitle(title?: string)
  {
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const tabTitle = title || `Untitled${randomEmoji}`;
    return tabTitle
  }

  addTab(title?: string, docId?: string) {
    const tabIndex = this.editors.length;
    const tabTitle = this.makeTitle(title) // title || `Untitled ${randomEmoji}`;
    
    const documentId = docId || this.generateDocId(tabTitle + '-' + Date.now());
    // Check if a tab with this docId already exists
    if (this.yjsProviders.find((provider) => provider.getDocId() === documentId)) {
      console.log("Tab with this docId already exists.");
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
    EDITOR_DB_NAME
  );
  await this.triggerFullSyncToPeers(); // Add this line
}, 1000);


  private async saveTabsToIndexedDB() {
    const tabsData = this.yjsProviders.map((provider, index) => ({
      title: (this.tabList.children[index].querySelector(".tab-title") as HTMLElement).textContent,
      docId: provider.getDocId(),
      order: index
    }));
  
    await indexDBOverlay.saveData("tabs", tabsData, EDITOR_DB_NAME);
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
      getInitialData: () => {
        return {
          type: "tab",
          index: Array.from(this.tabList.children).indexOf(tab),
        };
      },
      onDragStart: () => {
        console.log("Started dragging tab", tab.textContent);
      },
      onDrop: () => {
        console.log("Finished dragging tab", tab.textContent);
      },
    });
  }

  // // Fix the renameTab method to update existing data instead of creating new
  // private async renameTab(index: number, newTitle: string) {
  //   const provider = this.yjsProviders[index];
  //   const oldDocId = provider.getDocId();
  //   const newDocId = this.generateDocId(newTitle);
  
  //   // Update the tab title
  //   const tab = this.tabList.children[index];
  //   const titleElement = tab.querySelector(".tab-title") as HTMLElement;
  //   titleElement.textContent = newTitle;
  
  //   try {
  //     // Get and update the tab entry directly
  //     const savedTabs = (await indexDBOverlay.getData("tabs", EDITOR_DB_NAME)) || [];
  //     const updatedTabs = savedTabs.map((tab: any) =>
  //       tab.docId === oldDocId ? { ...tab, title: newTitle } : tab
  //     );
  
  //     // Save the updated tabs list
  //     await indexDBOverlay.saveData("tabs", updatedTabs, EDITOR_DB_NAME);
  
  //     // Update the doc entry directly without creating a new one
  //     const savedDoc = await indexDBOverlay.getItem("docs", oldDocId, EDITOR_DB_NAME);
  //     if (savedDoc) {
  //       savedDoc.title = newTitle;
  //       await indexDBOverlay.saveData("docs", savedDoc, EDITOR_DB_NAME);
  //     }
  
  //     // Update the docId in the provider
  //     provider.updateDocId(newDocId);
  
  //     // Trigger a full sync after all updates
  //     await this.triggerFullSyncToPeers();
  
  //   } catch (error) {
  //     console.error("Error updating tab:", error);
  //     titleElement.textContent = oldDocId.replace("doc-", "");
  //   }
  // }

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
          EDITOR_DB_NAME
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

        console.log("Drop position:", { fromIndex, toIndex });

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
    dbName: string,
    savedState?: number[]
  ) {
    try {
      // Create Yjs document and get text
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("codemirror");
      const awareness = new Awareness(ydoc);
  
      console.log("Loading tab with title:", title, "and docId:", docId);
      
      // Important: Apply saved state BEFORE creating the editor
      if (savedState) {
        console.log("Applying saved state:", savedState.length, "bytes");
        Y.applyUpdate(ydoc, new Uint8Array(savedState));
        
        // Verify the content was loaded
        console.log("Content loaded into ytext:", ytext.toString());
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
  
      // Verify editor content
      console.log("Editor content loaded:", newEditor.state.doc.toString());
  
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
        console.log(
          "Final state verification:",
          "Saved:", savedState.length,
          "Current:", currentState.length,
          "Equal:", this.compareUint8Arrays(new Uint8Array(savedState), currentState)
        );
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
      console.log('Syncing editor content with Yjs content');
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
    console.log('Handling full state update:', docsState);
    
    for (const docState of docsState) {
      const { docId, state, title } = docState;
      
      // Find if we already have this document
      const existingIndex = this.yjsProviders.findIndex(
        provider => provider.getDocId() === docId
      );

      if (existingIndex === -1) {
        // New document - create it
        console.log(`Creating new tab for doc ${docId}`);
        await this.loadTabFromIndexedDB(
          title || 'Untitled',
          docId,
          'editorDB',
          state
        );
      } else {
        // Existing document - merge states
        console.log(`Updating existing doc ${docId}`);
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
        order: index
      };
    });

    // Save tab information
    await indexDBOverlay.saveData(
      'tabs',
      allStates.map(({ docId, title, order }) => ({ docId, title, order })),
      'editorDB'
    );

    // Save document states
    for (const { docId, state } of allStates) {
      await indexDBOverlay.saveData(
        'docs',
        {
          docId,
          state
        },
        'editorDB'
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

   console.log('Getting all doc states:', allStates);
   return allStates;
 }
  
  private clearLocalState(docId: string): void {
    const index = this.yjsProviders.findIndex(
      (provider) => provider.getDocId() === docId
    );

    if (index !== -1) {
      const ydoc = this.ydocs[index];
      ydoc.transact(() => {
        const yText = ydoc.getText("codemirror");
        yText.delete(0, yText.length);
      });

      const editor = this.editors[index];
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: "" },
      });
    }
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


  
 /**
   * Request a resync of a specific document
   */
 public async requestResync(): Promise<void> {
  if (p2pSync.isConnected()) {
    console.log('Requesting resync for all tabs...');
    p2pSync.broadcastCustomMessage({
      type: 'request_all_states'
    });
  }
}
}