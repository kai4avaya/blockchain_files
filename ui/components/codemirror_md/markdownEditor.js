// import { EditorView, basicSetup } from "codemirror";
// import { EditorState } from "@codemirror/state";
// import { markdown } from "@codemirror/lang-markdown";
// import { indentWithTab } from "@codemirror/commands";
// import { keymap } from "@codemirror/view";
// import { richMarkdocExtension } from "codemirror-rich-markdoc";

// let editor;

// export function initializeMarkdownEditor(initialContent = '') {
//   const editorContainer = document.getElementById('editor-container');
//   if (!editorContainer) {
//     console.error("Editor container not found");
//     return;
//   }

//   editor = new EditorView({
//     state: EditorState.create({
//       doc: initialContent,
//       extensions: [
//         basicSetup,
//         markdown(),
//         keymap.of([indentWithTab]),
//         richMarkdocExtension(),
//       ]
//     }),
//     parent: editorContainer
//   });

//   console.log("Markdown editor initialized");
//   return editor;
// }

// export function getMarkdownEditor() {
//   return editor;
// }

// export function getMarkdownContent() {
//   return editor ? editor.state.doc.toString() : '';
// }

// export function setMarkdownContent(content) {
//   if (editor) {
//     editor.dispatch({
//       changes: { from: 0, to: editor.state.doc.length, insert: content }
//     });
//   }
// }
import * as Y from 'yjs'
import { EditorView, basicSetup } from "codemirror"
import { EditorState } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { indentWithTab } from "@codemirror/commands"
import { keymap } from "@codemirror/view"
import { richMarkdocExtension } from "codemirror-rich-markdoc"
import { YjsPeerProvider } from './providers/YjsPeerProvider'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'

let editor;
const ydoc = new Y.Doc();
const ytext = ydoc.getText('codemirror');
let provider;

// Create a container for user cursors
const cursorContainer = document.createElement('div');
cursorContainer.className = 'cursor-container';
document.body.appendChild(cursorContainer);

export function initializeMarkdownEditor(initialContent = '', roomName = 'default-room') {
  const editorContainer = document.getElementById('editor-container');
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

  // Create editor extensions including collaboration features
  const extensions = [
    basicSetup,
    markdown(),
    keymap.of([indentWithTab]),
    richMarkdocExtension(),
    yCollab(ytext, provider.awareness, { cursorContainer }),
    keymap.of(yUndoManagerKeymap),
    EditorView.updateListener.of(update => {
      if (update.selectionSet) {
        const selection = update.state.selection.main;
        provider.updateCursor(selection.anchor, selection.head);
      }
    }),
    // Add version history widget
    EditorView.domEventHandlers({
      click: (event, view) => {
        if (event.target.classList.contains('version-restore')) {
          const version = event.target.getAttribute('data-version');
          if (version) {
            restoreVersion(version);
          }
        }
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

  // Add version history UI
  setupVersionHistory(editorContainer);

  console.log("Markdown editor initialized");
  return editor;
}

function setupVersionHistory(container) {
  const historyContainer = document.createElement('div');
  historyContainer.className = 'version-history';
  container.appendChild(historyContainer);

  // Store version every minute
  setInterval(() => {
    const version = {
      content: ytext.toString(),
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };
    const versions = getVersionHistory();
    versions.push(version);
    localStorage.setItem('version-history', JSON.stringify(versions));
    updateVersionHistoryUI(historyContainer);
  }, 60000);

  // Initial UI update
  updateVersionHistoryUI(historyContainer);
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

function getVersionHistory() {
  const stored = localStorage.getItem('version-history');
  return stored ? JSON.parse(stored) : [];
}

function restoreVersion(versionId) {
  const versions = getVersionHistory();
  const version = versions.find(v => v.id === versionId);
  if (version) {
    setMarkdownContent(version.content);
  }
}

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

// Add undo/redo methods
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

window.addEventListener('beforeunload', () => {
  if (provider) {
    provider.destroy();
  }
  if (ydoc) {
    ydoc.destroy();
  }
});