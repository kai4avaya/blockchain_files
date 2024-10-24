// // import fileStore from './stores/fileStore';
// // import userActionStore from './stores/userActionStore';
// import { generateUniqueId } from "../utils/utils";
// import { getFileSystem } from "./collaboration/file_colab";
// // import embeddingWorker from '../ai/embeddings.js';
// // import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
// import { orchestrateTextProcessing } from "../ai/text_orchestration.js";
// import pako from "pako";

// // Compress the ArrayBuffer
// function compressData(arrayBuffer) {
//   return pako.deflate(new Uint8Array(arrayBuffer));
// }

// // Decompress the data when retrieving
// function decompressData(uint8Array) {
//   return pako.inflate(uint8Array);
// }

// const fileTree = document.getElementById("fileTree");
// const processingQueue = [];
// let isProcessing = false;

// async function processFile(fileEntry, id) {
//   return new Promise((resolve, reject) => {
//     fileEntry.file(async (file) => {
//       try {
//         const fileSystem = getFileSystem();

//         const contentArrayBuffer = await readFileContent(file);

//         // Compress the content if desired
//         const compressedContent = compressData(contentArrayBuffer);
//         const fileMetadata = {
//           id,
//           name: file.name,
//           size: file.size,
//           type: file.type,
//           lastModified: file.lastModified,
//           version: 1,
//           versionNonce: Math.floor(Math.random() * 1000000),
//           isDeleted: false,
//           file: compressedContent.buffer,
//           // file: file
//         };

//         // Add file to file system
//         await fileSystem.addOrUpdateItem(fileMetadata, "file");
//         addFileToTree(file);

//         // Generate embeddings and store in VectorDB
//         let content;
//         if (file.type === "application/pdf") {
//           content = await file.arrayBuffer();
//         } else {
//           content = await file.text();
//         }

 
//         orchestrateTextProcessing(content, file, id);
//         await fileSystem.addOrUpdateItem(fileMetadata, "file");

//         // console.log(`Embeddings added to file ${id}`);
//         resolve();
//       } catch (error) {
//         console.error(`Error processing file ${id}:`, error);
//         reject(error);
//       }
//     }, reject);
//   });
// }

// async function processFiles(files, uuids) {
//   const processPromises = files.map((file, i) => {
//     const id = uuids[i];
//     return processFile(file, id);
//   });

//   try {
//     await Promise.all(processPromises);
//     refreshFileTree();
//   } catch (error) {
//     console.error("Error processing files:", error);
//   }
// }

// function readFileContent(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => resolve(reader.result);
//     reader.onerror = () => reject(reader.error);
//     reader.readAsArrayBuffer(file);
//   });
// }


// // if I need to retrieve a file from buffer
// export async function retrieveFile(id) {
//   const fileSystem = getFileSystem();
//   const fileMetadata = await fileSystem.getItem(id, "file");
//   if (fileMetadata) {
//     const compressedContent = new Uint8Array(fileMetadata.content);
//     const decompressedContent = decompressData(compressedContent);

//     // Create a Blob from the decompressed content
//     const blob = new Blob([decompressedContent], { type: fileMetadata.type });

//     // Optionally, reconstruct a File object
//     const restoredFile = new File([blob], fileMetadata.name, {
//       type: fileMetadata.type,
//       lastModified: fileMetadata.lastModified,
//     });

//     return restoredFile; // or return blob if File constructor isn't supported
//   } else {
//     throw new Error(`File with id ${id} not found`);
//   }
// }


// export function handleFileDrop(event) {
//   event.preventDefault();
//   const items = event.dataTransfer.items;
//   const files = [];
//   const fileIds = [];
//   const fileNames = [];
//   const fileEntries = [];

//   for (let i = 0; i < items.length; i++) {
//     const item = items[i].webkitGetAsEntry();
//     const uuid = generateUniqueId();

//     if (item) {
//       fileIds.push(uuid);
//       fileNames.push(item.name);
//       fileEntries.push(item);

//       if (item.isFile) {
//         files.push(item);
//       } else if (item.isDirectory) {
//         queueItemForProcessing(() => processDirectory(item, uuid));
//       }
//     }
//   }

//   if (files.length > 0) {
//     processFiles(files, fileIds);
//   }

//   if (!isProcessing) {
//     processQueue();
//   }

//   // Return an object with uuids and fileNames, ensuring correspondence
//   return { fileIds, fileNames, fileEntries };
// }

// function queueItemForProcessing(processingFunction) {
//   processingQueue.push(processingFunction);
// }

// async function processQueue() {
//   if (isProcessing || processingQueue.length === 0) return;

//   isProcessing = true;
//   while (processingQueue.length > 0) {
//     const processFunction = processingQueue.shift();
//     try {
//       await processFunction();
//     } catch (error) {
//       console.error("Error processing item:", error);
//     }
//   }
//   isProcessing = false;
// }

