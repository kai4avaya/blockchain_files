// popup.js
// Import getFileSystem to access IndexedDB
import { getFileSystem } from '../memory/collaboration/file_colab';
import { retrieveFile } from '../memory/fileHandler.js'; // Adjust the import path
import indexDBOverlay from '../memory/local/file_worker'; // Adjust the path as necessary
import config from '../configs/config.json';
// import { removeLabel } from '../ui/graph_v2/create.js';
import { createTextStatsCharts } from './text_stats_charts.js';

// Add this function near the top of the file
function adjustPopupPosition(popup, x, y) {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  const popupRect = popup.getBoundingClientRect();
  
  // Initialize adjusted coordinates
  let adjustedX = x;
  let adjustedY = y;
  
  // Check right edge
  if (x + popupRect.width > viewport.width) {
    adjustedX = viewport.width - popupRect.width - 20; // 20px padding
  }
  
  // Check bottom edge
  if (y + popupRect.height > viewport.height) {
    adjustedY = viewport.height - popupRect.height - 20; // 20px padding
  }
  
  // Check left edge
  if (adjustedX < 0) {
    adjustedX = 20; // 20px padding
  }
  
  // Check top edge
  if (adjustedY < 0) {
    adjustedY = 20; // 20px padding
  }
  
  return { x: adjustedX, y: adjustedY };
}

// Add this helper function at the top of the file
function createKeywordsHtml(keywords, maxInitial = 10) {
  if (!keywords || !keywords.length) {
    return '<span class="tag" style="background-color=#FFC0CB">No keywords available.</span>';
  }

  const initialKeywords = keywords.slice(0, maxInitial);
  const remainingKeywords = keywords.slice(maxInitial);
  
  let html = initialKeywords.map(k => `<span class="tag">${k}</span>`).join(' ');
  
  if (remainingKeywords.length > 0) {
    html += `
      <button class="show-more-keywords" onclick="event.stopPropagation();">
        +${remainingKeywords.length} more
      </button>
      <span class="remaining-keywords" style="display: none;">
        ${remainingKeywords.map(k => `<span class="tag">${k}</span>`).join(' ')}
      </span>
    `;
  }
  
  return html;
}

