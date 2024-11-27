// ui\components\database_modal\modalHandler.js

import { p2pSync } from '../../../network/peer2peer_simple';
import indexDBOverlay from '../../../memory/local/file_worker';
// import { generateUniqueId } from '../../../utils/utils';
import config from '../../../configs/config.json'
import { showNotification } from '../notifications/popover.js';
import { createAndInitializeNewDatabaseInstance } from '../../../memory/local/start_new_db';
import toast from '../toast-alert';

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
                <button class="accordion-toggle">View Peers</button>
                <button class="delete-db-button">Delete</button>
            </div>
            <div class="accordion-content">
                ${generatePeerPills(peers)}
            </div>
        `;
  
        // Add click event to open the database on header click
        const header = dbAccordion.querySelector('.accordion-header span');
        header.addEventListener('click', () => openDatabase(dbName));
  
        // Add event listener for delete button
        const deleteButton = dbAccordion.querySelector('.delete-db-button');
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            const confirmDelete = confirm(`Do you really want to delete the database "${displayName}"?`);
            if (confirmDelete) {
                await handleDatabaseDeletion(dbName, deleteButton, dbAccordion);
            }
        });
  
        databasesContainer.appendChild(dbAccordion);
  
        // Add event listener for toggle button
        const toggleButton = dbAccordion.querySelector('.accordion-toggle');
        const content = dbAccordion.querySelector('.accordion-content');
        toggleButton.addEventListener('click', () => {
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        });
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

async function openDatabase(dbName) {
    try {
        console.log(`Opening database: ${dbName}`);
        
        // Remove highlight from previously active database
        const previousActive = document.querySelector('.active-database');
        if (previousActive) {
            previousActive.classList.remove('active-database');
        }
        
        // Close current database connections first
        await indexDBOverlay.closeAllConnections(config.dbName);
        
        // Update config and localStorage
        config.dbName = dbName;
        localStorage.setItem('latestDBName', dbName);
        
        // Open new database
        await indexDBOverlay.openDB();
        
        console.log(`Database "${dbName}" opened successfully.`);
        showNotification(`✓ Switched to database:\n   ${dbName.split('_').slice(2).join('_')}`);
        
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
  