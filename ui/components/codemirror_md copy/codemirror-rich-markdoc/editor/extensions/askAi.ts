import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range, StateEffect } from "@codemirror/state";
// @ts-ignore
import contextManager from '../../../../../../ai/providers/context_manager.js';

const placeholderDecoration = Decoration.line({
  attributes: { class: "cm-ai-placeholder" }
});

// Create a StateEffect for streaming updates
const addStreamContent = StateEffect.define<string>();

const aiPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  private lastLineLength: number = 0;
  private isStreaming: boolean = false;
  private currentStreamId: string | null = null;
  private streamBuffer: string = '';

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
        if (line.text.endsWith(">>>")) {
          this.handleTestResponse(update.view, line);
        }
        else if (line.text.endsWith("//")) {
          // Use setTimeout to avoid update-in-progress error
          setTimeout(() => this.handleAIRequest(update.view, line), 0);
        }
      }
      
      this.lastLineLength = line.length;
    }
  }

  async handleAIRequest(view: EditorView, line: any) {
    try {
      this.isStreaming = true;
      const prompt = line.text.slice(0, -2);

      // Initial newline
      view.dispatch({
        changes: {
          from: line.to,
          insert: '\n'
        }
      });
      
      const startPos = line.to + 1;
      const response = await contextManager.getContextualResponse(prompt);
      
      if (!response || !response[Symbol.asyncIterator]) {
        throw new Error('Invalid response from AI');
      }

      let accumulatedText = '';
      
      // Stream the response
      for await (const chunk of response) {
        if (!this.isStreaming) break;
        
        accumulatedText += chunk;
        
        // Use requestAnimationFrame to batch updates
        requestAnimationFrame(() => {
          if (!this.isStreaming) return;
          
          view.dispatch({
            changes: {
              from: startPos,
              to: view.state.doc.length,
              insert: accumulatedText
            },
            scrollIntoView: true
          });
        });
      }

    } catch (error) {
      console.error('Error getting AI response:', error);
      
      requestAnimationFrame(() => {
        view.dispatch({
          changes: {
            from: line.to,
            insert: `\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          }
        });
      });
      
    } finally {
      this.isStreaming = false;
      this.currentStreamId = null;
    }
  }

  handleTestResponse(view: EditorView, line: any) {
    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: "Hello from CodeMirror!"
      }
    });
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