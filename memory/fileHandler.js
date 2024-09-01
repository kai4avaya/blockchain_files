
// import fileStore from './stores/fileStore';
import userActionStore from './stores/userActionStore';
import {generateUniqueId} from '../utils/utils';
import {getFileSystem} from "./collaboration/file_colab"

const loginName = localStorage.getItem("login_block") || "no_login";

const fileTree = document.getElementById('fileTree');
const userId = loginName; // Placeholder for user identification
// Queue for processing files and directories
const processingQueue = [];
let isProcessing = false;
// Handle file drops
export function handleFileDrop(event) {
    event.preventDefault();
    const items = event.dataTransfer.items;
    
    const mousePosition = userActionStore.getMousePosition(userId);
    const uuids = []
    for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        const uuid = generateUniqueId();


        if (item.isFile) {
            queueItemForProcessing(() => processFile(item, mousePosition, uuid));
        } else if (item.isDirectory) {
            queueItemForProcessing(() => processDirectory(item, mousePosition, uuid));
        }
        uuids.push(uuid);
    }
    if (!isProcessing) {
        processQueue();
    }

    return uuids
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
    // updateFileTreeUI(); // Update UI after all items are processed
}


function processFile(fileEntry, mousePosition, id) {
    return new Promise((resolve, reject) => {
        fileEntry.file(file => {
            const fileSystem = getFileSystem();
            const fileMetadata = {
                id,
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                version: 1,
                versionNonce: Math.floor(Math.random() * 1000000),
                isDeleted: false,
                file: file
                // Add any other necessary fields
            };
            fileSystem.addOrUpdateItem(fileMetadata, 'file').then(() => {
                addFileToTree(file);
                resolve();
            }).catch(reject);
        }, reject);
    });
}

function processDirectory(directoryEntry, mousePosition, id) {
    return new Promise((resolve, reject) => {
        const dirReader = directoryEntry.createReader();
        const directoryMetadata = {
            id,
            name: directoryEntry.name,
            fileIds: [],
            tags: [],
            summary: '',
            lastModified: Date.now(),
            version: 1,
            versionNonce: Math.floor(Math.random() * 1000000),
            isDeleted: false,
        };

        const readEntries = () => {
            dirReader.readEntries(async entries => {
                if (entries.length === 0) {
                    try {
                        const fileSystem = getFileSystem();
                        await fileSystem.addOrUpdateItem(directoryMetadata, 'directory');
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
                            queueItemForProcessing(() => processFile(entry, mousePosition, fileId));
                            directoryMetadata.fileIds.push(fileId);
                        } else if (entry.isDirectory) {
                            const subFolderId = generateUniqueId();
                            queueItemForProcessing(() => processDirectory(entry, mousePosition, subFolderId));
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
    const li = document.createElement('li');
    li.innerHTML = `<i class="fa fa-file"></i> ${file.name} <span>- ${file.size}kb</span>`;
    fileTree.appendChild(li);
}

function createFolderElement(name) {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fa fa-folder-open"></i> ${name} <span>- folder</span><ul></ul>`;
    li.querySelector('i').addEventListener('click', () => {
        li.classList.toggle('open');
    });
    return li;
}


// New function to update the file tree UI
function updateFileTreeUI() {
    const fileSystem = getFileSystem();
    const snapshot = fileSystem.getSnapshot();
    fileTree.innerHTML = ''; // Clear current tree

    // Create a map of directories for easy lookup
    const dirMap = new Map(snapshot.directories.map(dir => [dir.id, dir]));

    // Create a root directory element
    const rootDir = createFolderElement('Root');
    fileTree.appendChild(rootDir);

    // Process files
    snapshot.files.forEach(file => {
        const fileElement = document.createElement('li');
        fileElement.innerHTML = `<i class="fa fa-file"></i> ${file.name} <span>- ${file.size}kb</span>`;
        rootDir.querySelector('ul').appendChild(fileElement);
    });

    // Process directories
    snapshot.directories.forEach(dir => {
        if (dir.id !== '0') { // Assuming '0' is the root directory
            const dirElement = createFolderElement(dir.name);
            const parentDir = dirMap.get(dir.parentId) || rootDir;
            parentDir.querySelector('ul').appendChild(dirElement);

            // Add files to this directory
            dir.fileIds.forEach(fileId => {
                const file = snapshot.files.find(f => f.id === fileId);
                if (file) {
                    const fileElement = document.createElement('li');
                    fileElement.innerHTML = `<i class="fa fa-file"></i> ${file.name} <span>- ${file.size}kb</span>`;
                    dirElement.querySelector('ul').appendChild(fileElement);
                }
            });
        }
    });
}

// Call this function after processing files or when you need to refresh the UI
export function refreshFileTree() {
    const fileSystem = getFileSystem();
    fileSystem.onReady(() => {
        updateFileTreeUI();
    });
}

// // You might want to call this after processQueue finishes
// async function processQueue() {
//     // ... existing code ...
//     isProcessing = false;
//     refreshFileTree(); // Update UI after all items are processed
// }