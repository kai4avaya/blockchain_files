import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range } from "@codemirror/state";
// @ts-ignore
import contextManager from '../../../../../../ai/providers/context_manager.js';

const placeholderDecoration = Decoration.line({
  attributes: { class: "cm-ai-placeholder" }
});

const aiPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  private lastLineLength: number = 0;
  private isStreaming: boolean = false;
  private currentStreamId: string | null = null;

  constructor(view: EditorView) {
    this.decorations = this.createDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet) {
      this.decorations = this.createDecorations(update.view);
    }

    if (update.docChanged && !this.isStreaming) {
      let pos = update.state.selection.main.head;
      let line = update.state.doc.lineAt(pos);
      
      if (line.length > this.lastLineLength) {
        // Keep original test trigger
        if (line.text.endsWith(">>>")) {
          this.handleTestResponse(update.view, line);
        }
        // Add new AI trigger
        else if (line.text.endsWith("//")) {
          this.handleAIRequest(update.view, line);
        }
      }
      
      this.lastLineLength = line.length;
    }
  }

  // Keep original test function
  handleTestResponse(view: EditorView, line: any) {
    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: "Hello from CodeMirror!"
      }
    });
  }

  async handleAIRequest(view: EditorView, line: any) {
    try {
      this.isStreaming = true;
      
      // Get the entire document content as context
      const docContent = view.state.doc.toString();
      
      // Remove the triggering //
      const prompt = docContent.slice(0, -2);

      // Start streaming response
      const response = await contextManager.getContextualResponse(prompt, {
        onToken: (token: string) => {
          view.dispatch({
            changes: { 
              from: line.to, 
              insert: token 
            },
            scrollIntoView: true
          });
        }
      });

      this.currentStreamId = response.streamId;

    } catch (error) {
      console.error('Error getting AI response:', error);
      view.dispatch({
        changes: {
          from: line.to,
          insert: `\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }
      });
    } finally {
      this.isStreaming = false;
      this.currentStreamId = null;
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

  stopStream() {
    if (this.currentStreamId) {
      contextManager.stopResponse(this.currentStreamId);
      this.isStreaming = false;
      this.currentStreamId = null;
    }
  }
}, {
  decorations: v => v.decorations,
  eventHandlers: {
    keydown: (e: KeyboardEvent, view: EditorView) => {
      if (e.key === 'Escape') {
        const plugin = view.plugin(aiPlugin);
        if (plugin) plugin.stopStream();
      }
    }
  }
});

export const aiExtension = [aiPlugin];