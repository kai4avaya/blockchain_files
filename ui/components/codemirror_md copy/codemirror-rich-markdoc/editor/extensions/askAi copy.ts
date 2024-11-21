import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range, StateEffect } from "@codemirror/state";
// @ts-ignore
import contextManager from '../../../../../../ai/providers/context_manager.js';

const placeholderDecoration = Decoration.line({
  attributes: { class: "cm-ai-placeholder" }
});

// Create a StateEffect for streaming updates
const addStreamContent = StateEffect.define<string>();

class AIPluginView {
  decorations: DecorationSet;
  private lastLineLength: number = 0;
  private isStreaming: boolean = false;
  private currentStreamId: string | null = null;
  private stopButton!: HTMLButtonElement;
  private view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    this.decorations = this.createDecorations(view);
    this.createStopButton();
  }

  private createStopButton() {
    this.stopButton = document.createElement('button');
    this.stopButton.className = 'cm-stop-button';
    
    // Updated HTML to show ctrl/cmd in keyboard-like element
    this.stopButton.innerHTML = `
      <span class="key-combo">
        <span class="key">${navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}</span>
        <span class="key">⌫</span>
      </span>
      <span class="stop-text">to stop</span>
    `;
    
    this.stopButton.onclick = () => {
      // Hide button immediately before any other operations
      this.hideStopButton();
      
      if (this.currentStreamId) {
        contextManager.stopResponse(this.currentStreamId);
        this.stopStream();
      }
    };
    document.body.appendChild(this.stopButton);
  }

  private showStopButton() {
    this.stopButton.classList.add('visible');
  }

  private hideStopButton() {
    this.stopButton.classList.remove('visible');
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
      this.showStopButton();
      const prompt = line.text.slice(0, -2);
      
      // Remember initial insertion point
      const startPos = Math.min(line.to + 1, view.state.doc.length);
      
      // Add initial newline
      view.dispatch({
        changes: {
          from: line.to,
          insert: '\n'
        }
      });
      
      const response = await contextManager.getContextualResponse(prompt);
      let fullText = '';
      
      // Stream response for immediate feedback
      for await (const chunk of response) {
        if (!this.isStreaming) break;
        fullText += chunk;
        
        // Show streaming updates
        view.dispatch({
          changes: {
            from: startPos,
            to: startPos + fullText.length - chunk.length,
            insert: fullText
          },
          scrollIntoView: true
        });
      }

      // Final formatting pass - replace entire response
      if (this.isStreaming && fullText) {
        view.dispatch({
          changes: {
            from: startPos,
            to: startPos + fullText.length,
            insert: fullText
          },
          scrollIntoView: true
        });
      }

    } catch (error: unknown) {
      console.error('Error getting response:', error);
      this.handleError(view, line, error);
    } finally {
      this.isStreaming = false;
      this.hideStopButton();
    }
  }

  private handleError(view: EditorView, line: any, error: any) {
    console.error('Error in handleAIRequest:', error);
    
    requestAnimationFrame(() => {
      view.dispatch({
        changes: {
          from: line.to,
          insert: `\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }
      });
    });
    
    if (this.currentStreamId) {
      contextManager.stopResponse(this.currentStreamId);
    }
    this.isStreaming = false;
    this.currentStreamId = null;
    this.hideStopButton();
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
    this.isStreaming = false;  // Set this first
    
    if (this.currentStreamId) {
      contextManager.stopResponse(this.currentStreamId);
      this.currentStreamId = null;
      
      // Get the current view
      const view = this.view;
      if (view) {
        const lastLine = view.state.doc.line(view.state.doc.lines);
        
        requestAnimationFrame(() => {
          view.dispatch({
            changes: {
              from: lastLine.from,
              to: view.state.doc.length,
              insert: '\n[Stopped]'
            }
          });
        });
      }
    }
  }

  destroy() {
    this.stopButton.remove();
  }
}

const aiPlugin = ViewPlugin.fromClass(AIPluginView, {
  decorations: v => v.decorations,
  eventHandlers: {
    keydown: (e: KeyboardEvent, view: EditorView) => {
      if (e.key === 'Escape' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) {
        const plugin = view.plugin(aiPlugin);
        if (plugin) plugin.stopStream();
      }
    }
  }
});

export const aiExtension = [aiPlugin];