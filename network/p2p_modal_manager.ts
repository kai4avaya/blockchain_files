import {p2pSync} from './peer2peer_simple'
// Create a modal manager to handle P2P modal
class P2PModalManager {
  private modal: HTMLElement | null = null;
  private userIdInput: HTMLInputElement | null = null;
  private peerIdInput: HTMLInputElement | null = null;
  private connectButton: HTMLButtonElement | null = null;
  private statusDiv: HTMLDivElement | null = null;
  
  constructor() {
    this.createModal();
    this.setupEventListeners();
  }

  private createModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('p2pModal')) {
      const modalHTML = `
        <div id="p2pModal" class="p2p-modal">
          <div class="p2p-modal-content">
            <input 
              type="text" 
              class="p2p_peer_input" 
              id="userIdInput" 
              placeholder="Enter your user ID"
            >
            <input 
              type="text" 
              class="p2p_peer_input" 
              id="peerIdInput" 
              placeholder="Enter peer ID to connect. Use commas to connect to multiple peers."
            >
            <button id="connectButton">
              Connect
              <span class="tooltip">Click to connect to the peer</span>
            </button>
            <div id="status"></div>
          </div>
        </div>
      `;

      const modalStyles = `
        <style>
          .p2p-modal {
            position: fixed;
            left: 5rem;
            background-color: white;
            padding: 1.25rem;
            box-shadow: 0.125rem 0 0.3125rem rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 15.625rem;
            transition: opacity 0.3s ease-out, transform 0.3s ease-out;
            transform: translateY(1.25rem);
            opacity: 0;
            z-index: 2000;
            pointer-events: auto !important;
          }

          .p2p-modal.active {
            transform: translateY(0);
            opacity: 1;
            pointer-events: auto !important;
          }

          .p2p_peer_input {
            width: 90%;
            padding: 8px;
            margin-bottom: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            pointer-events: auto !important;
          }

          #connectButton {
            width: 90%;
            padding: 8px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            pointer-events: auto !important;
          }

          #connectButton:hover {
            background-color: #0056b3;
          }
        </style>
      `;

      // Add styles to document
      document.head.insertAdjacentHTML('beforeend', modalStyles);

      // Add modal to document
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Get references to elements
    this.modal = document.getElementById('p2pModal');
    this.userIdInput = document.getElementById('userIdInput') as HTMLInputElement;
    this.peerIdInput = document.getElementById('peerIdInput') as HTMLInputElement;
    this.connectButton = document.getElementById('connectButton') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;
  }

  private setupEventListeners() {
    if (!this.connectButton || !this.userIdInput || !this.peerIdInput) {
      console.error('Required P2P elements not found');
      return;
    }

    // Add click listener with logging
    this.connectButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Connect button clicked');
      
      const peerId = this.peerIdInput?.value.trim();
      if (peerId) {
        console.log('Attempting to connect to peer:', peerId);
        p2pSync.connectToSpecificPeer(peerId);
        this.updateStatus(`Attempting to connect to peer: ${peerId}`);
      } else {
        this.updateStatus('Please enter a peer ID to connect.');
      }
    });

    // Add user ID change listener
    this.userIdInput.addEventListener('change', () => {
      const userId = this.userIdInput?.value.trim();
      if (userId) {
        p2pSync.initialize(userId);
        this.updateStatus(`Initializing with user ID: ${userId}`);
      }
    });

    // Load stored peer ID if exists
    const storedPeerId = localStorage.getItem('myPeerId');
    if (storedPeerId && this.userIdInput) {
      this.userIdInput.value = storedPeerId;
      p2pSync.initialize(storedPeerId);
    }
  }

  public show(anchorElement: HTMLElement) {
    if (!this.modal) return;
    
    const rect = anchorElement.getBoundingClientRect();
    this.modal.style.top = `${rect.top - 15}px`;
    this.modal.classList.add('active');
  }

  public hide() {
    this.modal?.classList.remove('active');
  }

  public updateStatus(message: string) {
    console.log('P2P Status:', message);
    if (this.statusDiv) {
      this.statusDiv.textContent = message;
    }
  }
}

// Create and export the modal manager instance
const p2pModalManager = new P2PModalManager();
export { p2pModalManager };