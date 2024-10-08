// popup.js

// Function to Show Popup with Overlay
export function showPopup(metadata, x, y) {
  console.log("metadata", metadata);
  if (!metadata) return;

  const popup = document.getElementById('popup');
  const overlay = document.getElementById('overlay');

  // Populate Popup Content
  popup.innerHTML = `
    <div class="popup-content">
      <span class="popup-close" id="popupClose">&times;</span>
      <p><strong>Name:</strong> ${metadata.name}</p>
      <p><strong>Type:</strong> ${metadata.type}</p>
      <p><strong>Size:</strong> ${metadata.size} bytes</p>
      <p><strong>Last Modified:</strong> ${new Date(metadata.lastModified).toLocaleString()}</p>
      <p><strong>Content:</strong> <pre class="content-pre">${metadata.content}</pre></p>
      <div id="tagsContainer" style="margin-bottom: 10px;"></div>
      <canvas id="fileChangeChart" width="400" height="200"></canvas>
      <canvas id="edgesChart" width="400" height="200"></canvas>
    </div>
  `;

  // Set the position of the popup
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.style.display = 'block';

  // Display the overlay
  overlay.style.display = 'block';

  // Prevent click events inside the popup from propagating to the overlay
  const popupContent = popup.querySelector('.popup-content');
  popupContent.addEventListener('click', function(event) {
    event.stopPropagation();
  });

  // Add mock tags
  const tags = ['example', 'metadata', 'file', 'keyword'];
  const tagsContainer = document.getElementById('tagsContainer');
  tagsContainer.innerHTML = '';
  tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.innerText = tag;
    tagsContainer.appendChild(tagElement);
  });

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

  // Function to Close Popup
  function closePopup() {
    popup.style.display = 'none';
    overlay.style.display = 'none';
    document.removeEventListener('keydown', handleKeyPress);
    overlay.removeEventListener('click', handleOverlayClick);
    const closeButton = document.getElementById('popupClose');
    if (closeButton) {
      closeButton.removeEventListener('click', closePopup);
    }
  }

  // Handle Escape Key Press to Close Popup
  function handleKeyPress(event) {
    if (event.key === 'Escape') {
      closePopup();
    }
  }

  // Handle Click on Overlay to Close Popup
  function handleOverlayClick() {
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
}
