import { Boarding } from "boarding.js";
import "boarding.js/styles/main.css";
// optionally include the base theme
import "boarding.js/styles/themes/basic.css";

// export function initializeIntro() {
//     console.log("[Intro] Starting initialization");
    
//     const hasSeenIntro = localStorage.getItem('hasSeenIntro');
//     console.log("[Intro] Has seen intro:", hasSeenIntro);
    
//     if (hasSeenIntro) {
//         console.log("[Intro] User has seen intro before, skipping");
//         return;
//     }

//     // Create a dedicated container for boarding
//     const boardingContainer = document.createElement('div');
//     boardingContainer.id = 'boarding-container';
//     document.body.appendChild(boardingContainer);

//     try {
//         console.log("[Intro] Creating boarding instance");
//         const boarding = new Boarding({
//             container: boardingContainer,
//             animate: true,
//             opacity: 0.75,
//             padding: 10,
//             allowClose: true,
//             overlayClickNext: false,
//             keyboardControl: true,
//             showButtons: true,
//             doneBtnText: 'Got it!',
//             closeBtnText: 'Skip',
//             nextBtnText: 'Next →',
//             prevBtnText: '← Previous',
//             onStart: () => {
//                 console.log("[Intro] Tour started");
//             },
//             onNext: () => {
//                 console.log("[Intro] Moving to next step");
//             },
//             onReset: () => {
//                 console.log("[Intro] Tour reset");
//                 localStorage.setItem('hasSeenIntro', 'true');
//             }
//         });

//         // First, test with a simple highlight
//         console.log("[Intro] Testing simple highlight");
//         boarding.highlight({
//             element: '#homeIcon',
//             popover: {
//                 title: 'Test Highlight',
//                 description: 'Testing if highlight works'
//             }
//         });

//         console.log("[Intro] Initial highlight complete");

//     } catch (err) {
//         console.error("[Intro] Error during intro setup:", err);
//         console.error("[Intro] Stack trace:", err.stack);
//         localStorage.setItem('hasSeenIntro', 'true');
//     }
// }


export function initializeProjectTour() {
    const boarding = new Boarding({
        animate: true,
        opacity: 0.75,
        padding: 10,
        allowClose: true,
        keyboardControl: true,
        showButtons: true,
        onPopoverRender: (popoverElements) => {
            setTimeout(() => {
                popoverElements.popoverTitle.innerText = `${
                    popoverElements.popoverTitle.innerText
                } (${boarding.currentStep + 1}/${boarding.getSteps().length})`;
            }, 0);
        }
    });

    boarding.defineSteps([
        // 1. Welcome
        {
            element: '#ui-layer',
            popover: {
                title: 'Welcome to Lumi',
                description: 'Your 3D collaborative research environment powered by AI. Let\'s take a quick tour of the main features.',
                position: 'center'
            }
        },
        // 2. Graph View
        {
            element: '#homeIcon',
            popover: {
                title: 'Graph View',
                description: 'Visualize your research and connections in an interactive 3D space. This is your main workspace for exploring relationships between documents.',
            }
        },
        // 3. Search
        {
            element: '#search-btn',
            popover: {
                title: 'Smart Search',
                description: 'Search through your documents using exact or fuzzy matching. The AI helps find relevant connections across your research materials.',
            }
        },
        // 4. Peer Collaboration
        {
            element: '#peer-btn-connect',
            popover: {
                title: 'Real-time Collaboration',
                description: 'Connect with peers to collaborate in real-time. Share your research space and work together on documents.',
            }
        },
        // 5. Settings
        {
            element: '#settingsIcon',
            popover: {
                title: 'Customize Your Experience',
                description: 'Adjust your workspace settings, visualization preferences, and AI behavior.',
            }
        },
        // 6. Database Management
        {
            element: '#saved-db-btn',
            popover: {
                title: 'Research Databases',
                description: 'Manage your research databases. Create, import, and organize your research materials.',
            }
        },
        // 7. File Directory
        {
            element: '#fileTreeBtn',
            popover: {
                title: 'File Management',
                description: 'Access your research files in a structured tree view. Drag and drop files to organize your research.',
            }
        },
        // 8. AI Chat
        {
            element: '#toggleButton',
            popover: {
                title: 'AI Research Assistant',
                description: 'Chat with your documents using AI. Get insights, summaries, and connections across your research materials.',
            }
        },
        // 9. Canvas Container
        {
            element: '#canvas-container',
            popover: {
                title: '3D Visualization',
                description: 'Your research comes alive in this 3D space. Interact with documents, create connections, and visualize relationships.',
            }
        },
        // 10. Final Step
        {
            element: '#ui-layer',
            popover: {
                title: 'Ready to Start!',
                description: 'You\'re all set to begin your research journey. Use the sidebar tools to start exploring and organizing your research in this collaborative 3D space.',
                position: 'center'
            }
        }
    ]);

    // Start the tour
    boarding.start();
}