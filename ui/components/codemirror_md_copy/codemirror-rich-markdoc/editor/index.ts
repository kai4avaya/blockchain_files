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
import { atMentionsExtension } from './extensions/atMentions'

// collabo
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { universalDragExtension } from './extensions/universalDrag'
import { createSafetyExtension } from './extensions/safetyExtension';



// import doc from './example.md?raw'
// In createEditorState (index.ts)
export function createEditorState(ytext: Y.Text, awareness: Awareness) {
  // Get the initial content from ytext
  const initialDoc = ytext.toString();
  
  return EditorState.create({
    doc: initialDoc, // Set initial document content
    extensions: [
      richEditor({
        markdoc: config,
        lezer: {
          codeLanguages: languages,
          extensions: [Table],
        },
      }),
      EditorView.lineWrapping,
      EditorView.theme({
        "&.cm-focused": {
          outline: "none",
        },
      }),
      universalDragExtension,
      history(),
      drawSelection(),
      rectangularSelection(),
      highlightActiveLine(),
      indentOnInput(),
      // simpleSafetyExtension(), //
      createSafetyExtension(),
      syntaxHighlighting(defaultHighlightStyle),
      yCollab(ytext, awareness),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const cursorPositions = awareness.getStates();
          for (const [clientId, state] of cursorPositions) {
            if (state.cursor) {
              const user = state.user || { color: 'black', name: 'Anonymous' };
              const cursorEl = document.createElement('span');
              cursorEl.style.borderLeft = `2px solid ${user.color}`;
              cursorEl.style.marginLeft = '-1px';
              cursorEl.style.height = '100%';
              cursorEl.style.position = 'absolute';

              const label = document.createElement('div');
              label.style.position = 'absolute';
              label.style.top = '-1.5em';
              label.style.left = '0';
              label.style.backgroundColor = user.color;
              label.style.color = 'white';
              label.style.padding = '2px 4px';
              label.style.borderRadius = '4px';
              label.textContent = user.name;

              cursorEl.appendChild(label);

              const selectionEl = document.createElement('div');
              selectionEl.style.backgroundColor = `${user.color}33`;

              // Add cursor and selection elements to the editor
              // You might need to implement a method to add these elements to the correct positions
            }
          }
        }
      }),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      aiExtension,
      atMentionsExtension,
    ],
  });
}


