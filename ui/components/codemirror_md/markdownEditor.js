import * as Y from 'yjs'
import { keymap, EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { EditorState } from "@codemirror/state"
import { indentWithTab } from "@codemirror/commands"
import richEditor from "./codemirror-rich-markdoc/src"
import { YjsPeerProvider } from './providers/YjsPeerProvider'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { languages } from '@codemirror/language-data'
import { Table } from '@lezer/markdown'
import config from './codemirror-rich-markdoc/editor/markdoc'
import './codemirror-rich-markdoc/editor/style.css'

let editor;
const ydoc = new Y.Doc();
const ytext = ydoc.getText('codemirror');
let provider;

// Create a container for user cursors
const cursorContainer = document.createElement('div');
cursorContainer.className = 'cursor-container';
document.body.appendChild(cursorContainer);

export function initializeMarkdownEditor(initialContent = '', roomName = 'default-room', container = null) {
  const editorContainer = container || document.getElementById('editor-container');
  if (!editorContainer) {
    console.error("Editor container not found");
    return;
  }

  // Initialize the Yjs provider with room name
  provider = new YjsPeerProvider(ydoc, roomName);

  // Set initial content if provided
  if (initialContent && ytext.length === 0) {
    ytext.insert(0, initialContent);
  }  

  const extensions = [
    basicSetup,
    yCollab(ytext, provider.awareness, { cursorContainer }),
    keymap.of([indentWithTab]),
    keymap.of(yUndoManagerKeymap),
    ...richEditor({
      markdoc: config,
      lezer: {
        codeLanguages: languages,
        extensions: [Table]
      }
    }),
    EditorView.updateListener.of(update => {
      if (update.selectionSet) {
        const selection = update.state.selection.main;
        provider.updateCursor(selection.anchor, selection.head);
      }
    })
  ];

  editor = new EditorView({
    state: EditorState.create({
      doc: ytext.toString(),
      extensions
    }),
    parent: editorContainer
  });

  setupVersionHistory(editorContainer);
  console.log("Markdown editor initialized");
  return editor;
}


function getVersionHistory() {
  const stored = localStorage.getItem('version-history');
  return stored ? JSON.parse(stored) : [];
}

function updateVersionHistoryUI(container) {
  const versions = getVersionHistory();
  container.innerHTML = `
    <h3>Version History</h3>
    ${versions.map(v => `
      <div class="version-entry">
        ${new Date(v.timestamp).toLocaleString()}
        <button class="version-restore" data-version="${v.id}">Restore</button>
      </div>
    `).join('')}
  `;
}


function setupVersionHistory(container) {
  const historyContainer = document.createElement('div');
  historyContainer.className = 'version-history';
  container.appendChild(historyContainer);

  setInterval(() => {
    saveVersion();
    updateVersionHistoryUI(historyContainer);
  }, 60000);

  updateVersionHistoryUI(historyContainer);
}
function saveVersion() {
  const version = {
    content: ytext.toString(),
    timestamp: new Date().toISOString(),
    id: Date.now().toString()
  };
  const versions = getVersionHistory();
  versions.push(version);
  localStorage.setItem('version-history', JSON.stringify(versions));
}

// Export functions for external use
export function getMarkdownEditor() {
  return editor;
}

export function getMarkdownContent() {
  return editor ? editor.state.doc.toString() : '';
}

export function setMarkdownContent(content) {
  if (editor) {
    const start = 0;
    const end = ytext.length;
    ytext.delete(start, end);
    ytext.insert(start, content);
  }
}

export function undo() {
  if (provider) {
    provider.undo();
  }
}

export function redo() {
  if (provider) {
    provider.redo();
  }
}

export function cleanup() {
  if (provider) {
    provider.destroy();
  }
  if (ydoc) {
    ydoc.destroy();
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);