// ui\components\database_modal\modalHandler.js

import indexDBOverlay from '../../../memory/local/file_worker';
import { generateUniqueId } from '../../../utils/utils';
import config from '../../../configs/config.json'

export function setupDatabaseModal() {
    
    // const messagesButton = document.getElementById('saved-db-btn');
    // const modal = document.getElementById('databasesModal');
    // const closeModal = document.getElementById('closeModal');
    // const databasesContainer = document.getElementById('databasesContainer');
    // const createDbButton = document.getElementById('createDatabaseButton');
    // // const buttonRect = document.getElementById('databaseButton').getBoundingClientRect(); // Update with the button ID
    // modal.style.left = `${messagesButton.right + 10}px`; // Example: Aligns right of button
    // modal.style.top = `${messagesButton.top}px`;
    // modal.style.display = 'block';
    const messagesButton = document.getElementById('saved-db-btn');
const modal = document.getElementById('databasesModal');
const closeModal = document.getElementById('closeModal');
const databasesContainer = document.getElementById('databasesContainer');
const createDbButton = document.getElementById('createDatabaseButton');

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

  
    const overlay = document.getElementById('overlay');

    messagesButton.addEventListener('click', () => {
      loadDatabases();
      modal.style.display = 'block';
      overlay.style.display = 'block';
    
      requestAnimationFrame(() => {
        modal.classList.add('show');
        overlay.classList.add('show');
      });
    });
    
    closeModal.addEventListener('click', () => {
      modal.classList.remove('show');
      overlay.classList.remove('show');
    
      overlay.addEventListener('transitionend', () => {
        if (!overlay.classList.contains('show')) {
          overlay.style.display = 'none';
          modal.style.display = 'none';
        }
      }, { once: true });
    });
    
    window.addEventListener('click', (event) => {
      if (event.target === modal || event.target === overlay) {
        closeModal.click(); // Reuse existing close logic
      }
    });
  
    // Event listener for creating a new database
    createDbButton.addEventListener('click', async () => {
      await createNewDatabaseInstance(); // Create new database
      loadDatabases(); // Refresh modal content after creating the database
    });
    async function loadDatabases() {
        databasesContainer.innerHTML = ''; // Clear previous content
        const databases = JSON.parse(localStorage.getItem('databases')) || [];
      
        for (const dbName of databases) {
          // Extract the user-generated name after the last two underscores
          const displayName = dbName.split('_').slice(2).join('_');
      
          const dbAccordion = document.createElement('div');
          dbAccordion.className = 'accordion';
          const peers = await fetchPeersForDB(dbName); // Fetch peers here
          dbAccordion.innerHTML = `
            <div class="accordion-header">
              <span>${displayName}</span>
              <button class="accordion-toggle">Toggle</button>
              <button class="delete-db-button">Delete</button>
            </div>
            <div class="accordion-content">
              ${generatePeerPills(peers)} <!-- Display fetched peers -->
            </div>
          `;
      
          // Add click event to open the database on header click
          const header = dbAccordion.querySelector('.accordion-header span');
          header.addEventListener('click', () => openDatabase(dbName));
      
          // Add event listener for delete button
          const deleteButton = dbAccordion.querySelector('.delete-db-button');
          deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent accordion toggle
            const confirmDelete = confirm(`Do you really want to delete the database "${dbName}"?`);
            if (confirmDelete) {
              await indexDBOverlay.deleteDatabase(dbName);
              loadDatabases(); // Refresh modal after deletion
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
    return peers
      .map((peerId) => `
        <span class="pill">
          ${peerId}
          <button class="revoke-btn" data-peer="${peerId}">x</button>
        </span>
      `)
      .join('');
  }

  databasesContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('revoke-btn')) {
      const peer = event.target.dataset.peer;
      const dbName = event.target.closest('.accordion-header span').textContent;
      const confirmRevoke = confirm(`Do you want to revoke sharing with ${peer}?`);
      if (confirmRevoke) {
        revokePeerSharing(dbName, peer);
      }
    }
  });

  async function revokePeerSharing(dbName, peer) {
    try {
      config.dbName = dbName;
      await indexDBOverlay.openDB();
      await indexDBOverlay.deleteEntry('peers', peer); // Remove peer from peers store
      loadDatabases(); // Refresh modal content
    } catch (error) {
      console.error(`Failed to revoke peer "${peer}" for database "${dbName}":`, error);
    }
  }

  async function openDatabase(dbName) {
    try {
      console.log(`Opening database: ${dbName}`);
      config.dbName = dbName;
      await indexDBOverlay.openDB();
      console.log(`Database "${dbName}" opened successfully.`);
    } catch (error) {
      console.error(`Failed to open database "${dbName}":`, error);
    }
  }
  async function createNewDatabaseInstance() {
    // Prompt the user for a custom database name
    const userDbName = prompt("Enter a name for your new database:");
    if (!userDbName || userDbName.trim() === "") {
      alert("Database name is required!");
      return;
    }
    
    const randomCode = generateUniqueId().slice(-3); // Get the last 3 characters
    const newDbName = `${config.dbName}_${randomCode}_${userDbName.trim()}`; // Create new database name
    config.dbName = newDbName; // Update the global config
    localStorage.setItem('latestDBName', newDbName);
  
    try {
      await indexDBOverlay.closeAllConnections(config.dbName); // Ensure old connections are closed
      await indexDBOverlay.initialize(newDbName); // Pass the new DB name to initialize
      console.log(`New database "${newDbName}" created and initialized.`);
    } catch (error) {
      console.error('Error creating new database:', error);
    }
  }
  