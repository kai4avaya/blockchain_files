// File: ui/components/codemirror_md/codemirror-rich-markdoc/editor/index.ts

import { EditorState } from '@codemirror/state'
import { keymap, EditorView, drawSelection, rectangularSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { Table } from '@lezer/markdown'

import richEditor from '../src'
import config from './markdoc'
import './style.css'

import { aiExtension } from './extensions/askAi'
import { TabManager } from './extensions/tabManager'

// collabo
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { p2pSync } from '../../../../../network/peer2peer_simple'; // Adjust the import path accordingly
import { YjsPeerJSProvider } from '../../../../../network/yjs-peerjs-provider';


// @ts-expect-error
import doc from './example.md?raw'

// Remove Yjs initialization from createEditorState
export function createEditorState(ytext: Y.Text, awareness: Awareness) {
  return EditorState.create({
    extensions: [
      richEditor({
        markdoc: config,
        lezer: {
          codeLanguages: languages,
          extensions: [Table],
        },
      }),
      EditorView.lineWrapping,
      history(),
      drawSelection(),
      rectangularSelection(),
      highlightActiveLine(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      yCollab(ytext, awareness),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      aiExtension,
    ],
  });
}




// export function initializeEditor(containerElement: Element) {
//   if (!containerElement) {
//     throw new Error("Editor container element not found")
//   }

//   const tabManager = new TabManager(containerElement)
//   tabManager.initialize()

//   return tabManager
// }

// export function initializeEditor(containerElement: Element) {
//   if (!containerElement) {
//     throw new Error('Editor container element not found');
//   }

//   // Initialize Yjs Document and Awareness
//   const ydoc = new Y.Doc();
//   const ytext = ydoc.getText('codemirror');
//   const awareness = new Awareness(ydoc);

//   // Set initial content if empty
//   if (ytext.length === 0) {
//     ytext.insert(0, doc);
//   }

//   // Initialize Yjs PeerJS Provider
//   const yjsProvider = new YjsPeerJSProvider(ydoc, p2pSync);

//   // Initialize TabManager
//   const tabManager = new TabManager(containerElement, ydoc, awareness, yjsProvider);
//   tabManager.initialize();

//   return { tabManager };
// }

export function initializeEditor(containerElement: Element) {
  if (!containerElement) {
    throw new Error('Editor container element not found');
  }

  // Initialize TabManager
  const tabManager = new TabManager(containerElement);
  tabManager.initialize();

  return { tabManager };
}


