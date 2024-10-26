import { initializeMarkdownEditor, cleanup } from './markdownEditor';

export function createEditorModal() {
  const modalOverlay = document.createElement('div');
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = '0';
  modalOverlay.style.left = '0';
  modalOverlay.style.width = '100vw';
  modalOverlay.style.height = '100vh';
  modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modalOverlay.style.display = 'flex';
  modalOverlay.style.alignItems = 'center';
  modalOverlay.style.justifyContent = 'center';
  modalOverlay.style.zIndex = '1000';

  const modalContent = document.createElement('div');
  modalContent.style.width = '80%';
  modalContent.style.maxWidth = '800px';
  modalContent.style.backgroundColor = 'white';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '8px';
  modalContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  
  const closeButton = document.createElement('button');
  closeButton.innerText = 'Close';
  closeButton.style.float = 'right';
  closeButton.onclick = () => {
    cleanup();
    modalOverlay.remove();
  };
  modalContent.appendChild(closeButton);

  const editorContainer = document.createElement('div');
  editorContainer.id = 'editor-container';
  editorContainer.style.height = '400px';
  modalContent.appendChild(editorContainer);

  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  initializeMarkdownEditor('', 'default-room', editorContainer);
}

// Add click handler
document.getElementById('tests')?.addEventListener('click', createEditorModal);