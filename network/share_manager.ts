import { p2pSync } from './peer2peer_simple';
import { generateUniqueId } from '../utils/utils';
import QRCode from 'qrcode'; // You'll need to: npm install qrcode @types/qrcode

export class ShareManager {
    private static createCopyButton(): HTMLElement {
        const copyIcon = document.createElement('span');
        copyIcon.style.cursor = 'pointer';
        copyIcon.style.marginLeft = '10px';
        copyIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1em; height: 1em; vertical-align: middle;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
            </svg>
        `;
        return copyIcon;
    }

    private static showCopySuccess(copyIcon: HTMLElement): void {
        copyIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1em; height: 1em; vertical-align: middle; color: green;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        `;

        setTimeout(() => {
            copyIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1em; height: 1em; vertical-align: middle;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
            `;
        }, 1000);
    }

    public static generateShareLink(): string {
        const peerId = p2pSync.getCurrentPeerId();
        const uniqueCode = generateUniqueId(8); // Longer unique code for sharing
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?peerId=${peerId}&code=${uniqueCode}`;
    }

    public static async handleShareLinkClick(): Promise<void> {
        const shareLink = this.generateShareLink();
        const shareLinkDiv = document.createElement('div');
        shareLinkDiv.id = 'shareLink';
        shareLinkDiv.style.marginTop = '10px';
        shareLinkDiv.innerHTML = `
            <a href="${shareLink}" target="_blank">${shareLink}</a>
        `;

        const copyIcon = this.createCopyButton();
        copyIcon.addEventListener('click', () => {
            navigator.clipboard.writeText(shareLink).then(() => {
                this.showCopySuccess(copyIcon);
            });
        });

        shareLinkDiv.appendChild(copyIcon);
        
        // Replace existing or add new
        const existingDiv = document.getElementById('shareLink');
        if (existingDiv) {
            existingDiv.replaceWith(shareLinkDiv);
        } else {
            document.querySelector('.modal')?.appendChild(shareLinkDiv);
        }
    }

    public static async handleShareQRClick(): Promise<void> {
        const shareLink = this.generateShareLink();
        const qrDiv = document.createElement('div');
        qrDiv.id = 'shareQR';
        qrDiv.style.marginTop = '10px';
        qrDiv.style.textAlign = 'center';

        try {
            const qrDataUrl = await QRCode.toDataURL(shareLink);
            qrDiv.innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="max-width: 200px;">`;
            
            // Replace existing or add new
            const existingDiv = document.getElementById('shareQR');
            if (existingDiv) {
                existingDiv.replaceWith(qrDiv);
            } else {
                document.querySelector('.modal')?.appendChild(qrDiv);
            }
        } catch (err) {
            console.error('Error generating QR code:', err);
        }
    }

    public static handleIncomingShareLink(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedPeerId = urlParams.get('peerId');
        const shareCode = urlParams.get('code');

        if (sharedPeerId && shareCode) {
            // Generate a random peer ID for the new user
            const newPeerId = generateUniqueId(6);
            
            // Initialize p2pSync with the new peer ID
            if (!p2pSync.getCurrentPeerId()) {
                p2pSync.initialize(newPeerId);
                
                // Connect to the peer that shared the link
                setTimeout(() => {
                    p2pSync.connectToSpecificPeer(sharedPeerId);
                }, 1000); // Small delay to ensure initialization is complete
                
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }
}

// Add event listeners for share buttons
document.getElementById('shareLinkButton')?.addEventListener('click', () => {
    ShareManager.handleShareLinkClick();
});

document.getElementById('shareQRButton')?.addEventListener('click', () => {
    ShareManager.handleShareQRClick();
});

// Check for shared link parameters on page load
window.addEventListener('load', () => {
    ShareManager.handleIncomingShareLink();
}); 