// Function to Show Popup with Overlay
export async function showPopup(metadata, x, y) {
  console.log("metadata", metadata);
  if (!metadata) return;

  // Add safety check for required metadata
  if (!metadata.type && metadata.name) {
    // Try to infer type from file extension
    const extension = metadata.name.split('.').pop().toLowerCase();
    metadata.type = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'js': 'application/javascript',
      'json': 'application/json',
      'pdf': 'application/pdf',
    }[extension] || 'application/octet-stream';
  }

  const popup = document.getElementById('popup');
  const overlay = document.getElementById('overlay');

  // Show skeleton loader instead of spinner
  popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <button class="close-button" id="popupClose" title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="skeleton-loader">
        <div class="skeleton-header">
          <div class="skeleton-title"></div>
          <div class="skeleton-meta">
            <div class="skeleton-date"></div>
            <div class="skeleton-size"></div>
          </div>
        </div>
        <div class="skeleton-content">
          <div class="skeleton-preview"></div>
          <div class="skeleton-details">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>
      <div class="popup-footer">
        <button id="deleteFileBtn" class="delete-button" title="Delete file">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
          </svg>
          Delete File
        </button>
      </div>
    </div>
  `;

  // Add skeleton loader styles
  const style = document.createElement('style');
  style.textContent = `
    .popup-content {
      backdrop-filter: blur(10px);
      border-radius: 8px;
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .popup-header {
      position: sticky;
      top: 0;
      background: inherit;
      backdrop-filter: blur(10px);
      padding: 16px;
      z-index: 2;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .close-button {
      background-color: transparent;
      color: rgba(255, 255, 255, 0.8);
      border: none;
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
      transform: scale(1.1);
    }

    .skeleton-loader {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      &::-webkit-scrollbar {
        width: 8px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      
      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
    }

    .skeleton-header {
      margin-bottom: 24px;
    }

    .skeleton-title {
      height: 28px;
      width: 70%;
      background: rgba(128, 128, 128, 0.2);
      border-radius: 4px;
      margin-bottom: 12px;
      animation: pulse 1.5s infinite;
    }

    .skeleton-meta {
      display: flex;
      gap: 12px;
    }

    .skeleton-date, .skeleton-size {
      height: 16px;
      width: 100px;
      background: rgba(128, 128, 128, 0.2);
      border-radius: 4px;
      animation: pulse 1.5s infinite;
    }

    .skeleton-content {
      display: flex;
      gap: 16px;
      margin-top: 20px;
      padding-bottom: 16px;
    }

    .skeleton-preview {
      width: 120px;
      height: 120px;
      background: rgba(128, 128, 128, 0.2);
      border-radius: 8px;
      flex-shrink: 0;
      animation: pulse 1.5s infinite;
    }

    .skeleton-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-line {
      height: 14px;
      width: 100%;
      background: rgba(128, 128, 128, 0.2);
      border-radius: 4px;
      animation: pulse 1.5s infinite;
    }

    .skeleton-line.short {
      width: 60%;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    .popup-footer {
      position: sticky;
      bottom: 0;
      background: inherit;
      backdrop-filter: blur(10px);
      padding: 16px;
      margin-top: auto;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 2;
    }

    .delete-button {
      background-color: rgba(255, 77, 77, 0.1);
      color: #ff4d4d;
      border: 1px solid rgba(255, 77, 77, 0.2);
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 4px;
      transition: all 0.2s;
      font-size: 14px;
    }

    .delete-button:hover {
      background-color: rgba(255, 77, 77, 0.2);
      transform: scale(1.02);
    }

    .delete-button svg {
      width: 16px;
      height: 16px;
    }
  `;
  document.head.appendChild(style);

  // Set the position of the popup
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.style.display = 'block';

   // Remove any existing classes
   popup.classList.remove('hide');
   overlay.classList.remove('hide');

  // Display the overlay
  overlay.style.display = 'block';

  
// Add the 'show' class to trigger the animation
popup.classList.add('show');
overlay.classList.add('show');
  // Prevent click events inside the popup from propagating to the overlay
  const popupContent = popup.querySelector('.popup-content');
  popupContent.addEventListener('click', function(event) {
    event.stopPropagation();
  });

  function closePopup() {
    const popup = document.getElementById('popup');
    const overlay = document.getElementById('overlay');
  
    // Remove the 'show' class and add 'hide' to trigger the closing animation
    popup.classList.remove('show');
    popup.classList.add('hide');
    overlay.classList.remove('show');
    overlay.classList.add('hide');
  
    // Remove event listeners
    popup.removeEventListener('click', function(event) {
      event.stopPropagation();
    });
    overlay.removeEventListener('click', closePopup);
    const closeButton = document.getElementById('popupClose');
    if (closeButton) {
      closeButton.removeEventListener('click', closePopup);
    }
  
    // After the animation ends, hide the popup and overlay
    popup.addEventListener('animationend', function handleAnimationEnd() {
      popup.style.display = 'none';
      overlay.style.display = 'none';
      popup.classList.remove('hide');
      overlay.classList.remove('hide');
      popup.removeEventListener('animationend', handleAnimationEnd);
    });
  }
  

  // Handle Escape Key Press to Close Popup
  function handleKeyPress(event) {
    if (event.key === 'Escape') {
      closePopup();
    }
  }

  // Handle Click on Overlay to Close Popup
  function handleOverlayClick() {
    console.log("overlay got da click")
    closePopup();
  }

  // Attach Event Listeners
  document.addEventListener('keydown', handleKeyPress);
  overlay.addEventListener('click', handleOverlayClick);

  // Optional: Close Button Inside Popup
  const closeButton = document.getElementById('popupClose');
  if (closeButton) {
    closeButton.addEventListener('click', closePopup);
  }

  // Fetch summary and keywords from IndexedDB
  try {
   
    await indexDBOverlay.openDB(config.dbName);
    await indexDBOverlay.initializeDB(Object.keys(config.dbStores));
    
    // Fetch file data from 'file' store in 'fileGraphDB'
    const fileSystem = getFileSystem();
    const fileData = await fileSystem.getItem(metadata.id, 'file');

    if (!fileData) {
      throw new Error('File data not found in IndexedDB');
    }

    const summaries = await indexDBOverlay.getData('summaries');
    const summaryEntry = summaries.find(entry => entry.fileId === metadata.id);
    const { summary, keywords } = summaryEntry || { summary: 'No summary available.', keywords: [] };


    // Remove the spinner
    const spinner = popup.querySelector('.spinner');
    if (spinner) {
      spinner.remove();
    }

    // Populate Popup Content
  
    // Populate Popup Content
    popupContent.innerHTML = `
      <span class="popup-close" id="popupClose">&times;</span>
      <button id="deleteFileBtn" title="Delete file" class="delete-button">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
      <div class="popup-body">
        <p><strong>Name:</strong> ${fileData.name}</p>
        <p><strong>Type:</strong> ${fileData.type}</p>
        <p><strong>Size:</strong> ${fileData.size} bytes</p>
        <p><strong>Last Modified:</strong> ${new Date(fileData.lastModified).toLocaleString()}</p>
        <p><strong>Summary:</strong> <pre class="content-pre">${summary || 'No summary available.'}</pre></p>
        <div id="tagsContainer" style="margin-bottom: 10px;">
          <strong>Keywords:</strong> 
          <div class="keywords-wrapper">
            ${createKeywordsHtml(keywords)}
          </div>
        </div>
        <button id="downloadButton" class="download-button">
          ${getFileTypeIcon(fileData.type)}
          <span class="download-label">Download File</span>
        </button>
        <div class="charts-container">
          <canvas id="readabilityChart" width="400" height="200"></canvas>
          <canvas id="paragraphLengthChart" width="400" height="200"></canvas>
          <div class="charts-row">
            <canvas id="wordStatsChart" width="200" height="200"></canvas>
            <canvas id="sentenceTypesChart" width="200" height="200"></canvas>

          </div>
        </div>
      </div>
    `;

    // Re-attach event listener for the close button
    const newCloseButton = document.getElementById('popupClose');
    if (newCloseButton) {
      newCloseButton.addEventListener('click', closePopup);
    }

    // Attach event listener for download button
    const downloadButton = document.getElementById('downloadButton');
    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        downloadFile(metadata.id);
      });
    }

    // Attach event listener to the file icon to open the file
    const fileIconElement = popupContent.querySelector('#fileIcon');
    if (fileIconElement) {
      fileIconElement.addEventListener('click', () => {
        openFile(metadata.id);
      });
    }

    // Create the charts if text stats are available
    const charts = await createTextStatsCharts(metadata.id);
    if (charts) {
      console.log('Creating charts with config:', charts); // Debug log
      try {
        new Chart(document.getElementById('readabilityChart').getContext('2d'), charts.readabilityChart);
        new Chart(document.getElementById('paragraphLengthChart').getContext('2d'), charts.paragraphLengthChart);
        new Chart(document.getElementById('sentenceTypesChart').getContext('2d'), charts.sentenceTypesChart);
        new Chart(document.getElementById('wordStatsChart').getContext('2d'), charts.wordStatsRadarChart); // Match this name
        console.log('Charts created successfully');
      } catch (error) {
        console.error('Error creating charts:', error);
      }
    }

    // Add CSS for the delete button
    const style = document.createElement('style');
    style.textContent = `
      .delete-button {
        position: absolute;
        top: 10px;
        right: 40px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        transition: background-color 0.2s;
      }

      .delete-button:hover {
        background-color: #c82333;
      }

      .delete-button svg {
        stroke-width: 2;
      }
    `;
    document.head.appendChild(style);

    // Add event listener for delete button
    const deleteButton = document.getElementById('deleteFileBtn');
    if (deleteButton) {
      deleteButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this file?')) {
          try {
            console.log('Starting deletion process for file:', {
              id: metadata.id,
              filename: metadata.name || metadata.filename
            });
            
            // 1. Mark as deleted in scene state first (this updates the graph table)
            const { sceneState } = await import('../memory/collaboration/scene_colab.ts');
            
            // Debug log scene state before deletion
            sceneState.debugLogSceneState('Before Deletion');
            
            // Try to delete by both ID and filename
            await sceneState.markObjectAsDeleted(metadata.id, {
              filename: metadata.name || metadata.filename,
              forceReconstruct: true
            });
            
            // Debug log scene state after deletion
            sceneState.debugLogSceneState('After Deletion');

            // Continue with rest of deletion process
            await indexDBOverlay.markDeletedAcrossTables(metadata.id);
            console.log('Marked as deleted across all tables');
            
            const inMemoryStore = await import('../memory/local/in_memory.ts');
            await inMemoryStore.default.deleteFromAllTables(metadata.id);
            console.log('Cleaned up in-memory storage');

            const { removeLabel } = await import('../ui/graph_v2/create.js');
            await removeLabel(metadata.id, metadata.name || metadata.filename);
            console.log('Removed label');

            const event = new CustomEvent('fileDeleted', {
              detail: { fileId: metadata.id }
            });
            window.dispatchEvent(event);
            console.log('File tree UI updated');

            closePopup();
            console.log('Deletion process completed successfully');
          } catch (error) {
            console.error('Error in deletion process:', error);
            alert('Error deleting file. Please try again.');
          }
        }
      });
    }

    // Add event listener for the show more button after creating the popup content
    const showMoreBtn = popupContent.querySelector('.show-more-keywords');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const remainingKeywords = popupContent.querySelector('.remaining-keywords');
        const btn = e.target;
        
        if (remainingKeywords.style.display === 'none') {
          remainingKeywords.style.display = 'inline';
          btn.textContent = 'Show less';
        } else {
          remainingKeywords.style.display = 'none';
          btn.textContent = `+${(keywords.length - 10)} more`;
        }
      });
    }

  } catch (error) {
    console.error('Error fetching file data:', error);
    // Handle error (e.g., display an error message)
  }

  // Get adjusted position after popup is visible and has dimensions
  const { x: adjustedX, y: adjustedY } = adjustPopupPosition(popup, x, y);
  
  // Set adjusted position
  popup.style.left = `${adjustedX}px`;
  popup.style.top = `${adjustedY}px`;
}

// Helper function to get the file type icon
function getFileTypeIcon(mimeType) {
  // Add safety check with fallback to a default icon
  if (!mimeType) {
    console.warn('Missing mimeType, using default icon');
    return `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    `;
  }

  let iconSVG = '';
  if (mimeType.startsWith('image/')) {
    // Use the SVG for images
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
      <!-- SVG path for images -->
      <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>`;
  } else if (mimeType === 'application/pdf') {
    // Use the SVG for PDFs
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
      <!-- SVG path for PDFs -->
      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>`;
  } else if (mimeType.startsWith('text/')) {
    // Use the SVG for text files
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
      <!-- SVG path for text files -->
      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>`;
  } else {
    // Generic file icon
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" ...></svg>`;
  }
  return iconSVG;
}

// Function to open the file in a new tab
async function openFile(fileId) {
  try {
    const file = await retrieveFile(fileId);
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  } catch (error) {
    console.error('Error opening file:', error);
  }
}

// Function to download the file
async function downloadFile(fileId) {
  try {
    const file = await retrieveFile(fileId);
    const url = URL.createObjectURL(file);

    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
  }
}