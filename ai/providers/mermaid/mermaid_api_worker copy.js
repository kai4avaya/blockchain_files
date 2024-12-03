import prompts from '../../../configs/prompts.json';
import { NODE_ENV, MERMAID_API, MERMAID_API_LOCAL } from '../../../configs/env_configs';
import mermaid from 'mermaid';
import indexDBOverlay from '../../../memory/local/file_worker';

// Initialize mermaid with default config
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
        htmlLabels: true,
        curve: 'basis'
    }
});

async function generateMermaidDiagram(description) {
    const endpoint = NODE_ENV === 'development' ? MERMAID_API_LOCAL : MERMAID_API;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompts.mermaid_diagram.system.base + 
                       "Generate only the mermaid diagram and description. Format: ```mermaid\n<diagram>\n``` $$<description>$$\n" +
                       description
            })
        });

        const data = await response.json();
        console.log('API Response:', data);
        
        // Handle different response formats
        const result = data.choices?.[0]?.message?.content || 
                      data[0]?.generated_text || 
                      data.generated_text;
        
        if (!result) {
            throw new Error('Invalid API response format: ' + JSON.stringify(data));
        }

        console.log('Extracted result:', result);
        
        const mermaidMatch = result.match(/```mermaid\n([\s\S]*?)```/);
        const descriptionMatch = result.match(/\$\$([\s\S]*?)\$\$/);
        
        if (!mermaidMatch) {
            throw new Error('No valid mermaid code found in response');
        }

        const mermaidCode = mermaidMatch[1].trim();
        
        if (!mermaidCode.startsWith('graph') && 
            !mermaidCode.startsWith('sequenceDiagram') && 
            !mermaidCode.startsWith('classDiagram') && 
            !mermaidCode.startsWith('stateDiagram') &&
            !mermaidCode.startsWith('erDiagram') &&
            !mermaidCode.startsWith('gantt') &&
            !mermaidCode.startsWith('pie') &&
            !mermaidCode.startsWith('flowchart')) {
            throw new Error('Invalid mermaid diagram type. Response: ' + mermaidCode);
        }

        console.log('Extracted Mermaid Code:', mermaidCode);

        return {
            mermaidCode: mermaidCode,
            description: descriptionMatch ? descriptionMatch[1].trim() : description,
            rawResponse: result
        };
    } catch (error) {
        console.error('Error generating diagram:', error);
        throw error;
    }
}

async function generateAndSaveMermaidDiagram(description) {
    try {
        const diagram = await generateMermaidDiagram(description);
        
        if (!diagram.mermaidCode) {
            throw new Error('No mermaid code generated');
        }

        // Generate unique ID for rendering
        const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            console.log('Attempting to parse:', diagram.mermaidCode);
            
            // Validate mermaid syntax
            await mermaid.parse(diagram.mermaidCode);
            
            // Render the diagram
            const { svg } = await mermaid.render(diagramId, diagram.mermaidCode);
            const base64Data = btoa(unescape(encodeURIComponent(svg)));
            
            const imageData = {
                id: diagramId,
                name: diagram.description.substring(0, 30) + '...',
                type: 'mermaid-diagram',
                content: base64Data,
                svg: svg,
                mermaidCode: diagram.mermaidCode,
                description: diagram.description,
                created: Date.now(),
                lastModified: Date.now()
            };

            await indexDBOverlay.saveData('images', imageData);

            return {
                ...diagram,
                id: diagramId,
                svg: svg,
                base64: `data:image/svg+xml;base64,${base64Data}`
            };
        } catch (renderError) {
            console.error('Mermaid rendering error:', renderError);
            throw new Error(`Failed to render diagram: ${renderError.message}\nCode: ${diagram.mermaidCode}`);
        }
    } catch (error) {
        console.error('Error in generateAndSaveMermaidDiagram:', error);
        throw error;
    }
}

export { generateMermaidDiagram, generateAndSaveMermaidDiagram };