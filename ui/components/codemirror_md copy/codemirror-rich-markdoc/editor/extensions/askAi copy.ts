import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range } from "@codemirror/state";
// import { StateField, StateEffect, Transaction } from "@codemirror/state";

// Placeholder decoration
const placeholderDecoration = Decoration.line({
  attributes: { class: "cm-ai-placeholder" }
});

// Mock AI responses
const mockResponses = {
  shortResponse: "This is a short AI response.\nIt can span multiple lines.\nUse this for quick queries.",
  longResponse: "This is a longer AI response.\nIt can provide more detailed information.\nUse this for comprehensive analysis.\nIt can include multiple paragraphs or sections.\nFeel free to expand on complex topics here."
};

// Function to stream text asynchronously
function streamTextAsync(view: EditorView, text: string, pos: number) {
  let index = 0;
  function insertNextChar() {
    if (index < text.length) {
      setTimeout(() => {
        view.dispatch({
          changes: { from: pos, insert: text[index] },
          scrollIntoView: true
        });
        pos++;
        index++;
        insertNextChar();
      }, 50); // Adjust timing as needed
    }
  }
  insertNextChar();
}

// Plugin to manage placeholders and AI responses
const aiPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  private lastLineLength: number = 0;

  constructor(view: EditorView) {
    this.decorations = this.createDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet) {
      this.decorations = this.createDecorations(update.view);
    }

    // Check for // or /// at the end of lines
    if (update.docChanged) {
      let pos = update.state.selection.main.head;
      let line = update.state.doc.lineAt(pos);
      
      if (line.length > this.lastLineLength) {
        if (line.text.endsWith("//")) {
          setTimeout(() => streamTextAsync(update.view, "\n" + mockResponses.shortResponse, line.to), 0);
        } else if (line.text.endsWith(">>>")) {
          setTimeout(() => streamTextAsync(update.view, "\n" + mockResponses.longResponse, line.to), 0);
        }
      }
      
      this.lastLineLength = line.length;
    }
  }

  createDecorations(view: EditorView) {
    let decorations: Range<Decoration>[] = [];
    let cursorPos = view.state.selection.main.head;
    let line = view.state.doc.lineAt(cursorPos);
    
    if (line.length === 0) {
      decorations.push(placeholderDecoration.range(line.from));
    }
    
    return Decoration.set(decorations);
  }
}, {
  decorations: v => v.decorations
});

export const aiExtension = [aiPlugin];