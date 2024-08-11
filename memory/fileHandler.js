
// import { addNode } from '../graph.js';
import fileStore from './stores/fileStore';
import userActionStore from './stores/userActionStore';
import {generateUniqueId} from '../utils/utils';

const fileTree = document.getElementById('fileTree');
const userId = 'defaultUser'; // Placeholder for user identification

// Handle file drops
export async function handleFileDrop(event) {
    event.preventDefault();
    const items = event.dataTransfer.items;
    
    const mousePosition = userActionStore.getMousePosition(userId);
    const uuids = []
    for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        const uuid = generateUniqueId();


        if (item.isFile) {
            await processFile(item, mousePosition, uuid);
        } else if (item.isDirectory) {
            await processDirectory(item, mousePosition, uuid);
        }
        uuids.push(uuid);
    }
    return uuids
}

// Process individual file
async function processFile(fileEntry, mousePosition, id) {
    // HERE I WILL NEED TO DO CHECKS IN CLOUD ETC... before we can OK FILE drop

    fileEntry.file(async file => {
        console.log(`Processing file: ${file.name}`);
        await fileStore.addFile({ id, name: file.name, size: file.size }, file); // Pass actual File object
        // addNode(id, file, mousePosition.x, mousePosition.y);
        addFileToTree(file);
    });
}

// Process directory
async function processDirectory(directoryEntry, mousePosition, id) {
    const dirReader = directoryEntry.createReader();
    const folder = createFolderElement(directoryEntry.name);

    const folderObject = { id: id, name: directoryEntry.name, entries: [] };

    dirReader.readEntries(async entries => {
        for (const entry of entries) {
            if (entry.isFile) {
                await processFile(entry, mousePosition);
            } else if (entry.isDirectory) {
                const subFolder = await processDirectory(entry, mousePosition);
                folder.querySelector('ul').appendChild(subFolder);

                // Add subfolder to the directory entries
                folderObject.entries.push(subFolder);
            }
        }
        fileTree.appendChild(folder);

        // Add directory to the MobX store
        await fileStore.addDirectory(folderObject);
    });

    return folder;
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
