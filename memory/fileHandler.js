
// import fileStore from './stores/fileStore';
// import userActionStore from './stores/userActionStore';
import {generateUniqueId} from '../utils/utils';
import {getFileSystem} from "./collaboration/file_colab"
// import embeddingWorker from '../ai/embeddings.js';
// import * as vectorDBGateway from '../memory/vectorDB/vectorDbGateway'
import {orchestrateTextProcessing} from "../ai/text_orchestration.js"


const fileTree = document.getElementById('fileTree');
const processingQueue = [];
let isProcessing = false;

async function processFile(fileEntry, id) {

    console.log("i am processing File", fileEntry)
    return new Promise((resolve, reject) => {
        fileEntry.file(async file => {
            try {
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
                };

                // Add file to file system
                await fileSystem.addOrUpdateItem(fileMetadata, 'file');
                addFileToTree(file);

                // Generate embeddings and store in VectorDB
                let content;
                if (file.type === 'application/pdf') {
                    content = await file.arrayBuffer();
                } else {
                    content = await file.text();
                }

                // const embeddingResult = await vectorDBGateway.quickStart({
                //     text: content,
                //     fileId: id,
                //     fileName: file.name,
                //     fileType: file.type
                // });
                // Update file metadata with VectorDB key
                // fileMetadata.vectorDbKey = embeddingResult[0].key;
                orchestrateTextProcessing(content, file, id)
                await fileSystem.addOrUpdateItem(fileMetadata, 'file');

                // console.log(`Embeddings added to file ${id}`);
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
        const id = uuids[i]
        return processFile(file, id);
    });

    try {
        await Promise.all(processPromises);
        console.log('All files processed successfully');
        refreshFileTree();
    } catch (error) {
        console.error('Error processing files:', error);
    }
}

// Modify handleFileDrop to use processFiles
export function handleFileDrop(event) {
    event.preventDefault();
    const items = event.dataTransfer.items;
    const files = [];
    const uuids = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        const uuid = generateUniqueId();

        if (item.isFile) {
            files.push(item);
            uuids.push(uuid);
        } else if (item.isDirectory) {
            queueItemForProcessing(() => processDirectory(item, uuid));
            uuids.push(uuid);
        }
    }

    if (files.length > 0) {
        processFiles(files, uuids);
    }

    if (!isProcessing) {
        processQueue();
    }

    return uuids;
}

// ... [rest of the code remains the same]

// export function handleFileDrop(event) {
//     event.preventDefault();
//     const items = event.dataTransfer.items;
    
//     // const mousePosition = userActionStore.getMousePosition(userId);
//     const uuids = []
//     for (let i = 0; i < items.length; i++) {
//         const item = items[i].webkitGetAsEntry();
//         const uuid = generateUniqueId();


//         if (item.isFile) {
//             queueItemForProcessing(() => processFile(item, uuid));
//         } else if (item.isDirectory) {
//             queueItemForProcessing(() => processDirectory(item, uuid));
//         }
//         uuids.push(uuid);
//     }
//     if (!isProcessing) {
//         processQueue();
//     }

//     return uuids
// }



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


// function processFile(fileEntry, id) {
//     return new Promise((resolve, reject) => {
//         fileEntry.file(file => {
//             const fileSystem = getFileSystem();
//             const fileMetadata = {
//                 id,
//                 name: file.name,
//                 size: file.size,
//                 type: file.type,
//                 lastModified: file.lastModified,
//                 version: 1,
//                 versionNonce: Math.floor(Math.random() * 1000000),
//                 isDeleted: false,
//                 file: file
//                 // Add any other necessary fields
//             };
//             fileSystem.addOrUpdateItem(fileMetadata, 'file').then(() => {
//                 addFileToTree(file);
//                 resolve();
//             }).catch(reject);
//         }, reject);
//     });
// }




// function processFile(fileEntry, id) {
//     return new Promise((resolve, reject) => {
//         fileEntry.file(file => {
//             const fileSystem = getFileSystem();
//             const fileMetadata = {
//                 id,
//                 name: file.name,
//                 size: file.size,
//                 type: file.type,
//                 lastModified: file.lastModified,
//                 version: 1,
//                 versionNonce: Math.floor(Math.random() * 1000000),
//                 isDeleted: false,
//                 file: file
//             };
//             fileSystem.addOrUpdateItem(fileMetadata, 'file')
//                 .then(() => {
//                     addFileToTree(file);
//                     // Start the embedding process without waiting for it to complete
//                     generateFileEmbeddings(file, id);
//                     resolve();
//                 })
//                 .catch(reject);
//         }, reject);
//     });
// }

// function generateFileEmbeddings(file, id) {
//     embeddingWorker.generateEmbeddings(file, id)
//         .then(embeddings => {
//             // Update file metadata with embeddings
//             const fileSystem = getFileSystem();
//             fileSystem.getItem(id, 'file').then(fileMetadata => {
//                 if (fileMetadata) {
//                     fileMetadata.embeddings = embeddings;
//                     return fileSystem.addOrUpdateItem(fileMetadata, 'file');
//                 }
//             }).then(() => {
//                 console.log(`Embeddings added to file ${id}`);
//                 // You can add any additional processing or UI updates here
//             }).catch(error => {
//                 console.error(`Error updating file ${id} with embeddings:`, error);
//             });
//         })
//         .catch(error => {
//             console.error(`Error generating embeddings for file ${id}:`, error);
//         });
// }

function processDirectory(directoryEntry, id) {
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