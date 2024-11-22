// popup.js
// Import getFileSystem to access IndexedDB
import { getFileSystem } from '../memory/collaboration/file_colab';
import { retrieveFile } from '../memory/fileHandler.js'; // Adjust the import path
import indexDBOverlay from '../memory/local/file_worker'; // Adjust the path as necessary
import config from '../configs/config.json';
// import { sceneState } from '../memory/collaboration/scene_colab';
// import Chart from 'chart.js/auto'; // Ensure Chart.js is properly imported

// Function to Show Popup with Overlay
export async function showPopup(metadata, x, y) {
  console.log("metadata", metadata);
  if (!metadata) return;

  const popup = document.getElementById('popup');
  const overlay = document.getElementById('overlay');

  // Show loading spinner
  popup.innerHTML = `
    <div class="popup-content">
      <span class="popup-close" id="popupClose">&times;</span>
      <div class="spinner"></div> <!-- Add a spinner -->
    </div>
  `;

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

  // Function to Close Popup
  // function closePopup() {
  //   popup.style.display = 'none';
  //   overlay.style.display = 'none';
  //   document.removeEventListener('keydown', handleKeyPress);
  //   overlay.removeEventListener('click', handleOverlayClick);
  //   const closeButton = document.getElementById('popupClose');
  //   if (closeButton) {
  //     closeButton.removeEventListener('click', closePopup);
  //   }
  // }

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
      <button id="deleteFileBtn" class="delete-button">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        Delete File
      </button>
      <div class="popup-body">
        <p><strong>Name:</strong> ${fileData.name}</p>
        <p><strong>Type:</strong> ${fileData.type}</p>
        <p><strong>Size:</strong> ${fileData.size} bytes</p>
        <p><strong>Last Modified:</strong> ${new Date(fileData.lastModified).toLocaleString()}</p>
        <p><strong>Summary:</strong> <pre class="content-pre">${summary || 'No summary available.'}</pre></p>
        <div id="tagsContainer" style="margin-bottom: 10px;">
          <strong>Keywords:</strong> ${keywords ? keywords.map(k => `<span class="tag">${k}</span>`).join(' ') : '</span class="tag" style="background-color=#FFC0CB">No keywords available.</span>'}
        </div>
        <button id="downloadButton" class="download-button">
          ${getFileTypeIcon(fileData.type)}
          <span class="download-label">Download File</span>
        </button>
        <canvas id="fileChangeChart" width="400" height="200"></canvas>
        <canvas id="edgesChart" width="400" height="200"></canvas>
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

    // Mock data for the file change over time graph
    const fileChangeData = {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [{
        label: 'File Size Over Time',
        data: [500, 1000, 750, 1200, 1100, 1300, 900],
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    };

    // Create the file change over time graph
    const fileChangeCtx = document.getElementById('fileChangeChart').getContext('2d');
    new Chart(fileChangeCtx, {
      type: 'line',
      data: fileChangeData,
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });

    // Mock data for the edges connecting to this node graph
    const edgesData = {
      labels: ['Node A', 'Node B', 'Node C', 'Node D'],
      datasets: [{
        label: 'Connections',
        data: [2, 3, 5, 1],
        backgroundColor: 'rgb(255, 99, 132)',
      }]
    };

    // Create the edges connecting to this node graph
    const edgesCtx = document.getElementById('edgesChart').getContext('2d');
    new Chart(edgesCtx, {
      type: 'bar',
      data: edgesData,
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });

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
            // Use 'files' store instead of 'file'
            await indexDBOverlay.deleteItem_field('files', metadata.id);
            
            // Update the scene state to mark the corresponding sphere as deleted
            const sceneState = window.sceneState; // Make sure sceneState is imported
            if (sceneState) {
              // Find and update the sphere that represents this file
              const sphereState = Array.from(sceneState.getSerializableState()).find(
                obj => obj.shape === 'sphere' && obj.userData?.id === metadata.id
              );
              
              if (sphereState) {
                sceneState.updateObject({
                  ...sphereState,
                  isDeleted: true,
                  version: sphereState.version + 1
                });
              }
            }

            closePopup();
          } catch (error) {
            console.error('Error deleting file:', error);
          }
        }
      });
    }

  } catch (error) {
    console.error('Error fetching file data:', error);
    // Handle error (e.g., display an error message)
  }
}

// Helper function to get the file type icon
function getFileTypeIcon(mimeType) {
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
