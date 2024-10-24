// import { AffineSchemas } from '@blocksuite/blocks';
// import { AffineEditorContainer } from '@blocksuite/presets';
// import { Schema, DocCollection, Text } from '@blocksuite/store';
// import { IndexeddbPersistence } from 'y-indexeddb';

// // Import the CSS as a string
// import affineCSS from '@blocksuite/presets/themes/affine.css?inline';

// let editor;

// function loadCSS(cssString) {
//   const style = document.createElement('style');
//   style.textContent = cssString;
//   document.head.appendChild(style);
// }

// export function initializeBlockSuiteEditor() {
//   // Load the CSS
//   loadCSS(affineCSS);

//   const schema = new Schema().register(AffineSchemas);
//   const collection = new DocCollection({ schema });
//   collection.meta.initialize();
//   const doc = collection.createDoc();
//   editor = new AffineEditorContainer();
//   editor.doc = doc;

//   const editorContainer = document.getElementById('editor-container');
//   if (editorContainer) {
//     editorContainer.innerHTML = ''; // Clear existing content
//     editorContainer.appendChild(editor);
//   } else {
//     console.error("Editor container not found");
//   }

//   new IndexeddbPersistence('blocksuite-demo', doc.spaceDoc);
//   doc.load(() => {
//     const pageBlockId = doc.addBlock('affine:page', {
//       title: new Text('Welcome to BlockSuite'),
//     });
//     doc.addBlock('affine:surface', {}, pageBlockId);
//     const noteId = doc.addBlock('affine:note', {}, pageBlockId);
//     doc.addBlock(
//       'affine:paragraph',
//       { text: new Text('This is your BlockSuite editor. Start typing here!') },
//       noteId
//     );
//   });
// }

// export function getBlockSuiteEditor() {
//   return editor;
// }
import { AffineSchemas } from "@blocksuite/blocks";
import { AffineEditorContainer } from "@blocksuite/presets";
import { Schema, DocCollection, Text } from "@blocksuite/store";
import { IndexeddbPersistence } from "y-indexeddb";
import { askAICommand } from "./askAi.js";

// Import the CSS as a string
import affineCSS from "@blocksuite/presets/themes/affine.css?inline";

let editor;

function loadCSS(cssString) {
  const style = document.createElement('style');
  style.textContent = cssString;
  document.head.appendChild(style);
}

export async function initializeBlockSuiteEditor() {
  console.log('Starting BlockSuite editor initialization');
  try {
    loadCSS(affineCSS);
    console.log('CSS loaded');

    const schema = new Schema().register(AffineSchemas);
    console.log('Schema created');

    const collection = new DocCollection({ schema });
    console.log('DocCollection created');

    await collection.meta.initialize();
    console.log('Collection meta initialized');

    const doc = collection.createDoc();
    console.log('Doc created');

    editor = new AffineEditorContainer();
    console.log('AffineEditorContainer created');

    editor.doc = doc;
    console.log('Doc assigned to editor');

    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
      editorContainer.innerHTML = ''; // Clear existing content
      editorContainer.appendChild(editor);
      console.log('Editor appended to container');
    } else {
      throw new Error("Editor container not found");
    }

    // Wait for the editor to be mounted and ready
    await new Promise((resolve) => {
      editor.addEventListener('ready', () => {
        console.log('Editor ready event fired');
        resolve();
      }, { once: true });
    });
    console.log('Editor ready');

    const persistence = new IndexeddbPersistence('blocksuite-demo', doc.spaceDoc);
    console.log('IndexeddbPersistence created');
    
    // Wait for the persistence to be synced
    await new Promise((resolve) => {
      persistence.on('synced', () => {
        console.log('Persistence synced event fired');
        resolve();
      });
    });
    console.log('Persistence sync process completed');

    // Now that everything is set up, we can add initial blocks and register commands
    const pageBlockId = doc.addBlock('affine:page', {
      title: new Text('Welcome to BlockSuite'),
    });
    doc.addBlock('affine:surface', {}, pageBlockId);
    const noteId = doc.addBlock('affine:note', {}, pageBlockId);
    doc.addBlock(
      'affine:paragraph',
      { text: new Text('This is your BlockSuite editor. Start typing here!') },
      noteId
    );
    console.log('Initial blocks added');

    // Register the askAI command
    if (editor.commands) {
      editor.commands.add('askAI', askAICommand);
      console.log('askAI command registered');

      // Add the askAI command to the '/' menu
      editor.commands.addBlockType('askAI', {
        name: 'Ask AI',
        icon: '🤖',
        category: 'AI',
        command: askAICommand,
      });
      console.log('askAI command added to slash menu');
    } else {
      console.warn('Commands API not available');
    }

    // Add a keydown event listener to trigger the command with '~'
    editor.addEventListener('keydown', (event) => {
      if (event.key === '~' && !event.isComposing) {
        event.preventDefault();
        if (editor.commands) {
          editor.commands.execute('askAI');
        } else {
          console.warn('Commands API not available for keydown event');
        }
      }
    });
    console.log('Keydown event listener added');

    console.log('BlockSuite editor initialization completed successfully');
    return editor;
  } catch (error) {
    console.error('Error initializing BlockSuite editor:', error);
    throw error;
  }
}

export function getBlockSuiteEditor() {
  return editor;
}