// memory\fileHandler.js
import { generateUniqueId } from "../utils/utils";
import { getFileSystem } from "./collaboration/file_colab";
import { orchestrateTextProcessing } from "../ai/text_orchestration.js";
import { textStats } from './text_stats.js';
import { gsap } from 'gsap';
import * as THREE from 'three';
let compressionWorker;
let workerIdleTimeout;

export function initializeWorker() {
  if (!compressionWorker) {
    compressionWorker = new Worker("../workers/compress_worker.js");

    // Automatically terminate the worker after inactivity
    compressionWorker.onmessage = (event) => {
      const { success, compressedData, decompressedData, error } = event.data;

      if (!success) {
        console.error("Worker error:", error);
      } else if (compressedData) {
        resolveWorkerTask("compress", compressedData);
      } else if (decompressedData) {
        resolveWorkerTask("decompress", decompressedData);
      }
    };

    workerIdleTimeout = setTimeout(terminateWorker, 30000); // Idle timeout to close worker
  }
}

function terminateWorker() {
  if (compressionWorker) {
    compressionWorker.terminate();
    compressionWorker = null;
    clearTimeout(workerIdleTimeout);
  }
}

const workerTasks = {
  compress: null,
  decompress: null,
};

function resolveWorkerTask(type, data) {
  if (workerTasks[type]) {
    workerTasks[type].resolve(data);
    workerTasks[type] = null;
  }
}

function compressData_old(arrayBuffer) {
  return new Promise((resolve, reject) => {
    initializeWorker();
    workerTasks.compress = { resolve, reject };
    compressionWorker.postMessage({ action: "compress", data: arrayBuffer });
  });
}

function decompressData_old(uint8Array) {
  return new Promise((resolve, reject) => {
    initializeWorker();
    workerTasks.decompress = { resolve, reject };
    compressionWorker.postMessage({ action: "decompress", data: uint8Array });
  });
}

const fileTree = document.getElementById("fileTree");
const processingQueue = [];
let isProcessing = false;

// File type to icon mapping
const FILE_ICONS = {
  // Documents
  'txt': 'fa-file-text',
  'md': 'fa-file-text',
  'doc': 'fa-file-text',
  'docx': 'fa-file-text',
  'rtf': 'fa-file-text',
  // PDFs
  'pdf': 'fa-file-pdf',
  // Images
  'jpg': 'fa-picture-o',
  'jpeg': 'fa-picture-o',
  'png': 'fa-picture-o',
  'gif': 'fa-picture-o',
  'svg': 'fa-picture-o',
  // Code
  'js': 'fa-code',
  'jsx': 'fa-code',
  'ts': 'fa-code',
  'tsx': 'fa-code',
  'html': 'fa-code',
  'css': 'fa-code',
  'py': 'fa-code',
  // Default
  'default': 'fa-file'
};

function getFileIcon(filename) {
  if (!filename) return FILE_ICONS.default;
  
  const extension = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[extension] || FILE_ICONS.default;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}


async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (file.type === "application/pdf") {
          resolve(reader.result); // Keep as ArrayBuffer for PDFs
        } else {
          resolve(reader.result); // String for text files
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    
    if (file.type === "application/pdf") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}


async function processFile(fileEntry, id) {
  return new Promise((resolve, reject) => {
    fileEntry.file(async (file) => {
      try {
        const fileSystem = getFileSystem();
        const content = await readFileContent(file);
        
        // Process text files for stats
        if (file.type === 'text/plain' || 
            file.type === 'text/markdown' || 
            file.type === 'text/javascript') {
          try {
            const stats = textStats.processTextStats(content, id);
          } catch (error) {
            console.error('Error processing text stats:', error);
          }
        }

        // Determine if content should be treated as text
        const isText = file.type.startsWith('text/') || 
                      file.type === 'application/javascript' ||
                      file.type === 'application/json';

        // For PDFs, content is already an ArrayBuffer
        // For text, content is a string that needs encoding
        let dataToCompress;
        if (file.type === 'application/pdf') {
          dataToCompress = new Uint8Array(content);
        } else if (isText) {
          dataToCompress = content; // Will be encoded in worker
        } else {
          dataToCompress = content;
        }

        // Compress the content
        const compressedContent = await compressData(dataToCompress, isText);
        
        const fileMetadata = {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          isDeleted: false,
          content: compressedContent,
        };

        await fileSystem.addOrUpdateItem(fileMetadata, "file");
        
        // Process content for vectorization
        // For PDFs, pass the raw ArrayBuffer
        await orchestrateTextProcessing(
          file.type === 'application/pdf' ? content : content,
          file,
          id
        );
        
        addFileToTree(fileMetadata);
        resolve();
      } catch (error) {
        console.error(`Error processing file ${id}:`, error);
        reject(error);
      }
    }, reject);
  });
}

