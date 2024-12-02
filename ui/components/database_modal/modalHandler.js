// ui\components\database_modal\modalHandler.js

import { p2pSync } from '../../../network/peer2peer_simple';
import indexDBOverlay from '../../../memory/local/file_worker';
// import { generateUniqueId } from '../../../utils/utils';
import config from '../../../configs/config.json'
import { showNotification } from '../notifications/popover.js';
import { createAndInitializeNewDatabaseInstance, openDatabase } from '../../../memory/local/start_new_db';
import toast from '../toast-alert';
import { reconstructFromGraphData } from '../../graph_v2/create.js';
import { initiate as initiateVectorDB } from '../../../memory/vectorDB/vectorDbGateway';
// import { sceneState } from '../../../memory/collaboration/scene_colab';

// Add loading spinner HTML template
const buttonSpinnerTemplate = `
  <svg class="button-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
  </svg>
`;

// Move loadDatabases outside setupDatabaseModal
async function loadDatabases() {
    const databasesContainer = document.getElementById('databasesContainer');
    databasesContainer.innerHTML = '';
    const databases = JSON.parse(localStorage.getItem('databases')) || [];
    const currentDb = localStorage.getItem('latestDBName');
    
    // First, remove any existing active-database classes
    document.querySelectorAll('.active-database').forEach(el => {
        el.classList.remove('active-database');
    });
  
    for (const dbName of databases) {
        const displayName = dbName.split('_').slice(2).join('_');
        const isActive = dbName === currentDb;
  
        const dbAccordion = document.createElement('div');
        dbAccordion.className = `accordion ${isActive ? 'active-database' : ''}`;
        dbAccordion.setAttribute('data-db-name', dbName);
        const peers = await fetchPeersForDB(dbName);
        
        // Update the template to use the new load-db-btn
        dbAccordion.innerHTML = `
            <div class="accordion-header">
                <button class="load-db-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                    </svg>
                    ${displayName}
                </button>
                <button class="view-files-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    View Files
                </button>
                <button class="accordion-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18 12H6m6 6V6" />
                    </svg>
                    View Peers
                </button>
                <button class="delete-db-button">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete
                </button>
            </div>
            <div class="accordion-content" style="display: none;">
                <div class="files-container"></div>
                <div class="peer-pills-container">${generatePeerPills(peers)}</div>
            </div>
        `;

        // Get references to elements after they're added to the DOM
        const loadButton = dbAccordion.querySelector('.load-db-btn');
        const viewFilesBtn = dbAccordion.querySelector('.view-files-btn');
        const toggleButton = dbAccordion.querySelector('.accordion-toggle');
        const deleteButton = dbAccordion.querySelector('.delete-db-button');
        const accordionContent = dbAccordion.querySelector('.accordion-content');
        const filesContainer = dbAccordion.querySelector('.files-container');
        const peerContainer = dbAccordion.querySelector('.peer-pills-container');

        // Add click handler for loading database
        loadButton.addEventListener('click', async () => {
            await handleDatabaseOpen(dbName, loadButton);
        });

        // Add other event listeners
        if (viewFilesBtn) {
            viewFilesBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const isVisible = filesContainer.style.display === 'block';
                
                if (!isVisible) {
                    const dbSummaries = JSON.parse(localStorage.getItem('dbSummaries') || '{}');
                    const currentDBFiles = dbSummaries[dbName]?.files || [];
                    
                    filesContainer.innerHTML = currentDBFiles.map(file => `
                        <div class="pill file-pill" data-file-id="${file.id}">
                            <span class="file-name">${file.name}</span>
                            ${file.deleted 
                                ? `
                                <button class="recover-btn" title="Recover file">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                    </svg>
                                </button>
                                <span class="deleted-status">(deleted)</span>
                                `
                                : `
                                <button class="delete-btn" title="Delete file">×</button>
                                `
                            }
                        </div>
                    `).join('');

                    peerContainer.style.display = 'none';
                    filesContainer.style.display = 'block';
                    accordionContent.style.display = 'block';

                    // Add event listeners for file actions
                    filesContainer.querySelectorAll('.file-pill').forEach(pill => {
                        const fileId = pill.dataset.fileId;
                        const recoverBtn = pill.querySelector('.recover-btn');
                        const deleteBtn = pill.querySelector('.delete-btn');

                        if (recoverBtn) {
                            recoverBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                try {
                                    // Set correct database context
                                    config.dbName = dbName;
                                    await indexDBOverlay.openDB();
                                    
                                    // Use recover function which internally updates dbSummaries
                                    await indexDBOverlay.recover(fileId);
                                    
                                    // Reconstruct graph to reflect changes
                                    reconstructFromGraphData();
                                    
                                    // Update pill to show active state
                                    pill.innerHTML = `
                                        <span class="file-name">${pill.querySelector('.file-name').textContent}</span>
                                        <button class="delete-btn" title="Delete file">×</button>
                                    `;
                                    
                                    window.dispatchEvent(new Event('updateFileTree'));
                                    showNotification('✓ File recovered successfully');
                                } catch (error) {
                                    console.error('Error recovering file:', error);
                                    showNotification('✗ Failed to recover file');
                                }
                            });
                        }

                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                try {
                                    const pill = e.target.closest('.file-pill');
                                    
                                    // Add loading state
                                    const originalContent = pill.innerHTML;
                                    pill.innerHTML = `
                                        <span class="file-name">${pill.querySelector('.file-name').textContent}</span>
                                        <svg class="spinner small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                                        </svg>
                                    `;

                                    // Set correct database context
                                    config.dbName = dbName;
                                    await indexDBOverlay.openDB();
                                    
                                    // Use markDeletedAcrossTables which internally updates dbSummaries
                                    await indexDBOverlay.markDeletedAcrossTables(fileId);
                                    
                                    // Reconstruct graph to reflect changes
                                    reconstructFromGraphData();
                                    
                                    // Update the pill to show deleted state
                                    pill.innerHTML = `
                                        <span class="file-name">${pill.querySelector('.file-name').textContent}</span>
                                        <button class="recover-btn" title="Recover file">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                            </svg>
                                        </button>
                                        <span class="deleted-status">(deleted)</span>
                                    `;

                                    // Add recover button listener to the new button
                                    const newRecoverBtn = pill.querySelector('.recover-btn');
                                    if (newRecoverBtn) {
                                        newRecoverBtn.addEventListener('click', async (e) => {
                                            e.stopPropagation();
                                            try {
                                                // Set correct database context
                                                config.dbName = dbName;
                                                await indexDBOverlay.openDB();
                                                
                                                // Use recover function which internally updates dbSummaries
                                                await indexDBOverlay.recover(fileId);
                                                
                                                // Reconstruct graph to reflect changes
                                                reconstructFromGraphData();
                                                
                                                // Update pill to show active state
                                                pill.innerHTML = `
                                                    <span class="file-name">${pill.querySelector('.file-name').textContent}</span>
                                                    <button class="delete-btn" title="Delete file">×</button>
                                                `;
                                                
                                                window.dispatchEvent(new Event('updateFileTree'));
                                                showNotification('✓ File recovered successfully');
                                            } catch (error) {
                                                console.error('Error recovering file:', error);
                                                showNotification('✗ Failed to recover file');
                                            }
                                        });
                                    }

                                    window.dispatchEvent(new Event('updateFileTree'));
                                    showNotification('✓ File marked as deleted');
                                } catch (error) {
                                    console.error('Error marking file as deleted:', error);
                                    showNotification('✗ Failed to delete file');
                                }
                            });
                        }
                    });
                } else {
                    filesContainer.style.display = 'none';
                    accordionContent.style.display = 'none';
                }
            });
        }

        if (toggleButton) {
            toggleButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                const isVisible = peerContainer.style.display === 'block';
                
                if (!isVisible) {
                    // Set the correct database context before fetching peers
                    config.dbName = dbName;
                    await indexDBOverlay.openDB();
                    const peers = await indexDBOverlay.getAll('peers');
                    const currentPeerId = p2pSync.getCurrentPeerId();
                    
                    peerContainer.innerHTML = peers
                        .filter(peer => !peer.isDeleted && peer.peerId !== currentPeerId) // Exclude deleted peers and current user
                        .map(peer => `
                            <div class="pill peer-pill" data-peer-id="${peer.peerId}">
                                ${peer.peerId}
                                <button class="revoke-btn" data-peer="${peer.peerId}">×</button>
                            </div>
                        `).join('');

                    filesContainer.style.display = 'none';
                    peerContainer.style.display = 'block';
                    accordionContent.style.display = 'block';

                    // Setup peer pill listeners
                    setupPeerPillListeners(peerContainer);
                } else {
                    peerContainer.style.display = 'none';
                    accordionContent.style.display = 'none';
                }
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                const confirmDelete = confirm(`Do you really want to delete the database "${displayName}"?`);
                if (confirmDelete) {
                    await handleDatabaseDeletion(dbName, deleteButton, dbAccordion);
                }
            });
        }

        // Append the accordion to the container
        databasesContainer.appendChild(dbAccordion);
    }
}

