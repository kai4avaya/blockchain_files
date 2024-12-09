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
        // 1. Welcome - Updated with icon and more description
        {
            title: 'Welcome to Lumi',
            element: '#ui-layer',
            popover: {
                title: 'Welcome to Lumi',
                description: `
                    <div style="position: relative; text-align: justify; margin: 0 auto; max-width: 280px;">
                        <div style="
                            float: left; 
                            shape-outside: margin-box; 
                            width: 100px; 
                            height: 100px; 
                            margin: 0 30px 15px 0;
                            background: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <svg xmlns="http://www.w3.org/2000/svg" 
                                 fill="none" 
                                 viewBox="0 0 24 24" 
                                 stroke-width="1.5" 
                                 stroke="#3b82f6" 
                                 style="width: 64px; height: 64px; position: absolute;">
                                <path stroke-linecap="round" 
                                      stroke-linejoin="round" 
                                      d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                            </svg>
                        </div>
                        Welcome to your 3D collaborative research environment powered by AI. Lumi is designed with a local-first architecture, meaning your data stays on your device while enabling seamless collaboration with peers. Create, organize, and explore your research in an interactive 3D space while leveraging AI assistance for deeper insights. Connect with colleagues in real-time while maintaining data sovereignty and privacy. Let's take a quick tour of the main features!
                    </div>`,
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
                description: `
                    <ul>
                        <li>Double click on the canvas to load a file or scrape a website.</li>
                        <li>Double click a node to bring up metadata on it or delete it.</li>
                        <li>Drag nodes together to create directories.</li>
                        <li>Click on nodes to select them to include in your document chat.</li>
                    </ul>
                `,
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