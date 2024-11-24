import { SCRAPER_ENDPOINT, LOCAL_SCRAPER_ENDPOINT, NODE_ENV } from "../../configs/env_configs.js";
import { generateUniqueId } from "../../utils/utils";
// import { createSphere, randomColorGenerator } from "./create.js";

// Add this after other global variables
export let contextMenu = null;
let currentIntersectPoint = null; // Store the intersection point

document.addEventListener('DOMContentLoaded', () => {
  if (!contextMenu) {
    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    document.body.appendChild(contextMenu);
  }
});

// Update mousedown handler to be more specific
document.addEventListener('mousedown', (event) => {
  // Only handle clicks outside the menu and its children
  if (contextMenu && 
      contextMenu.classList.contains('visible') && 
      !contextMenu.contains(event.target) &&
      !event.target.closest('.context-menu') &&
      !event.target.closest('.url-input-container')) {
    
    // Prevent closing if it's a double click that created the menu
    if (event.detail === 2) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    hideContextMenu();
  }
});

// Add ESC key handler
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideContextMenu();
  }
});

function createContextMenu() {
  const menuContent = document.createDocumentFragment();
  
  // Create menu header to hold close button
  const menuHeader = document.createElement('div');
  menuHeader.className = 'context-menu-header';
  menuContent.appendChild(menuHeader);
  
  // Load File option
  const loadFileItem = document.createElement('div');
  loadFileItem.className = 'context-menu-item';
  loadFileItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
    Load File
  `;

  // Website option
  const websiteItem = document.createElement('div');
  websiteItem.className = 'context-menu-item';
  websiteItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
    Website
  `;

  menuContent.appendChild(loadFileItem);
  menuContent.appendChild(websiteItem);
  
  return menuContent;
}

function showURLInput(x, y, intersectPoint) {
  const container = document.createElement('div');
  container.className = 'url-input-container';
  
  const input = document.createElement('input');
  input.className = 'url-input';
  input.placeholder = 'Enter URL...';
  
  const sendButton = document.createElement('button');
  sendButton.className = 'url-button';
  sendButton.textContent = 'Send';
  
  const backButton = document.createElement('button');
  backButton.className = 'url-button';
  backButton.textContent = 'Back';
  
  container.appendChild(input);
  container.appendChild(sendButton);
  container.appendChild(backButton);
  
  contextMenu.innerHTML = '';
  contextMenu.appendChild(container);
  
  input.focus();
  
  sendButton.onclick = async () => {
    const url = input.value;
    if (!url) return;
    
    try {
      const endpoint = NODE_ENV === 'development' ? LOCAL_SCRAPER_ENDPOINT : SCRAPER_ENDPOINT;
      const response = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      const text = await response.text();
      
      // Create a File object from the scraped content
      const file = new File(
        [text],
        `${url.split('/').pop() || 'webpage'}.md`,
        { 
          type: 'text/markdown',
          lastModified: Date.now()
        }
      );

      // Create a DataTransfer object
      const dt = new DataTransfer();
      dt.items.add(file);

      // Create synthetic event similar to tab drop
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: x,
        clientY: y,
        dataTransfer: {
          files: dt.files,
          items: [{
            getAsFile: () => file,
            kind: 'file',
            type: file.type
          }],
          getData: () => '',
          types: ['Files']
        },
        source: {
          data: {
            id: generateUniqueId(),
            name: url,
            content: text,
            type: 'url'
          }
        },
        intersectPoint: intersectPoint
      };

      // Dispatch tabDrop event
      const canvas = document.querySelector('canvas');
      canvas.dispatchEvent(new CustomEvent('tabDrop', { 
        bubbles: true,
        cancelable: true,
        detail: syntheticEvent
      }));

      hideContextMenu();
    } catch (error) {
      console.error('Error scraping website:', error);
    }
  };
  
  backButton.onclick = () => {
    showContextMenu(x, y, intersectPoint);
  };
}

export function showContextMenu(x, y, intersectPoint) {
  currentIntersectPoint = intersectPoint;

  if (!contextMenu) {
    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    document.body.appendChild(contextMenu);
  }

  const menuWidth = 200;
  const menuHeight = 100;
  
  const adjustedX = Math.min(x, window.innerWidth - menuWidth);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight);

  contextMenu.style.left = `${adjustedX}px`;
  contextMenu.style.top = `${adjustedY}px`;
  
  contextMenu.innerHTML = '';
  const menuContent = createContextMenu();
  contextMenu.appendChild(menuContent);
  contextMenu.classList.add('visible');

  // Stop propagation of all click events within the menu
  contextMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Stop propagation of all mousedown events within the menu
  contextMenu.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Add click handlers
  const items = contextMenu.querySelectorAll('.context-menu-item');
  items[0].onclick = () => { // Load File
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      
      for (const file of files) {
        // Create synthetic event for each file
        const dt = new DataTransfer();
        dt.items.add(file);

        const syntheticEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: x,
          clientY: y,
          dataTransfer: {
            files: dt.files,
            items: [{
              getAsFile: () => file,
              kind: 'file',
              type: file.type
            }],
            getData: () => '',
            types: ['Files']
          },
          source: {
            data: {
              id: generateUniqueId(),
              name: file.name,
              type: 'file'
            }
          },
          intersectPoint: currentIntersectPoint
        };

        // Dispatch tabDrop event for each file
        const canvas = document.querySelector('canvas');
        canvas.dispatchEvent(new CustomEvent('tabDrop', { 
          bubbles: true,
          cancelable: true,
          detail: syntheticEvent
        }));
      }
      
      hideContextMenu();
    };
    input.click();
  };

  items[1].onclick = () => { // Website
    showURLInput(x, y, intersectPoint);
  };
}

export function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove('visible');
  }
}

// Add this CSS to your stylesheet
const style = document.createElement('style');
style.textContent = `
  .context-menu {
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    padding: 8px 0;
    position: fixed;
    min-width: 200px;
    z-index: 1000;
    display: none;
  }

  .context-menu.visible {
    display: block;
  }

  .context-menu-header {
    padding: 4px 8px;
  }

  .context-menu-item {
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .context-menu-item:hover {
    background-color: #f0f0f0;
  }

  .context-menu-item svg {
    width: 20px;
    height: 20px;
  }

  .url-input-container {
    padding: 8px;
  }

  .url-input {
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .url-button {
    padding: 6px 12px;
    margin-right: 8px;
    border: none;
    border-radius: 4px;
    background-color: #007bff;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .url-button:hover {
    background-color: #0056b3;
  }

  .url-button:last-child {
    background-color: #6c757d;
  }

  .url-button:last-child:hover {
    background-color: #545b62;
  }
`;

document.head.appendChild(style);