export async function retrieveFile(id) {
  const fileSystem = getFileSystem();
  const fileMetadata = await fileSystem.getItem(id, "file");
  
  if (fileMetadata) {
    try {
      // Convert content to Uint8Array if it's not already
      const compressedContent = new Uint8Array(fileMetadata.content);
      
      // Determine if this is a text file
      const isText = fileMetadata.type.startsWith('text/') || 
                    fileMetadata.type === 'application/javascript' ||
                    fileMetadata.type === 'application/json';
      
      // Decompress with text flag
      const decompressedContent = await decompressData(compressedContent, isText);
      
      // Create the appropriate Blob
      let blob;
      if (fileMetadata.type === "application/pdf") {
        // For PDFs, use the raw ArrayBuffer
        blob = new Blob([decompressedContent], { type: fileMetadata.type });
      } else if (isText) {
        // For text files, the worker has already decoded the content
        blob = new Blob([decompressedContent], { type: fileMetadata.type });
      } else {
        // For other binary files
        blob = new Blob([decompressedContent], { type: fileMetadata.type });
      }

      return new File([blob], fileMetadata.name, {
        type: fileMetadata.type,
        lastModified: fileMetadata.lastModified,
      });
    } catch (error) {
      console.error('Error processing file content:', error);
      throw error;
    }
  } else {
    throw new Error(`File with id ${id} not found`);
  }
}
export function handleFileDrop(event) {
  event.preventDefault();
  const items = event.dataTransfer.items;
  const files = [];
  const fileIds = [];
  const fileNames = [];
  const fileEntries = [];

  // Generate IDs and collect basic info immediately
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry();
    const uuid = generateUniqueId();
    const file = item.getAsFile();

    if (file) {
      files.push(file);
      fileIds.push(uuid);
      fileNames.push(file.name);
      fileEntries.push(file);
    }
  }

  // Process files in the background
  setTimeout(() => {
    processFiles(files, fileIds).catch(error => {
      console.error("Background file processing error:", error);
    });
  }, 0);

  // Return IDs immediately
  return { fileIds, fileNames, fileEntries };
}

// Update processFiles to be more explicitly async
async function processFiles(files, uuids) {
  const processPromises = files.map((file, i) => {
    const id = uuids[i];
    if (file instanceof File) {
      return processFile({
        file: (callback) => callback(file),
        name: file.name,
        isFile: true
      }, id);
    }
    return processFile(file, id);
  });

  try {
    await Promise.all(processPromises);
    refreshFileTree();
  } catch (error) {
    console.error("Error in background file processing:", error);
  }
}

function queueItemForProcessing(processingFunction) {
  processingQueue.push(processingFunction);
}

async function processQueue() {
  if (isProcessing || processingQueue.length === 0) return;

  isProcessing = true;
  while (processingQueue.length > 0) {
    const processFunction = processingQueue.shift();
    try {
      await processFunction();
    } catch (error) {
      console.error("Error processing item:", error);
    }
  }
  isProcessing = false;
}