// function processDirectory(directoryEntry, id) {
//   return new Promise((resolve, reject) => {
//     const dirReader = directoryEntry.createReader();
//     const directoryMetadata = {
//       id,
//       name: directoryEntry.name,
//       fileIds: [],
//       tags: [],
//       summary: "",
//       lastModified: Date.now(),
//       version: 1,
//       versionNonce: Math.floor(Math.random() * 1000000),
//       isDeleted: false,
//     };

//     const readEntries = () => {
//       dirReader.readEntries(async (entries) => {
//         if (entries.length === 0) {
//           try {
//             const fileSystem = getFileSystem();
//             await fileSystem.addOrUpdateItem(directoryMetadata, "directory");
//             const folder = createFolderElement(directoryEntry.name);
//             fileTree.appendChild(folder);
//             resolve(folder);
//           } catch (error) {
//             reject(error);
//           }
//         } else {
//           for (const entry of entries) {
//             if (entry.isFile) {
//               const fileId = generateUniqueId();
//               queueItemForProcessing(() => processFile(entry, fileId));
//               directoryMetadata.fileIds.push(fileId);
//             } else if (entry.isDirectory) {
//               const subFolderId = generateUniqueId();
//               queueItemForProcessing(() =>
//                 processDirectory(entry, subFolderId)
//               );
//             }
//           }
//           readEntries();
//         }
//       }, reject);
//     };

//     readEntries();
//   });
// }

// function addFileToTree(file) {
//   const li = document.createElement("li");
//   li.innerHTML = `<i class="fa fa-file"></i> ${file.name} <span>- ${file.size}kb</span>`;
//   fileTree.appendChild(li);
// }

// function createFolderElement(name) {
//   const li = document.createElement("li");
//   li.innerHTML = `<i class="fa fa-folder-open"></i> ${name} <span>- folder</span><ul></ul>`;
//   li.querySelector("i").addEventListener("click", () => {
//     li.classList.toggle("open");
//   });
//   return li;
// }

// // New function to update the file tree UI
// function updateFileTreeUI() {
//   const fileSystem = getFileSystem();
//   const snapshot = fileSystem.getSnapshot();
//   fileTree.innerHTML = ""; // Clear current tree

//   // Create a map of directories for easy lookup
//   const dirMap = new Map(snapshot.directories.map((dir) => [dir.id, dir]));

//   // Create a root directory element
//   const rootDir = createFolderElement("Root");
//   fileTree.appendChild(rootDir);

//   // Process files
//   snapshot.files.forEach((file) => {
//     const fileElement = document.createElement("li");
//     fileElement.innerHTML = `<i class="fa fa-file"></i> ${file.name} <span>- ${file.size}kb</span>`;
//     rootDir.querySelector("ul").appendChild(fileElement);
//   });

//   // Process directories
//   snapshot.directories.forEach((dir) => {
//     if (dir.id !== "0") {
//       // Assuming '0' is the root directory
//       const dirElement = createFolderElement(dir.name);
//       const parentDir = dirMap.get(dir.parentId) || rootDir;
//       parentDir.querySelector("ul").appendChild(dirElement);

//       // Add files to this directory
//       dir.fileIds.forEach((fileId) => {
//         const file = snapshot.files.find((f) => f.id === fileId);
//         if (file) {
//           const fileElement = document.createElement("li");
//           fileElement.innerHTML = `<i class="fa fa-file"></i> ${file.name} <span>- ${file.size}kb</span>`;
//           dirElement.querySelector("ul").appendChild(fileElement);
//         }
//       });
//     }
//   });
// }

// // Call this function after processing files or when you need to refresh the UI
// export function refreshFileTree() {
//   const fileSystem = getFileSystem();
//   fileSystem.onReady(() => {
//     updateFileTreeUI();
//   });
// }


import { generateUniqueId } from "../utils/utils";
import { getFileSystem } from "./collaboration/file_colab";
import { orchestrateTextProcessing } from "../ai/text_orchestration.js";
import pako from "pako";

// Compress the ArrayBuffer
function compressData(arrayBuffer) {
  return pako.deflate(new Uint8Array(arrayBuffer));
}

