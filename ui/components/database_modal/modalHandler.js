// ui\components\database_modal\modalHandler.js

import { p2pSync } from '../../../network/peer2peer_simple';
import indexDBOverlay from '../../../memory/local/file_worker';
// import { generateUniqueId } from '../../../utils/utils';
import config from '../../../configs/config.json'
import { showNotification } from '../notifications/popover.js';
import { createAndInitializeNewDatabaseInstance, initializeDatabases, openDatabase } from '../../../memory/local/start_new_db';
import toast from '../toast-alert';
import { clearAllScenes, reconstructFromGraphData } from '../../graph_v2/create.js';

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
    const currentDB = localStorage.getItem('latestDBName');

    console.log('Current databas loading active'); // DO NOIT  DELETE ADDS A DELAY AND ENABLES IT TO WORK??
    
  
    // First, remove any existing active-database classes
    document.querySelectorAll('.active-database').forEach(el => {

        console.log('Removing loading active-database class from:', el); // DO NOT DELETE
        el.classList.remove('active-database');
    });
  
    for (const dbName of databases) {
        const displayName = dbName.split('_').slice(2).join('_');
        const isActive = dbName === currentDB;
  
        const dbAccordion = document.createElement('div');
        dbAccordion.className = `accordion ${isActive ? 'active-database' : ''}`;
        dbAccordion.setAttribute('data-db-name', dbName);
        const peers = await fetchPeersForDB(dbName); // Fetch peers here
        dbAccordion.innerHTML = `
            <div class="accordion-header">
                <span>${displayName}</span>
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
  
        const accordionContent = dbAccordion.querySelector('.accordion-content');
        const filesContainer = dbAccordion.querySelector('.files-container');
        const peerContainer = dbAccordion.querySelector('.peer-pills-container');

        // View Files button handler
        const viewFilesBtn = dbAccordion.querySelector('.view-files-btn');
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
  
        // View Peers button handler
        const toggleButton = dbAccordion.querySelector('.accordion-toggle');
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
  
        // Add existing event listeners
        const header = dbAccordion.querySelector('.accordion-header span');
        header.addEventListener('click', () => openDatabase(dbName));
  
        const deleteButton = dbAccordion.querySelector('.delete-db-button');
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            const confirmDelete = confirm(`Do you really want to delete the database "${displayName}"?`);
            if (confirmDelete) {
                await handleDatabaseDeletion(dbName, deleteButton, dbAccordion);
            }
        });
  
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
        await createNewDatabaseInstance();
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

async function handleDatabaseOpen(dbName) {
    try {
        // Remove highlight from previously active database
        const previousActive = document.querySelector('.active-database');
        if (previousActive) {
            previousActive.classList.remove('active-database');
        }
        
        // Add loading spinner to clicked database
        const clickedDb = document.querySelector(`[data-db-name="${dbName}"]`);
        const headerSpan = clickedDb?.querySelector('.accordion-header span');
        const originalContent = headerSpan?.innerHTML || '';
        
        if (headerSpan) {
            headerSpan.innerHTML = buttonSpinnerTemplate + originalContent;
        }
        
        toast.show(`Loading database: ${dbName.split('_').slice(2).join('_')}`, 'info');
        
        // Clear current scene
        clearAllScenes();
        
        try {
            // Open the database
            await openDatabase(dbName);
            
            // Initialize peer connections for this database
            p2pSync.initializePeerModal();
            
            // Set a minimum loading time of 1 second for UX
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update UI
            if (clickedDb) {
                clickedDb.classList.add('active-database');
                headerSpan.innerHTML = originalContent;
            }
            
            showNotification(`✓ Switched to database:\n   ${dbName.split('_').slice(2).join('_')}`);
            
        } catch (error) {
            // Remove spinner on error
            if (headerSpan) {
                headerSpan.innerHTML = originalContent;
            }
            throw error;
        }
        
    } catch (error) {
        console.error(`Failed to open database "${dbName}":`, error);
        showNotification(`✗ Failed to open database:\n   ${error.message}`);
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

function createDatabaseAccordion(dbName) {
    // ... existing code ...
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'database-actions';
    
    // Add View Files button
    const viewFilesBtn = document.createElement('button');
    viewFilesBtn.className = 'view-files-btn';
    viewFilesBtn.innerHTML = '+ View Files';
    viewFilesBtn.onclick = async (e) => {
        e.stopPropagation();
        const filesList = await indexDBOverlay.getFilesList(dbName);
        displayFilesList(dbName, filesList, accordionContent);
    };
    
    buttonContainer.appendChild(viewFilesBtn);
    // ... rest of existing buttons ...
    
    accordionHeader.appendChild(buttonContainer);
}

function displayFilesList(dbName, files, container) {
    const existingList = container.querySelector('.files-list');
    if (existingList) {
        existingList.remove();
        return;
    }
    
    const filesList = document.createElement('div');
    filesList.className = 'files-list';
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-status">${file.deleted ? '(deleted)' : ''}</span>
        `;
        filesList.appendChild(fileItem);
    });
    
    container.appendChild(filesList);
}
  