function processDirectory(directoryEntry, id) {
  return new Promise((resolve, reject) => {
    const dirReader = directoryEntry.createReader();
    const directoryMetadata = {
      id,
      name: directoryEntry.name,
      fileIds: [],
      tags: [],
      summary: "",
      lastModified: Date.now(),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
    };

    const readEntries = () => {
      dirReader.readEntries(async (entries) => {
        if (entries.length === 0) {
          try {
            const fileSystem = getFileSystem();
            await fileSystem.addOrUpdateItem(directoryMetadata, "directory");
            const folder = createFolderElement(directoryEntry.name);
            fileTree.appendChild(folder);
            resolve(folder);
          } catch (error) {
            reject(error);
          }
        } else {
          for (const entry of entries) {
            if (entry.isFile) {
              const fileId = generateUniqueId();
              queueItemForProcessing(() => processFile(entry, fileId));
              directoryMetadata.fileIds.push(fileId);
            } else if (entry.isDirectory) {
              const subFolderId = generateUniqueId();
              queueItemForProcessing(() => processDirectory(entry, subFolderId));
            }
          }
          readEntries();
        }
      }, reject);
    };

    readEntries();
  });
}
function addFileToTree(file) {
    const li = document.createElement("li");
    const iconClass = getFileIcon(file.name);
    
    // Create the content wrapper
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "content-wrapper";
    
    // Create file name section
    const fileName = document.createElement("div");
    fileName.className = "file-name";
    fileName.innerHTML = `
      <i class="fa ${iconClass}"></i>
      <span>${file.name}</span>
    `;
    
    // Create file details section
    const fileDetails = document.createElement("div");
    fileDetails.className = "file-details";
    
    const fileSize = document.createElement("span");
    fileSize.className = "file-size";
    fileSize.textContent = formatFileSize(file.size);
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = window.fileMetadata.get(file.id)?.isSelected ?? false;
    checkbox.dataset.fileId = file.id;
    
    // Add event listener for checkbox changes
    checkbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const fileId = e.target.dataset.fileId;
      
      // Update metadata
      if (window.fileMetadata.has(fileId)) {
        const metadata = window.fileMetadata.get(fileId);
        metadata.isSelected = isChecked;
        window.fileMetadata.set(fileId, metadata);
      }
      
      // Dispatch event for bloom update
      window.dispatchEvent(new CustomEvent('checkboxStateChanged', {
        detail: {
          fileId: fileId,
          isSelected: isChecked
        }
      }));
      
      updateParentCheckbox(fileElement);
    });
    
    fileDetails.appendChild(fileSize);
    fileDetails.appendChild(checkbox);
    
    contentWrapper.appendChild(fileName);
    contentWrapper.appendChild(fileDetails);
    li.appendChild(contentWrapper);
    
    fileTree.appendChild(li);
    addRowInteractions()
  }
  

  /* Add this JavaScript code */
function addRowInteractions() {
  // Remove any existing listeners
  const existingRows = document.querySelectorAll('.content-wrapper');
  existingRows.forEach(row => {
    row.removeEventListener('click', handleRowClick);
  });

  // Add listeners to all rows
  const rows = document.querySelectorAll('.content-wrapper');
  rows.forEach(row => {
    row.addEventListener('click', handleRowClick);
  });
}


async function handleRowClick(event) {
  // Keep existing popup logic
  if (event.target.type === 'checkbox' || event.target.classList.contains('fa-folder') || event.target.classList.contains('fa-folder-open')) return;

  const row = event.currentTarget;
  const fileId = row.querySelector('input[type="checkbox"]')?.dataset.fileId;
  
  if (!fileId || row.querySelector('.fa-folder, .fa-folder-open')) return;

  // Get file metadata and show popup
  const rect = row.getBoundingClientRect();
  const x = rect.right + 10;
  const y = rect.top;

  const fileSystem = getFileSystem();
  const metadata = await fileSystem.getItem(fileId, "file");
  
  if (metadata) {
    // Show popup
    const { showPopup } = await import('../ui/popup.js');
    showPopup(metadata, x, y);

    // Dynamically import share3dDat
    const { share3dDat } = await import('../ui/graph_v2/create.js');
    const { scene, camera, controls } = share3dDat();
    
    // Find sphere by recursively searching scene
    let sphere = null;
    scene.traverse((obj) => {
      if (obj.userData?.id === fileId && 
          (obj.geometry instanceof THREE.IcosahedronGeometry || 
           obj.geometry instanceof THREE.SphereGeometry)) {
        sphere = obj;
      }
    });

    if (sphere) {
      // Disable controls temporarily
      controls.enabled = false;
      
      // Calculate positions
      const targetPos = sphere.position.clone();
      const distance = 20; // Adjust this value to change how far back the camera is
      const offset = new THREE.Vector3(0, 0, distance);
      
      // Calculate final camera position
      const finalPos = targetPos.clone().add(offset);

      // Animate camera move with GSAP
      gsap.to(camera.position, {
        duration: 1,
        x: finalPos.x,
        y: finalPos.y,
        z: finalPos.z,
        ease: "power2.inOut",
        onUpdate: () => {
          camera.lookAt(targetPos);
          controls.target.copy(targetPos);
        },
        onComplete: () => {
          controls.enabled = true;
          controls.update();
        }
      });

      // Also animate controls target
      gsap.to(controls.target, {
        duration: 1,
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        ease: "power2.inOut"
      });
    }
  }
}