// Move createNewDatabaseInstance outside setupDatabaseModal
async function createNewDatabaseInstance() {
    const userDbName = prompt("Enter a name for your new database:");
    if (!userDbName || userDbName.trim() === "") {
        alert("Database name is required!");
        return;
    }
    
    try {
        // Use the centralized function to create the database
        await createAndInitializeNewDatabaseInstance(userDbName);
        
        // Close the modal
        const modal = document.getElementById('databasesModal');
        const overlay = document.getElementById('overlay');
        modal.classList.remove('show');
        overlay.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            overlay.style.display = 'none';
        }, 300);

        // Show notification
        showNotification(`✓ Created new database:\n   ${userDbName.trim()}`);
        
        // Refresh the databases list
        await loadDatabases();
        
    } catch (error) {
        console.error('Error creating new database:', error);
        showNotification(`✗ Failed to create database:\n   ${error.message}`);
    }
}

export function setupDatabaseModal() {
    const messagesButton = document.getElementById('saved-db-btn');
    const modal = document.getElementById('databasesModal');
    const closeModal = document.getElementById('closeModal');
    const createDbButton = document.getElementById('createDatabaseButton');
    const overlay = document.getElementById('overlay');

    // Get the button's position relative to the viewport
    const buttonRect = messagesButton.getBoundingClientRect();

    // Get the modal's dimensions
    const modalRect = modal.getBoundingClientRect();

    // Calculate position accounting for scroll
    const topPosition = buttonRect.top + window.pageYOffset;
    const leftPosition = buttonRect.right + 10; // 10px offset from button

    // Set the modal position
    modal.style.position = 'absolute';
    modal.style.left = `${leftPosition}px`;
    modal.style.top = `${topPosition}px`;
    modal.style.display = 'block';

    messagesButton.addEventListener('click', () => {
        loadDatabases();
        window.closeAllModals_notDBModal();
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        requestAnimationFrame(() => {
            modal.classList.add('show');
            overlay.classList.add('show');
        });
    });
    
    // Function to handle modal closing
    const handleModalClose = () => {
        modal.classList.remove('show');
        overlay.classList.remove('show');
    
        overlay.addEventListener('transitionend', () => {
            if (!overlay.classList.contains('show')) {
                overlay.style.display = 'none';
                modal.style.display = 'none';
            }
        }, { once: true });
    };

    // ESC key handler
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            handleModalClose();
        }
    });

    // Click outside handler
    document.addEventListener('mousedown', (event) => {
        // Check if the click is outside both the modal and the messages button
        if (!modal.contains(event.target) && 
            !messagesButton.contains(event.target) && 
            modal.style.display === 'block') {
            handleModalClose();
        }
    });

    // Update existing close button handler to use the new function
    closeModal.addEventListener('click', handleModalClose);
  
    // Event listener for creating a new database
    createDbButton.addEventListener('click', async () => {
        const newDbName = await createNewDatabaseInstance();
        // Initialize vector database with isNewDB flag
        await initiateVectorDB(true);
    });
}

