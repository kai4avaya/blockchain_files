import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
// import indexDBOverlay from "../../../../../../memory/local/file_worker.js";
import { StateEffect } from "@codemirror/state";
// @ts-ignore
import diagramContextManager from '../../../../../../ai/providers/context_manager_diagrams.js';
// @ts-ignore

import { generateAndSaveMermaidDiagram } from '../../../../../../ai/providers/mermaid/mermaid_api_worker.js';
// @ts-ignore

import toast from '../../../../toast-alert.js';
import { processImageFile } from './imageUpload.js';

// @ts-ignore
import {  startPersistentStatus, completePersistentStatus, startMasterStatus, completeMasterStatus } from '../../../../process.js'


import { generateUniqueId } from "../../../../../../utils/utils.js";

// Create a skeleton loader widget

class SkeletonWidget extends WidgetType {
    private content: string = 'loading';

    constructor() {
        super();
    }

    clear() {
        this.content = '';
    }

    toDOM() {
        const div = document.createElement('div');
        div.className = 'mermaid-skeleton-loader';
        if (this.content) {
            div.innerHTML = `
                <div class="skeleton-container">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                </div>
            `;
        }
        return div;
    }
}

// Create skeleton decoration with proper widget type
const skeletonDecoration = Decoration.widget({
    widget: new SkeletonWidget(),
    side: 1
});

// Add MermaidImageWidget class at the top
class MermaidImageWidget extends WidgetType {
    constructor(readonly url: string, readonly description: string) {
        super();
    }

    eq(other: MermaidImageWidget) {
        return other.url === this.url;
    }

    toDOM() {
        const wrapper = document.createElement('span');
        wrapper.className = 'cm-mermaid-image-widget';
        
        const img = document.createElement('img');
        img.src = this.url;
        img.alt = this.description;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        
        wrapper.appendChild(img);
        return wrapper;
    }
}

class MermaidGenerationPlugin {
    decorations: DecorationSet;
    private isGenerating: boolean = false;
    private view: EditorView;
    private lastLineLength: number = 0;
    private stopButton!: HTMLButtonElement;
    private currentStreamId: string | null = null;
    private skeletonWidget: SkeletonWidget = new SkeletonWidget();

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

    async handleMermaidGeneration(view: EditorView, line: any) {
        if (this.isGenerating) return;
        
        const insertPos = Math.min(line.to + 1, view.state.doc.length);
        
        try {
            this.isGenerating = true;
            this.showStopButton();
            
            // Start the master status that will persist
            startMasterStatus("Generating diagram...");
            
            const prompt = line.text.slice(0, -2); // Remove '>>'

            // Start first sub-status
            const contextStatus = "Building AI response...";
            startPersistentStatus(contextStatus);

            // Add skeleton loader with proper spacing
            const skeletonDeco = Decoration.widget({
                widget: this.skeletonWidget,
                side: 1
            });

            view.dispatch({
                changes: {
                    from: insertPos,
                    to: insertPos,
                    insert: '\n\n'
                },
                effects: StateEffect.appendConfig.of([
                    EditorView.decorations.of(Decoration.set([
                        skeletonDeco.range(insertPos + 1)
                    ]))
                ])
            });

            // Get context and generate diagram
            const docContent = view.state.doc.toString();
            const { contextText, endpoint } = await diagramContextManager.getContextualDiagramResponse(docContent);
            completePersistentStatus(contextStatus + " ✓");
            
            if (!this.isGenerating) {
                completeMasterStatus("Generation cancelled");
                return;
            }

            // Start diagram generation status
            const diagramStatus = "Creating diagram...";
            startPersistentStatus(diagramStatus, 3000);
            const diagram = await generateAndSaveMermaidDiagram(
                contextText ? `${contextText}\n\nBased on this context, ${prompt}` : prompt,
                true
            );
            completePersistentStatus(diagramStatus + " ✓");

            // Start image processing status
            const imageStatus = "Processing image...";
            startPersistentStatus(imageStatus, 2000);

            // Convert base64 to File
            const imageFile = this.base64ToFile(
                diagram.base64,
                `${generateUniqueId(4)+'_Mermaid_Diagram'}.svg`
            );

            // Clear the skeleton loader
            this.skeletonWidget.clear();
            view.dispatch({
                effects: StateEffect.appendConfig.of([
                    EditorView.decorations.of(Decoration.none)
                ])
            });

            // Explicitly add a newline before inserting the image
            view.dispatch({
                changes: {
                    from: view.state.selection.main.head,
                    insert: '\n'
                }
            });

            // Let imageUpload handle the image insertion and storage
            await processImageFile(imageFile, view);

            // Add the description after the image with proper spacing
            view.dispatch({
                changes: {
                    from: view.state.selection.main.head,
                    insert: `\n*Figure: ${diagram.description || 'Mermaid Diagram'}*\n\n`
                }
            });
            completePersistentStatus(imageStatus + " ✓");

            // Complete the master status
            completeMasterStatus("Diagram generated successfully");
            toast.show('Diagram generated successfully!', 'success');

        } catch (error: unknown) {
            console.error('Failed to generate diagram:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Clear loader and show error
            this.skeletonWidget.clear();
            view.dispatch({
                changes: {
                    from: insertPos,
                    to: insertPos,
                    insert: `\nError: ${errorMessage}\n`
                },
                effects: StateEffect.appendConfig.of([
                    EditorView.decorations.of(Decoration.none)
                ])
            });
            
            completeMasterStatus("Diagram generation failed");
            toast.show('Failed to generate diagram', 'error');
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