function getElementPath(element) {
  const path = [];
  let current = element;
  
  while (current) {
    const nameElement = current.querySelector('.file-name span');
    if (nameElement) {
      path.unshift(nameElement.textContent);
    }
    current = current.closest('li').parentElement?.closest('li');
  }
  
  return path.join('/');
}




  function createFolderElement(name) {
    const li = document.createElement("li");
    
    // Create the content wrapper
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "content-wrapper";
    
    // Create folder name section
    const folderName = document.createElement("div");
    folderName.className = "file-name";
    folderName.innerHTML = `
      <i class="fa fa-folder"></i>
      <span>${name}</span>
    `;
    
    // Create folder details section
    const folderDetails = document.createElement("div");
    folderDetails.className = "file-details";
    
    const folderType = document.createElement("span");
    folderType.className = "file-size";
    folderType.textContent = "folder";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    
    folderDetails.appendChild(folderType);
    folderDetails.appendChild(checkbox);
    
    contentWrapper.appendChild(folderName);
    contentWrapper.appendChild(folderDetails);
    
    // Create container for nested items
    const ul = document.createElement("ul");
    
    li.appendChild(contentWrapper);
    li.appendChild(ul);

    addRowInteractions()
    
    const icon = folderName.querySelector("i");
    
    // Toggle folder open/close
    icon.addEventListener("click", () => {
      li.classList.toggle("open");
      icon.classList.toggle("fa-folder");
      icon.classList.toggle("fa-folder-open");
    });
    
    // Handle checkbox changes for folder
    checkbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const childCheckboxes = li.querySelectorAll("ul input[type='checkbox']");
      childCheckboxes.forEach(childBox => {
        childBox.checked = isChecked;
      });
      updateParentCheckbox(li);
    });
    
    return li;
  }
  
  function updateParentCheckbox(element) {
    const parentLi = element.closest("li").parentElement?.closest("li");
    if (!parentLi) return;
    
    // Update selector to match your DOM structure
    const parentCheckbox = parentLi.querySelector(".file-details input[type='checkbox']");
    if (!parentCheckbox) return;
    
    // Update sibling selector to match your DOM structure
    const siblingCheckboxes = parentLi.querySelectorAll("ul > li .file-details input[type='checkbox']");
    const allChecked = Array.from(siblingCheckboxes).every(cb => cb.checked);
    const anyChecked = Array.from(siblingCheckboxes).some(cb => cb.checked);
    
    parentCheckbox.checked = allChecked;
    parentCheckbox.indeterminate = !allChecked && anyChecked;
    
    // Recursively update parent folders
    updateParentCheckbox(parentLi);
  }
  


  export function updateFileTreeUI() {
    const fileSystem = getFileSystem();
    const snapshot = fileSystem.getSnapshot();

    console.log("updateFileTreeUI", snapshot)
    
    if (!snapshot || !fileTree) return;
    
    fileTree.innerHTML = "";
    const dirMap = new Map(snapshot.directories.map((dir) => [dir.id, dir]));
    const rootDir = createFolderElement("Root");
    fileTree.appendChild(rootDir);
  // Track which files have been processed in directories
  const processedFiles = new Set();

     snapshot.directories.forEach((dir) => {
      if (dir.id !== "0") {
        const dirElement = createFolderElement(dir.name);
        const parentDir = dirMap.get(dir.parentId) || rootDir;
        parentDir.querySelector("ul").appendChild(dirElement);
  
        // Add files to directory
        dir.fileIds.forEach((fileId) => {
          const file = snapshot.files.find((f) => f.id === fileId);
          if (file) {
               // Add file to processed set
          processedFiles.add(file.id);
          
            const fileElement = document.createElement("li");
            const iconClass = getFileIcon(file.name);
            
            // Create content wrapper
            const contentWrapper = document.createElement("div");
            contentWrapper.className = "content-wrapper";
            contentWrapper.innerHTML = `
              <i class="fa ${iconClass}"></i>
              ${file.name}
              <span>- ${formatFileSize(file.size)}</span>
            `;
            
            // Create checkbox wrapper
            const checkboxWrapper = document.createElement("div");
            checkboxWrapper.className = "checkbox-wrapper";
            
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = true;
            checkbox.dataset.fileId = file.id;
            
            checkbox.addEventListener("change", (e) => {
              const isChecked = e.target.checked;
              const fileId = e.target.dataset.fileId;
              
              // Update metadata
              if (window.fileMetadata.has(fileId)) {
                const metadata = window.fileMetadata.get(fileId);
                metadata.isSelected = isChecked;
                window.fileMetadata.set(fileId, metadata);
              }
              
              // Dispatch event for bloom update
              window.dispatchEvent(new CustomEvent('checkboxStateChanged', {
                detail: {
                  fileId: fileId,
                  isSelected: isChecked
                }
              }));
              
              updateParentCheckbox(fileElement);
            });
            
            checkboxWrapper.appendChild(checkbox);
            
            fileElement.appendChild(contentWrapper);
            fileElement.appendChild(checkboxWrapper);
            
            dirElement.querySelector("ul").appendChild(fileElement);
          }
        });
      }
    });
  
    snapshot.files.forEach((file) => {
      if (!processedFiles.has(file.id)) {
      const fileElement = document.createElement("li");
      const iconClass = getFileIcon(file.name);
      
      // Create the content wrapper
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "content-wrapper";
      
      // Create file name section
      const fileName = document.createElement("div");
      fileName.className = "file-name";
      fileName.innerHTML = `
        <i class="fa ${iconClass}"></i>
        <span>${file.name}</span>
      `;
      
      // Create file details section
      const fileDetails = document.createElement("div");
      fileDetails.className = "file-details";
      
      const fileSize = document.createElement("span");
      fileSize.className = "file-size";
      fileSize.textContent = formatFileSize(file.size);
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = window.fileMetadata.get(file.id)?.isSelected ?? true;
      checkbox.dataset.fileId = file.id;
      
      checkbox.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        const fileId = e.target.dataset.fileId;
        
        // Update metadata
        if (window.fileMetadata.has(fileId)) {
          const metadata = window.fileMetadata.get(fileId);
          metadata.isSelected = isChecked;
          window.fileMetadata.set(fileId, metadata);
        }
        
        // Dispatch event for bloom update
        window.dispatchEvent(new CustomEvent('checkboxStateChanged', {
          detail: {
            fileId: fileId,
            isSelected: isChecked
          }
        }));
        
        updateParentCheckbox(fileElement);
      });
      
      fileDetails.appendChild(fileSize);
      fileDetails.appendChild(checkbox);
      
      contentWrapper.appendChild(fileName);
      contentWrapper.appendChild(fileDetails);
      fileElement.appendChild(contentWrapper);
      
      rootDir.querySelector("ul").appendChild(fileElement);
    }
    });
    // Process directories
   
    addRowInteractions();
  }
  
  // Helper function to get all selected file IDs
  export function getSelectedFileIds() {
    const checkedBoxes = document.querySelectorAll('.tree input[type="checkbox"]:checked[data-file-id]');
    return Array.from(checkedBoxes).map(checkbox => checkbox.dataset.fileId);
  }