async function fetchPeersForDB(dbName) {
    try {
        config.dbName = dbName;
        await indexDBOverlay.openDB();
        const peers = await indexDBOverlay.getAll('peers');
        return peers.map(peer => peer.peerId); // Adjusted to return peer IDs
    } catch (error) {
        console.error(`Failed to fetch peers for database "${dbName}":`, error);
        return [];
    }
}

function generatePeerPills(peers) {
    if (!peers || peers.length === 0) {
        return '<div class="empty-state">No peers connected</div>';
    }
    
    const container = document.createElement('div');
    container.className = 'peer-pills-container';
    container.innerHTML = peers
        .map((peerId) => `
            <span class="pill">
                ${peerId}
                <button class="revoke-btn" data-peer="${peerId}">×</button>
            </span>
        `)
        .join('');
    
    setupPeerPillListeners(container);
    return container.outerHTML;
}

function setupPeerPillListeners(container) {
    container.addEventListener('click', async (event) => {
        if (event.target.classList.contains('revoke-btn')) {
            const peerId = event.target.dataset.peer;
            const accordionElement = event.target.closest('.accordion');
            const dbName = accordionElement.getAttribute('data-db-name');
            
            if (!dbName) {
                toast.show('Could not determine database name', 'error');
                return;
            }

            const confirmRevoke = confirm(`Do you want to revoke sharing with ${peerId}?`);
            if (confirmRevoke) {
                try {
                    // Remove peer using p2pSync
                    await p2pSync.disconnectPeer(peerId);
                    
                    // Remove from database
                    await revokePeerSharing(dbName, peerId);
                    
                    // Remove the pill with animation
                    const pill = event.target.closest('.pill');
                    pill.classList.add('removing');
                    
                    setTimeout(() => {
                        pill.remove();
                    }, 300);
                    
                    toast.show(`Peer ${peerId} has been removed`, 'success');
                    
                } catch (error) {
                    console.error('Error removing peer:', error);
                    toast.show(`Failed to remove peer: ${error.message}`, 'error');
                }
            }
        }
    });
}