// Decompress the data when retrieving
function decompressData(uint8Array) {
  return pako.inflate(uint8Array);
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

async function processFile(fileEntry, id) {
  return new Promise((resolve, reject) => {
    fileEntry.file(async (file) => {
      try {
        const fileSystem = getFileSystem();
        const contentArrayBuffer = await readFileContent(file);
        const compressedContent = compressData(contentArrayBuffer);
        
        const fileMetadata = {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          isDeleted: false,
          file: compressedContent.buffer,
        };

        await fileSystem.addOrUpdateItem(fileMetadata, "file");
        addFileToTree(file);

        let content;
        if (file.type === "application/pdf") {
          content = await file.arrayBuffer();
        } else {
          content = await file.text();
        }

        orchestrateTextProcessing(content, file, id);
        await fileSystem.addOrUpdateItem(fileMetadata, "file");

        resolve();
      } catch (error) {
        console.error(`Error processing file ${id}:`, error);
        reject(error);
      }
    }, reject);
  });
}

async function processFiles(files, uuids) {
  const processPromises = files.map((file, i) => {
    const id = uuids[i];
    return processFile(file, id);
  });

  try {
    await Promise.all(processPromises);
    refreshFileTree();
  } catch (error) {
    console.error("Error processing files:", error);
  }
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function retrieveFile(id) {
  const fileSystem = getFileSystem();
  const fileMetadata = await fileSystem.getItem(id, "file");
  if (fileMetadata) {
    const compressedContent = new Uint8Array(fileMetadata.content);
    const decompressedContent = decompressData(compressedContent);
    const blob = new Blob([decompressedContent], { type: fileMetadata.type });
    const restoredFile = new File([blob], fileMetadata.name, {
      type: fileMetadata.type,
      lastModified: fileMetadata.lastModified,
    });
    return restoredFile;
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

  for (let i = 0; i < items.length; i++) {
    const item = items[i].webkitGetAsEntry();
    const uuid = generateUniqueId();

    if (item) {
      fileIds.push(uuid);
      fileNames.push(item.name);
      fileEntries.push(item);

      if (item.isFile) {
        files.push(item);
      } else if (item.isDirectory) {
        queueItemForProcessing(() => processDirectory(item, uuid));
      }
    }
  }

  if (files.length > 0) {
    processFiles(files, fileIds);
  }

  if (!isProcessing) {
    processQueue();
  }

  return { fileIds, fileNames, fileEntries };
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
    checkbox.checked = true;
    checkbox.dataset.fileId = file.id;
    
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


function handleRowClick(event) {
  // Prevent triggering if clicking checkbox
  if (event.target.type === 'checkbox') return;

  const row = event.currentTarget;
  const fileName = row.querySelector('.file-name span')?.textContent;
  const fileSize = row.querySelector('.file-size')?.textContent;
  const fileId = row.querySelector('input[type="checkbox"]')?.dataset.fileId;
  const isFolder = row.querySelector('.fa-folder, .fa-folder-open') !== null;

  // Toggle selected state
  document.querySelectorAll('.content-wrapper.selected').forEach(el => {
    el.classList.remove('selected');
  });
  row.classList.add('selected');

  // Log file/folder info
  const metadata = {
    type: isFolder ? 'folder' : 'file',
    name: fileName,
    size: fileSize,
    id: fileId,
    path: getElementPath(row)
  };

  console.log('Selected item metadata:', metadata);
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
  
  // New function to update parent folder checkbox state
  function updateParentCheckbox(element) {
    const parentLi = element.closest("li").parentElement?.closest("li");
    if (!parentLi) return;
    
    const parentCheckbox = parentLi.querySelector("> .checkbox-wrapper input[type='checkbox']");
    if (!parentCheckbox) return;
    
    const siblingCheckboxes = parentLi.querySelectorAll("ul > li > .checkbox-wrapper input[type='checkbox']");
    const allChecked = Array.from(siblingCheckboxes).every(cb => cb.checked);
    const anyChecked = Array.from(siblingCheckboxes).some(cb => cb.checked);
    
    parentCheckbox.checked = allChecked;
    parentCheckbox.indeterminate = !allChecked && anyChecked;
    
    // Recursively update parent folders
    updateParentCheckbox(parentLi);
  }
  
  function updateFileTreeUI() {
    const fileSystem = getFileSystem();
    const snapshot = fileSystem.getSnapshot();
    fileTree.innerHTML = "";
  
    const dirMap = new Map(snapshot.directories.map((dir) => [dir.id, dir]));
    const rootDir = createFolderElement("Root");
    fileTree.appendChild(rootDir);
  
    snapshot.files.forEach((file) => {
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
      checkbox.checked = true;
      checkbox.dataset.fileId = file.id;
      
      checkbox.addEventListener("change", () => {
        updateParentCheckbox(fileElement);
      });
      
      fileDetails.appendChild(fileSize);
      fileDetails.appendChild(checkbox);
      
      contentWrapper.appendChild(fileName);
      contentWrapper.appendChild(fileDetails);
      fileElement.appendChild(contentWrapper);
      
      rootDir.querySelector("ul").appendChild(fileElement);
    });
    // Process directories
    snapshot.directories.forEach((dir) => {
      if (dir.id !== "0") {
        const dirElement = createFolderElement(dir.name);
        const parentDir = dirMap.get(dir.parentId) || rootDir;
        parentDir.querySelector("ul").appendChild(dirElement);
  
        // Add files to directory
        dir.fileIds.forEach((fileId) => {
          const file = snapshot.files.find((f) => f.id === fileId);
          if (file) {
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
            
            checkbox.addEventListener("change", () => {
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
    addRowInteractions();
  }
  
  // Helper function to get all selected file IDs
  export function getSelectedFileIds() {
    const checkedBoxes = document.querySelectorAll('.tree input[type="checkbox"]:checked[data-file-id]');
    return Array.from(checkedBoxes).map(checkbox => checkbox.dataset.fileId);
  }

export function refreshFileTree() {
  const fileSystem = getFileSystem();
  fileSystem.onReady(() => {
    updateFileTreeUI();
  });
}