// export function refreshFileTree() {
  
//   const fileSystem = getFileSystem();
//   fileSystem.onReady(() => {
//     updateFileTreeUI();
//   });
// }
export function refreshFileTree() {
  const fileSystem = getFileSystem();
  fileSystem.onReady(async () => {
      await fileSystem.refreshSnapshot(); // Add this line
      updateFileTreeUI();
  });
}

// Add event listeners for state synchronization
window.addEventListener('bloomStateChanged', (event) => {
  const { fileId, isSelected } = event.detail;

  
  const checkbox = document.querySelector(`input[type="checkbox"][data-file-id="${fileId}"]`);
  if (checkbox) {
    checkbox.checked = isSelected;
  }
});


window.addEventListener('updateFileTree', () => {
  refreshFileTree();
});

// Add this with the other event listeners
window.addEventListener('fileDeleted', (event) => {
  const { fileId } = event.detail;
  
  // Remove the file element from the tree
  const fileElement = document.querySelector(`li input[data-file-id="${fileId}"]`)?.closest('li');
  if (fileElement) {
    fileElement.remove();
  }
  
  // Update any parent folder checkboxes if needed
  const parentFolder = fileElement?.closest('.folder');
  if (parentFolder) {
    updateParentCheckbox(parentFolder);
  }
  
  // Refresh the file tree UI
  refreshFileTree();
});

export async function compressData(data, isText = false) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/compress_worker.js', import.meta.url));
    
    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.compressedData);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };
    
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    
    worker.postMessage({
      action: 'compress',
      data: data,
      isText: isText
    });
  });
}

export async function decompressData(data, isText = false) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/compress_worker.js', import.meta.url));
    
    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.decompressedData);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };
    
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    
    worker.postMessage({
      action: 'decompress',
      data: data,
      isText: isText
    });
  });
}