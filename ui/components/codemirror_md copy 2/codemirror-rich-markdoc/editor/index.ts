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

// @ts-expect-error
import doc from './example.md?raw'

export function createEditorState() {
  return EditorState.create({
    doc,
    extensions: [
      richEditor({
        markdoc: config,
        lezer: {
          codeLanguages: languages,
          extensions: [Table]
        }
      }),
      EditorView.lineWrapping,
      history(),
      drawSelection(),
      rectangularSelection(),
      highlightActiveLine(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      aiExtension,
    ],
  })
}

export function initializeEditor(containerElement: Element) {
  if (!containerElement) {
    throw new Error("Editor container element not found")
  }

  const tabManager = new TabManager(containerElement)
  tabManager.initialize()

  return tabManager
}