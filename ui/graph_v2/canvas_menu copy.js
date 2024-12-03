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
  
  const inputWrapper = document.createElement('div');
  inputWrapper.style.display = 'flex';
  inputWrapper.style.gap = '8px';
  
  const input = document.createElement('input');
  input.className = 'url-input';
  input.placeholder = 'Enter URL...';
  
  const buttonWrapper = document.createElement('div');
  buttonWrapper.style.display = 'flex';
  buttonWrapper.style.gap = '8px';
  
  const sendButton = document.createElement('button');
  sendButton.className = 'url-button modal-button';
  sendButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
    Scrape
  `;
  
  const backButton = document.createElement('button');
  backButton.className = 'url-button modal-button';
  backButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
    Cancel Scrape
  `;
  
  inputWrapper.appendChild(input);
  buttonWrapper.appendChild(sendButton);
  buttonWrapper.appendChild(backButton);
  container.appendChild(inputWrapper);
  container.appendChild(buttonWrapper);
  
  contextMenu.innerHTML = '';
  contextMenu.appendChild(container);
  
  input.focus();

  let isFetching = false;
  let abortController = new AbortController();
  
  function formatURL(url) {
    console.log('Formatting URL:', url);
    // Remove leading/trailing whitespace
    url = url.trim();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Add www if needed (only if it's not already there and not a subdomain)
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('.') || urlObj.hostname.split('.').length === 2) {
      if (!urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = 'www.' + urlObj.hostname;
        url = urlObj.toString();
      }
    }
    
    console.log('Formatted URL:', url);
    return url;
  }
  
  sendButton.onclick = async () => {
    console.log('Send button clicked');
    if (isFetching) {
      console.log('Already fetching, ignoring click');
      return;
    }
    
    const url = input.value;
    if (!url) {
      console.log('No URL provided');
      return;
    }
    
    const originalText = sendButton.textContent;
    console.log('Starting fetch process');
    
    try {
      isFetching = true;
      
      // Show spinner
      sendButton.innerHTML = '<div class="button-spinner"></div>';
      sendButton.disabled = true;
      
      const formattedUrl = formatURL(url);
      const endpoint = NODE_ENV === 'development' ? LOCAL_SCRAPER_ENDPOINT : SCRAPER_ENDPOINT;
      
      // Fix URL construction by adding a separator
      const fetchUrl = `${endpoint}${endpoint.includes('?') ? '&' : '?'}url=${encodeURIComponent(formattedUrl)}`;
      console.log('Fetching from:', fetchUrl);
      
      const response = await fetch(fetchUrl, {
        signal: abortController.signal
      });
      
      console.log('Received response:', response.status);
      const text = await response.text();
      console.log('Received text length:', text.length);
      
      // Create synthetic event only if we haven't aborted
      if (!abortController.signal.aborted) {
        const file = new File(
          [text],
          `${formattedUrl.split('/').pop() || 'webpage'}.md`,
          { 
            type: 'text/markdown',
            lastModified: Date.now()
          }
        );

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
              name: url,
              content: text,
              type: 'url'
            }
          },
          intersectPoint: intersectPoint
        };

        console.log('Dispatching tabDrop event');
        const canvas = document.querySelector('canvas');
        canvas.dispatchEvent(new CustomEvent('tabDrop', { 
          bubbles: true,
          cancelable: true,
          detail: syntheticEvent
        }));

        hideContextMenu();
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (!error.name === 'AbortError') {
        console.error('Error scraping website:', error);
      }
    } finally {
      if (!abortController.signal.aborted) {
        console.log('Cleaning up after fetch');
        isFetching = false;
        sendButton.innerHTML = originalText;
        sendButton.disabled = false;
      }
    }
  };
  
  backButton.onclick = () => {
    console.log('Back button clicked');
    if (isFetching) {
      console.log('Aborting fetch');
      abortController.abort();
      abortController = new AbortController();
    }
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
        // Read file content
        const content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsText(file);
        });

        // Create synthetic event with file content
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
              type: 'file',
              content: content
            }
          },
          intersectPoint: currentIntersectPoint
        };

        // Dispatch tabDrop event
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
    padding: 12px;
    min-width: 300px;
  }

  .url-input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    min-width: 0;
  }

  .url-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
    min-height: 35px;
  }


  .url-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }


  .url-button:last-child:hover:not(:disabled) {
    background-color: #545b62;
  }

  .button-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

document.head.appendChild(style);

// Add after other styles
const additionalStyles = `
  .modal-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background-color: white;
    border-radius: 8px;
    padding: 8px;
    transition: all 0.2s ease;
    border: none;
    color: #3b82f6;
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    width: auto;
    min-width: 80px;
  }

  .modal-button:hover {
    background-color: #e2e8f0;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .modal-button .small-icon {
    width: 16px;
    height: 16px;
  }

  .modal-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background-color: #f0f0f0;
    color: #999;
    transform: none;
    box-shadow: none;
  }

  .button-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(59, 130, 246, 0.3);
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

document.head.insertAdjacentHTML('beforeend', `<style>${additionalStyles}</style>`);
