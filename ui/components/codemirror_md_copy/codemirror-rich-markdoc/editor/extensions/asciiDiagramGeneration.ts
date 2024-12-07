import { EditorView } from "@codemirror/view";
import { safetyUtils } from './safetyUtils';
// @ts-ignore
import diagramContextManager from '../../../../../../ai/providers/context_manager_diagrams.js';
// @ts-ignore
import toast from '../../../../toast-alert.js';
import prompts from '../../../../../../configs/prompts.json'
// @ts-ignore
import {NODE_ENV,MERMAID_API_LOCAL,MERMAID_API} from '../../../../../../configs/env_configs.js'
// @ts-ignore
import {  startPersistentStatus, completePersistentStatus, startMasterStatus, completeMasterStatus } from '../../../../process.js'



async function generateAsciiDiagram(description: string) {
    const endpoint = NODE_ENV === 'development' ? MERMAID_API_LOCAL : MERMAID_API;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompts.ascii_diagram.system.base + description
            })
        });

        const data = await response.json();
        
        // Handle different response formats
        const result = data.choices?.[0]?.message?.content || 
                      data[0]?.generated_text || 
                      data.generated_text;
        
        if (!result) {
            throw new Error('Invalid API response format');
        }

        return result.trim();
    } catch (error) {
        console.error('Error generating ASCII diagram:', error);
        throw error;
    }
}

async function handleAsciiDiagramFallback(view: EditorView, line: any) {
    const insertPos = safetyUtils.safePosition(line.to + 1, view);
    
    try {
        startMasterStatus("Generating ASCII diagram fallback...");
        const prompt = line.text.slice(0, -2);

        // Add newlines for the diagram
        const success = safetyUtils.safeDispatch(view, {
            from: insertPos,
            insert: '\n\n'
        });

        if (!success) {
            throw new Error("Failed to prepare editor for ASCII diagram");
        }

        // Get context and generate diagram
        const docContent = view.state.doc.toString();
        const { contextText } = await diagramContextManager.getContextualDiagramResponse(docContent);
        
        const diagramStatus = "Creating ASCII diagram...";
        startPersistentStatus(diagramStatus);

        const asciiDiagram = await generateAsciiDiagram(
            contextText ? `${contextText}\n\nBased on this context, ${prompt}` : prompt
        );

        // Insert the ASCII diagram with code block formatting
        if (insertPos >= 0 && insertPos <= view.state.doc.length) {
            safetyUtils.safeDispatch(view, {
                from: insertPos,
                insert: '```ascii\n' + asciiDiagram + '\n```\n'
            });
        }

        completePersistentStatus(diagramStatus + " ✓");
        completeMasterStatus("ASCII diagram generated successfully");
        toast.show('ASCII diagram generated as fallback', 'success');

    } catch (error) {
        console.error('Failed to generate ASCII diagram:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        toast.show(`Failed to generate ASCII diagram: ${errorMessage}`, 'error');
        
        if (insertPos >= 0 && insertPos <= view.state.doc.length) {
            safetyUtils.safeDispatch(view, {
                from: insertPos,
                insert: `\nError generating ASCII diagram: ${errorMessage}\n`
            });
        }
        
        completeMasterStatus("ASCII diagram generation failed");
    }
}

export { handleAsciiDiagramFallback }; 