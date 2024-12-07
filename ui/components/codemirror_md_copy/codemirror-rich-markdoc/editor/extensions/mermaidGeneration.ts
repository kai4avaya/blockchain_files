import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
// import indexDBOverlay from "../../../../../../memory/local/file_worker.js";
import { StateEffect } from "@codemirror/state";
// @ts-ignore
import diagramContextManager from '../../../../../../ai/providers/context_manager_diagrams.js';
// @ts-ignore

import { generateAndSaveMermaidDiagram } from '../../../../../../ai/providers/mermaid/mermaid_api_worker.js';
// @ts-ignore

import toast from '../../../../toast-alert.js';
// import { processImageFile, ImageProcessingResult } from './imageProcessor';
import { processImageFile } from './imageUpload';


// @ts-ignore
import {  startPersistentStatus, completePersistentStatus, startMasterStatus, completeMasterStatus } from '../../../../process.js'


import { generateUniqueId } from "../../../../../../utils/utils.js";
import { safetyUtils } from './safetyUtils'
import { handleAsciiDiagramFallback } from "./asciiDiagramGeneration.js";


class SkeletonWidget extends WidgetType {
    private content: string = 'loading';

    constructor() {
        super();
    }

    clear() {
        this.content = '';
    }

    toDOM() {
        if (!this.content) {
            const span = document.createElement('span');
            span.style.display = 'none';
            return span;
        }

        const div = document.createElement('div');
        div.className = 'mermaid-skeleton-loader';
        div.innerHTML = `
            <div class="skeleton-container">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
            </div>
        `;
        return div;
    }
}

// Create skeleton decoration with proper widget type
const skeletonDecoration = Decoration.widget({
    widget: new SkeletonWidget(),
    side: 1
});


class MermaidGenerationPlugin {
    decorations: DecorationSet;
    private isGenerating: boolean = false;
    private view: EditorView;
    private lastLineLength: number = 0;
    private stopButton!: HTMLButtonElement;
    private currentStreamId: string | null = null;
    private skeletonWidget: SkeletonWidget = new SkeletonWidget();
    private skeletonDecorations: DecorationSet | null = null;
    private MAX_RETRIES = 3;

    constructor(view: EditorView) {
        this.view = view;
        this.decorations = Decoration.none;
        this.createStopButton();
    }

    private createStopButton() {
        this.stopButton = document.createElement('button');
        this.stopButton.className = 'cm-stop-button';
        
        this.stopButton.innerHTML = `
            <span class="key-combo">
                <span class="key">${navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}</span>
                <span class="key">⌫</span>
            </span>
            <span class="stop-text">to stop</span>
        `;
        
        this.stopButton.onclick = () => {
            this.hideStopButton();
            this.stopGeneration();
        };
        document.body.appendChild(this.stopButton);
    }

    private showStopButton() {
        this.stopButton.classList.add('visible');
    }

    private hideStopButton() {
        this.stopButton.classList.remove('visible');
    }

    private stopGeneration() {
        if (this.isGenerating) {
            this.isGenerating = false;
            // Add any cleanup needed
            this.hideStopButton();
        }
    }

