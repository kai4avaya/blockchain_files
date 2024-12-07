import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range } from "@codemirror/state";
// @ts-ignore
import contextManager from '../../../../../../ai/providers/context_manager.js';
import { safetyUtils } from './safetyUtils'

const placeholderDecoration = Decoration.line({
  attributes: { class: "cm-ai-placeholder" }
});

class AIPluginView {
  decorations: DecorationSet;
  private lastLineLength: number = 0;
  private isStreaming: boolean = false;
  private currentStreamId: string | null = null;
  private stopButton!: HTMLButtonElement;
  private view: EditorView;
  private generatingInterval: NodeJS.Timeout | null = null;

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
        if (line.text.endsWith("]]]")) {
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
      
      const startPos = safetyUtils.safePosition(line.to + 1, view);
      let currentLength = 0;
      
      // Safe initial dispatch
      safetyUtils.safeDispatch(view, {
        from: line.to,
        insert: '\nGenerating.'
      });
      
      let dots = 1;
      this.generatingInterval = setInterval(() => {
        view.dispatch({
          changes: {
            from: line.to + 11, // "Generating" length is 10 + 1 for newline
            to: line.to + 11 + dots,
            insert: '.'.repeat((dots % 3) + 1)
          }
        });
        dots = (dots % 3) + 1;
      }, 500);
      
      const response = await contextManager.getContextualResponse(prompt);
      
      if (this.generatingInterval) {
        clearInterval(this.generatingInterval);
        this.generatingInterval = null;
      }
      view.dispatch({
        changes: {
          from: line.to,
          to: line.to + 14, // Maximum length of "Generating..." + newline
          insert: '\n'
        }
      });
      
      let fullText = '';
      
      for await (const chunk of response) {
        if (!this.isStreaming) break;
        
        try {
          // Debug logging
          let content = '';
          if (typeof chunk === 'string') {
            if (chunk.startsWith('data: ')) {
              try {
                const jsonStr = chunk.slice(5).trim(); // Remove 'data: ' and trim
                const parsedChunk = JSON.parse(jsonStr);
                content = parsedChunk?.choices?.[0]?.delta?.content || '';
              } catch (parseError) {
                console.error('JSON parse error:', parseError);
              }
            } else {
              // Try parsing the whole chunk as JSON
              try {
                const parsedChunk = JSON.parse(chunk);
                content = parsedChunk?.choices?.[0]?.delta?.content || '';
              } catch (parseError) {
                // If not JSON, use the chunk as-is
                content = chunk;
              }
            }
          } else if (chunk?.choices?.[0]?.delta?.content) {
            content = chunk.choices[0].delta.content;
          }
          
          if (content) {
            fullText += content;
            
            safetyUtils.safeDispatch(view, {
              from: safetyUtils.safePosition(startPos, view),
              to: safetyUtils.safePosition(startPos + currentLength, view),
              insert: fullText,
              scrollIntoView: true
            });
            
            currentLength = fullText.length;
          }
        } catch (e) {
          console.error('Error processing chunk:', e);
        }
      }

    } catch (error) {
      if (this.generatingInterval) {
        clearInterval(this.generatingInterval);
        this.generatingInterval = null;
      }
      console.error('Error getting response:', error);
      this.handleError(view, line, error);
    } finally {
      this.isStreaming = false;
      this.hideStopButton();
    }
  }

  private handleError(view: EditorView, line: any, error: any) {
    console.error('Error in handleAIRequest:', error);
    
    const errorMessage = error instanceof Error ? 
        error.message : 
        'Unknown error occurred';
    
    requestAnimationFrame(() => {
        try {
            const docLength = view.state.doc.length;
            view.dispatch({
                changes: {
                    from: docLength,
                    insert: `\nError: ${errorMessage}`
                }
            });
        } catch (e) {
            console.error('Failed to show error message:', e);
        }
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
    if (this.generatingInterval) {
      clearInterval(this.generatingInterval);
      this.generatingInterval = null;
    }
  }

  destroy() {
    if (this.generatingInterval) {
      clearInterval(this.generatingInterval);
      this.generatingInterval = null;
    }
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