databasesContainer.addEventListener('click', async (event) => {
    if (event.target.classList.contains('revoke-btn')) {
        const peer = event.target.dataset.peer;
        // Find the database name from the closest accordion element
        const accordionElement = event.target.closest('.accordion');
        const dbName = accordionElement.getAttribute('data-db-name');
        
        if (!dbName) {
            toast.show('Could not determine database name', 'error');
            return;
        }

        const confirmRevoke = confirm(`Do you want to revoke sharing with ${peer}?`);
        if (confirmRevoke) {
            try {
                // Remove peer using p2pSync
                await p2pSync.disconnectPeer(peer);
                
                // Remove from database
                await revokePeerSharing(dbName, peer);
                
                // Remove the pill with animation
                const pill = event.target.closest('.pill');
                pill.classList.add('removing');
                
                setTimeout(() => {
                    pill.remove();
                }, 300);
                
                toast.show(`Peer ${peer} has been removed`, 'success');
                
            } catch (error) {
                console.error('Error removing peer:', error);
                toast.show(`Failed to remove peer: ${error.message}`, 'error');
            }
        }
    }
});

async function revokePeerSharing(dbName, peer) {
    try {
        config.dbName = dbName;
        await indexDBOverlay.openDB();
        
        // Use deleteItem_field instead of deleteEntry
        // This will mark the peer as deleted rather than removing it completely
        await indexDBOverlay.deleteItem_field('peers', peer);
        
        // Alternatively, if you want to completely remove the peer:
        // await indexDBOverlay.deleteItem('peers', peer);
        
    } catch (error) {
        console.error(`Failed to revoke peer "${peer}" for database "${dbName}":`, error);
        throw error;
    }
}