    // Add this helper function to convert base64 to File
    private base64ToFile(base64: string, filename: string): File {
        const arr = base64.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/svg+xml';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }

    private clearSkeletonLoader(view: EditorView) {
        if (this.skeletonDecorations) {
            this.skeletonWidget.clear();
            
            const iter = this.skeletonDecorations.iter();
            if (iter.value && iter.value.spec.widget instanceof SkeletonWidget) {
                safetyUtils.safeClear(view, iter.from - 1, iter.to + 1);
            }
            
            setTimeout(() => {
                const skeletons = document.querySelectorAll('.mermaid-skeleton-loader');
                skeletons.forEach(skeleton => {
                    const el = skeleton as HTMLElement;
                    
                    // First, try to remove all attributes
                    while (el.attributes.length > 0) {
                        el.removeAttribute(el.attributes[0].name);
                    }
                    
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                });
                console.log("skeletons", skeletons);
            }, 0);
            
            this.skeletonDecorations = null;
        }
    }

    
    async handleMermaidGeneration(view: EditorView, line: any) {
        if (this.isGenerating) return;
        
        const insertPos = safetyUtils.safePosition(line.to + 1, view);
        let retryCount = 0;
        
        try {
            this.isGenerating = true;
            this.showStopButton();
            
            startMasterStatus("Generating diagram...");
            const prompt = line.text.slice(0, -2);

            // Add skeleton loader safely
            const success = safetyUtils.safeDispatch(view, {
                from: insertPos,
                insert: '\n\n'
            });

            if (!success) {
                throw new Error("Failed to prepare editor for diagram generation");
            }

            const contextStatus = "Building AI response...";
            startPersistentStatus(contextStatus);

            // Safely add skeleton loader
            try {
                const skeletonDeco = Decoration.widget({
                    widget: this.skeletonWidget,
                    side: 1
                });

                // Revalidate position before adding skeleton
                const currentDocLength = view.state.doc.length;
                const safeInsertPos = Math.min(insertPos, currentDocLength);

                this.skeletonDecorations = Decoration.set([
                    skeletonDeco.range(safeInsertPos)
                ]);

                view.dispatch({
                    changes: {
                        from: safeInsertPos,
                        to: safeInsertPos,
                        insert: '\n\n'
                    },
                    effects: StateEffect.appendConfig.of([
                        EditorView.decorations.of(this.skeletonDecorations)
                    ])
                });
            } catch (error) {
                console.error('Failed to add skeleton:', error);
                // Continue without skeleton if it fails
            }

            // Get context and generate diagram
            const docContent = view.state.doc.toString();
            const { contextText, endpoint } = await diagramContextManager.getContextualDiagramResponse(docContent);
            completePersistentStatus(contextStatus + " ✓");
            
            if (!this.isGenerating) {
                completeMasterStatus("Generation cancelled");
                return;
            }

            // Generate diagram with retries
            const diagramStatus = "Creating diagram...";
            let diagram;
            let lastError;

            while (retryCount < this.MAX_RETRIES) {
                try {
                    startPersistentStatus(`${diagramStatus} (Attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
                    
                    diagram = await generateAndSaveMermaidDiagram(
                        contextText ? `${contextText}\n\nBased on this context, ${prompt}` : prompt,
                        true
                    );
                    
                    completePersistentStatus(diagramStatus + " ✓");
                    break; // Success, exit retry loop
                    
                } catch (error) {
                    lastError = error;
                    retryCount++;
                    
                    if (retryCount < this.MAX_RETRIES) {
                        toast.show(`Retry attempt ${retryCount}/${this.MAX_RETRIES}...`, 'warning');
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
                    }
                }
            }

            if (!diagram) {
                throw new Error(`Failed after ${this.MAX_RETRIES} attempts: ${lastError}`);
            }

            // Process image
            const imageStatus = "Processing image...";
            startPersistentStatus(imageStatus, 2000);

            const imageFile = this.base64ToFile(
                diagram.base64,
                `${generateUniqueId(4)+'_Mermaid_Diagram'}.svg`
            );

            // Safely add newline and process image
            try {
                // Revalidate position before final insertion
                const currentPos = view.state.selection.main.head;
                if (currentPos >= 0 && currentPos <= view.state.doc.length) {
                    view.dispatch({
                        changes: {
                            from: currentPos,
                            insert: '\n'
                        }
                    });

                    await processImageFile(imageFile, view, diagram.description || 'Mermaid Diagram');
                }
            } catch (error) {
                console.error('Failed to process image:', error);
                throw error;
            }

            // Cleanup
            await new Promise(resolve => setTimeout(resolve, 0));
            this.clearSkeletonLoader(view);
            completePersistentStatus(imageStatus + " ✓");
            completeMasterStatus("Diagram generated successfully");
            toast.show('Diagram generated successfully!', 'success');

        } catch (error: unknown) {
            console.error('Failed to generate diagram:', error);
            
            // Clear skeleton before falling back to ASCII
            this.clearSkeletonLoader(view);
            
            // Try ASCII fallback after all retries fail
            if (retryCount >= this.MAX_RETRIES) {
                toast.show('Falling back to ASCII diagram generation...', 'warning');
                try {
                    await handleAsciiDiagramFallback(view, line);
                    completeMasterStatus("ASCII diagram generated");
                    return;
                } catch (fallbackError) {
                    console.error('ASCII fallback also failed:', fallbackError);
                }
            }
            
            // Properly type and extract error message
            let errorMessage: string;
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && typeof error === 'object' && 'toString' in error) {
                errorMessage = error.toString();
            } else {
                errorMessage = 'Unknown error occurred';
            }
            
            try {
                this.clearSkeletonLoader(view);
                
                // Show detailed error message to user
                const userMessage = retryCount > 0 
                    ? `Failed after ${retryCount} attempts. Last error: ${errorMessage}`
                    : `Failed to generate diagram: ${errorMessage}`;
                
                // Show toast with retry count if applicable
                toast.show(userMessage, 'error', 5000); // Longer duration for error messages
                
                // Only attempt to show error if the document position is valid
                if (insertPos >= 0 && insertPos <= view.state.doc.length) {
                    safetyUtils.safeDispatch(view, {
                        from: insertPos,
                        to: insertPos,
                        insert: `\nError: ${userMessage}\n`
                    });
                }
            } catch (dispatchError) {
                console.error('Failed to show error message:', dispatchError);
                toast.show('Failed to show error message in editor', 'error');
            }
            
            completeMasterStatus("Diagram generation failed");
        } finally {
            this.isGenerating = false;
            this.hideStopButton();
        }
    }
    update(update: ViewUpdate) {
        if (!update.docChanged) return;

        const changes = update.changes;
        let pos = update.state.selection.main.head;
        let line = update.state.doc.lineAt(pos);
        
        // Only trigger if the line ends with '>>' and we're not already generating
        if (line.text.endsWith('>>') && !this.isGenerating) {
            console.log('Detected >>, triggering diagram generation');
            setTimeout(() => this.handleMermaidGeneration(update.view, line), 0);
        }
    }
}

const mermaidPlugin = ViewPlugin.fromClass(MermaidGenerationPlugin, {
    decorations: v => v.decorations
});

// Add theme styles
const mermaidStyle = EditorView.theme({
    '.cm-mermaid-image-widget': {
        display: 'inline-block',
        width: '100%',
        margin: '8px 0'
    },
    '.mermaid-diagram-container': {
        display: 'block',
        margin: '1em 0',
        width: '100%',
        '& .cm-image-widget': {
            display: 'block',
            width: '100%',
            height: 'auto',
            margin: '0.5em 0'
        },
        '& img': {
            width: '100%',
            height: 'auto',
            maxHeight: '500px',
            objectFit: 'contain'
        }
    },
    '.mermaid-caption': {
        textAlign: 'center',
        color: '#666',
        fontSize: '0.9em',
        margin: '0.5em 0',
        fontStyle: 'italic',
        '&::before': {
            content: '"Figure: "',
            fontWeight: 'bold'
        }
    }
});

export const mermaidGenerationExtension = [
    mermaidPlugin,
    mermaidStyle
];