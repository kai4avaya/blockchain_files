import { share3dDat, markNeedsRender } from './create.js';
// import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as THREE from 'three';

let originalSceneState = null;

export function saveCurrentSceneState() {
    const { scene, nonBloomScene } = share3dDat();
    
    // Save positions and states instead of cloning
    originalSceneState = {
        objects: new Map()
    };
    
    // Store original positions and states of all objects
    scene.traverse((object) => {
        if (object.isMesh || object.isLineSegments) {
            originalSceneState.objects.set(object.userData.id, {
                position: object.position.clone(),
                rotation: object.rotation.clone(),
                scale: object.scale.clone(),
                visible: object.visible
            });
        }
    });
    
    console.log('Scene state saved');
}

export function restoreOriginalScene() {
    if (!originalSceneState) {
        console.warn('No saved scene state found');
        return false;
    }

    const { scene, nonBloomScene } = share3dDat();
    const duration = 1000; // Animation duration in milliseconds
    const startTime = performance.now();
    
    // Store initial positions for animation
    const initialStates = new Map();
    scene.traverse((object) => {
        if (object.isMesh || object.isLineSegments) {
            if (originalSceneState.objects.has(object.userData.id)) {
                initialStates.set(object.userData.id, {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                });
            }
        }
    });

    // Animation function
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const eased = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        scene.traverse((object) => {
            if (object.isMesh || object.isLineSegments) {
                const originalState = originalSceneState.objects.get(object.userData.id);
                const initialState = initialStates.get(object.userData.id);
                
                if (originalState && initialState) {
                    // Interpolate position
                    object.position.lerpVectors(
                        initialState.position,
                        originalState.position,
                        eased
                    );
                    
                    // Interpolate rotation
                    object.rotation.x = THREE.MathUtils.lerp(
                        initialState.rotation.x,
                        originalState.rotation.x,
                        eased
                    );
                    object.rotation.y = THREE.MathUtils.lerp(
                        initialState.rotation.y,
                        originalState.rotation.y,
                        eased
                    );
                    object.rotation.z = THREE.MathUtils.lerp(
                        initialState.rotation.z,
                        originalState.rotation.z,
                        eased
                    );
                    
                    // Interpolate scale
                    object.scale.lerpVectors(
                        initialState.scale,
                        originalState.scale,
                        eased
                    );
                    
                    // Restore visibility at the end
                    if (progress === 1) {
                        object.visible = originalState.visible;
                    }
                }
            }
        });

        markNeedsRender();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete
            const actionPanel = document.querySelector('.action-panel');
            if (actionPanel) {
                actionPanel.style.display = 'none';
            }
            console.log('Scene restored to original state');
        }
    }

    // Start animation
    requestAnimationFrame(animate);
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