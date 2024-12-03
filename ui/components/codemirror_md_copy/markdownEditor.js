import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { richMarkdocExtension } from "codemirror-rich-markdoc";

let editor;

export function initializeMarkdownEditor(initialContent = '') {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) {
    console.error("Editor container not found");
    return;
  }

  editor = new EditorView({
    state: EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        markdown(),
        keymap.of([indentWithTab]),
        richMarkdocExtension(),
      ]
    }),
    parent: editorContainer
  });

  console.log("Markdown editor initialized");
  return editor;
}

export function getMarkdownEditor() {
  return editor;
}

export function getMarkdownContent() {
  return editor ? editor.state.doc.toString() : '';
}

export function setMarkdownContent(content) {
  if (editor) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
}