async function handleDatabaseOpen(dbName, loadButton) {
    const originalContent = loadButton.innerHTML;
    let timeoutId;
    
    try {
        // Add loading state
        loadButton.innerHTML = buttonSpinnerTemplate + originalContent;
        loadButton.disabled = true;

        // Set 5 second timeout to reset button state DO NOT SHOW NOTIFICATION
        timeoutId = setTimeout(() => {
            loadButton.innerHTML = originalContent;
            loadButton.disabled = false;
        }, 5000);

        // Show loading notification
        const displayName = dbName.split('_').slice(2).join('_');
        showNotification(`⏳ Loading database:\n   ${displayName}`);

        // Clear any existing window metadata
        window.fileMetadata = new Map();
        window.currentGraph = null;
        
        try {
            // Clear scene state first
            // sceneState.clearState();
            
            // Proceed with database switch
            await openDatabase(dbName);
            
            
            // Reinitialize p2pSync with the new database context
            await p2pSync.initialize(localStorage.getItem('myPeerId'));
            
            // Initialize vector database with isNewDB = false for existing databases
            await initiateVectorDB(false);
            
            // Update localStorage
            localStorage.setItem('latestDBName', dbName);
            
            // Update UI - find the clicked database element
            const allDatabases = document.querySelectorAll('.accordion');
            allDatabases.forEach(db => {
                db.classList.remove('active-database');
                const otherLoadBtn = db.querySelector('.load-db-btn');
                if (otherLoadBtn && otherLoadBtn !== loadButton) {
                    otherLoadBtn.disabled = false;
                }
            });

            // Add active class to the clicked database
            const clickedDb = document.querySelector(`[data-db-name="${dbName}"]`);
            if (clickedDb) {
                clickedDb.classList.add('active-database');
            }
            
            // Clear scenes and reconstruct graph
            // clearAllScenes();
            // const graphData = await indexDBOverlay.getData("graph");
            // if (graphData && graphData.length > 0) {
            //     await reconstructFromGraphData();
            // }
            
            // Clear the timeout since operation completed successfully
            clearTimeout(timeoutId);
            
            // Reset button state and show success
            loadButton.innerHTML = originalContent;
            loadButton.disabled = false;
            showNotification(`✓ Switched to database:\n   ${displayName}`);
            
        } catch (error) {
            clearTimeout(timeoutId);
            loadButton.innerHTML = originalContent;
            loadButton.disabled = false;
            throw error;
        }
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Failed to open database "${dbName}":`, error);
        showNotification(`✗ Failed to open database:\n   ${error.message}`);
        loadButton.innerHTML = originalContent;
        loadButton.disabled = false;
    }
}

async function handleDatabaseDeletion(dbName, deleteButton, dbAccordion) {
    try {
        // Check if trying to delete currently active database
        if (dbName === config.dbName) {
            showNotification(`⚠️ Cannot delete active database:\n   Please switch to another database first`);
            return;
        }

        // Store original button content and disable it
        const originalContent = deleteButton.innerHTML;
        deleteButton.innerHTML = buttonSpinnerTemplate;
        deleteButton.disabled = true;
        
        // Extract display name (what's shown in the UI)
        const displayName = dbName.split('_').slice(2).join('_');
        
        // Close all connections to the database we want to delete
        try {
            await indexDBOverlay.closeAllConnections(dbName);
            
            // Small delay to ensure connections are closed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Delete the database
            await indexDBOverlay.deleteDatabase(dbName);
            
            // Update localStorage
            const databases = JSON.parse(localStorage.getItem('databases')) || [];
            const updatedDatabases = databases.filter(db => db !== dbName);
            localStorage.setItem('databases', JSON.stringify(updatedDatabases));
            
            // Animate removal of the accordion
            dbAccordion.style.transition = 'all 0.3s ease';
            dbAccordion.style.opacity = '0';
            dbAccordion.style.height = '0';
            
            // Show success notification
            showNotification(`✓ Deleted database:\n   ${displayName}`);
            
            // Remove the element after animation
            setTimeout(() => {
                dbAccordion.remove();
            }, 300);
            
        } catch (error) {
            throw new Error(`Failed to close connections: ${error.message}`);
        }
        
    } catch (error) {
        console.error(`Failed to delete database "${dbName}":`, error);
        showNotification(`✗ Failed to delete database:\n   ${error.message}`);
        
        // Restore original button state
        deleteButton.innerHTML = originalContent;
        deleteButton.disabled = false;
    }
}

// function createDatabaseAccordion(dbName) {
//     // ... existing code ...
    
//     const buttonContainer = document.createElement('div');
//     buttonContainer.className = 'database-actions';
    
//     // Add View Files button
//     const viewFilesBtn = document.createElement('button');
//     viewFilesBtn.className = 'view-files-btn';
//     viewFilesBtn.innerHTML = '+ View Files';
//     viewFilesBtn.onclick = async (e) => {
//         e.stopPropagation();
//         const filesList = await indexDBOverlay.getFilesList(dbName);
//         displayFilesList(dbName, filesList, accordionContent);
//     };
    
//     buttonContainer.appendChild(viewFilesBtn);
//     // ... rest of existing buttons ...
    
//     accordionHeader.appendChild(buttonContainer);
// }

// function displayFilesList(dbName, files, container) {
//     const existingList = container.querySelector('.files-list');
//     if (existingList) {
//         existingList.remove();
//         return;
//     }
    
//     const filesList = document.createElement('div');
//     filesList.className = 'files-list';
    
//     if (!files || files.length === 0) {
//         filesList.innerHTML = '<div class="empty-state">No files in this database</div>';
//     } else {
//         files.forEach(file => {
//             const fileItem = document.createElement('div');
//             fileItem.className = 'file-item';
//             fileItem.innerHTML = `
//                 <span class="file-name">${file.name}</span>
//                 <span class="file-status">${file.deleted ? '(deleted)' : ''}</span>
//             `;
//             filesList.appendChild(fileItem);
//         });
//     }
    
//     container.appendChild(filesList);
// }
  