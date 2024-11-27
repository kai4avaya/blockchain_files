import { share3dDat, markNeedsRender } from './create.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let originalSceneState = null;

export function saveCurrentSceneState() {
    const { scene, nonBloomScene } = share3dDat();
    
    // Deep clone the scenes
    originalSceneState = {
        scene: scene.clone(true),
        nonBloomScene: nonBloomScene.clone(true)
    };
    
    console.log('Scene state saved');
}

export function restoreOriginalScene() {
    if (!originalSceneState) {
        console.warn('No saved scene state found');
        return false;
    }

    const { scene, nonBloomScene } = share3dDat();
    
    // Clear current scenes and store labels
    const labels = new Map();
    scene.traverse((object) => {
        if (object.isCSS2DObject) {
            const parentId = object.parent?.userData?.id;
            if (parentId) {
                labels.set(parentId, {
                    element: object.element.cloneNode(true),
                    position: object.position.clone()
                });
            }
        }
    });
    
    // Clear scenes
    while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    while(nonBloomScene.children.length > 0) {
        nonBloomScene.remove(nonBloomScene.children[0]);
    }
    
    // Restore from saved state
    originalSceneState.scene.children.forEach(child => {
        const clone = child.clone(true);
        scene.add(clone);
        
        // Restore labels if this was a labeled object
        if (child.userData?.id && labels.has(child.userData.id)) {
            const labelData = labels.get(child.userData.id);
            const labelDiv = labelData.element;
            const label = new CSS2DObject(labelDiv);
            label.position.copy(labelData.position);
            clone.add(label);
        }
    });
    
    originalSceneState.nonBloomScene.children.forEach(child => {
        nonBloomScene.add(child.clone(true));
    });
    
    markNeedsRender();
    const actionPanel = document.querySelector('.action-panel');
    if (actionPanel) {
        actionPanel.style.display = 'none';
    }
    console.log('Scene restored to original state');
    return true;
}


// Add this function to create the button panel
export function createActionPanel() {
    const panel = document.createElement('div');
    panel.className = 'action-panel';
    panel.innerHTML = `
        <div class="action-panel-spinner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
        <div class="action-panel-buttons" style="display: none;">
            <button class="action-btn restore-btn" title="Restore Scene">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
            </button>
            <button class="action-btn screenshot-btn" title="Save Screenshot">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    return panel;
}