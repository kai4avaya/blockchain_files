// export function showPopup(metadata) {
//     console.log("metadata", metadata)
//     if(!metadata) return
//     const popup = document.getElementById('popup');
//     popup.innerHTML = `
//       <div class="popup-content">
//         <p><strong>Name:</strong> ${metadata.name}</p>
//         <p><strong>Type:</strong> ${metadata.type}</p>
//         <p><strong>Size:</strong> ${metadata.size} bytes</p>
//         <p><strong>Last Modified:</strong> ${new Date(metadata.lastModified).toLocaleString()}</p>
//         <p><strong>Content:</strong> <pre class="content-pre">${metadata.content}</pre></p>
//         <div id="tagsContainer" style="margin-bottom: 10px;"></div>
//         <canvas id="fileChangeChart" width="400" height="200"></canvas>
//         <canvas id="edgesChart" width="400" height="200"></canvas>
//       </div>
//     `;
//     popup.style.display = 'block';
  
//     // Add mock tags
//     const tags = ['example', 'metadata', 'file', 'keyword'];
//     const tagsContainer = document.getElementById('tagsContainer');
//     tagsContainer.innerHTML = '';
//     tags.forEach(tag => {
//       const tagElement = document.createElement('span');
//       tagElement.className = 'tag';
//       tagElement.innerText = tag;
//       tagsContainer.appendChild(tagElement);
//     });
  
//     // Mock data for the file change over time graph
//     const fileChangeData = {
//       labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
//       datasets: [{
//         label: 'File Size Over Time',
//         data: [500, 1000, 750, 1200, 1100, 1300, 900],
//         fill: false,
//         borderColor: 'rgb(75, 192, 192)',
//         tension: 0.1
//       }]
//     };
  
//     // Create the file change over time graph
//     const fileChangeCtx = document.getElementById('fileChangeChart').getContext('2d');
//     new Chart(fileChangeCtx, {
//       type: 'line',
//       data: fileChangeData,
//       options: {
//         scales: {
//           y: {
//             beginAtZero: true
//           }
//         }
//       }
//     });
  
//     // Mock data for the edges connecting to this node graph
//     const edgesData = {
//       labels: ['Node A', 'Node B', 'Node C', 'Node D'],
//       datasets: [{
//         label: 'Connections',
//         data: [2, 3, 5, 1],
//         backgroundColor: 'rgb(255, 99, 132)',
//       }]
//     };
  
//     // Create the edges connecting to this node graph
//     const edgesCtx = document.getElementById('edgesChart').getContext('2d');
//     new Chart(edgesCtx, {
//       type: 'bar',
//       data: edgesData,
//       options: {
//         scales: {
//           y: {
//             beginAtZero: true
//           }
//         }
//       }
//     });
//   }
  

export function showPopup(metadata) {
  console.log("metadata", metadata);
  if (!metadata) return;
  const popup = document.getElementById('popup');
  popup.innerHTML = `
    <div class="popup-content">
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
  popup.style.display = 'block';

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

  // Close popup on Escape key
  function handleKeyPress(event) {
    if (event.key === 'Escape') {
      closePopup();
    }
  }

  // Close popup on click outside the popup content
  function handleClickOutside(event) {
    if (!popup.contains(event.target)) {
      closePopup();
    }
  }

  // Close popup function
  function closePopup() {
    popup.style.display = 'none';
    document.removeEventListener('keydown', handleKeyPress);
    document.removeEventListener('click', handleClickOutside);
  }

  // Add event listeners
  document.addEventListener('keydown', handleKeyPress);
  document.addEventListener('click', handleClickOutside);
}
