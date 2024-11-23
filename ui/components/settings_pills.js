import { eventBus } from '../eventBus.js';

export class SettingsPills {
    constructor() {
        this.providers = new Map();
        this.loadFromLocalStorage();
        this.setupEventListeners();
        console.log('SettingsPills initialized');
    }

    setupEventListeners() {
        console.log('Setting up event listeners for SettingsPills');
        eventBus.addEventListener('addProvider', async (event) => {
            console.log('addProvider event received:', event.detail);
            const { url, apiKey } = event.detail;
            const { id, provider } = await this.addProvider(url, apiKey);
            this.renderPill(id, provider);
            this.saveToLocalStorage();
        });

        eventBus.addEventListener('removeProvider', (event) => {
            console.log('removeProvider event received:', event.detail);
            const { id } = event.detail;
            this.removeProvider(id);
            document.querySelector(`.settings-pill[data-id="${id}"]`).remove();
        });

        eventBus.addEventListener('setActiveProvider', (event) => {
            console.log('setActiveProvider event received:', event.detail);
            const { id } = event.detail;
            this.setActiveProvider(id);
            document.querySelectorAll('.settings-pill').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.id === id);
            });
        });
    }

    async validateProvider(url, apiKey) {
        console.log('Validating provider:', url);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Validation response:', response.ok);
            return response.ok;
        } catch (error) {
            console.error('Provider validation failed:', error);
            return false;
        }
    }

    truncateUrl(url) {
        try {
            const urlObj = new URL(url);
            return `${urlObj.hostname.split('.')[0]}...`;
        } catch {
            return url.substring(0, 10) + '...';
        }
    }

    createPill(provider, isActive = false) {
        console.log('Creating pill for provider:', provider);
        const pill = document.createElement('div');
        pill.className = `settings-pill ${isActive ? 'active' : ''}`;
        pill.dataset.id = provider.id;
        pill.dataset.url = provider.url;
        
        const status = provider.isValid === undefined ? 'pending' : 
                      provider.isValid ? 'valid' : 'invalid';

        pill.innerHTML = `
            <span class="pill-text">${this.truncateUrl(provider.url)}</span>
            <span class="pill-status ${status}">
                ${this.getStatusIcon(status)}
            </span>
            <button class="pill-remove">×</button>
            <div class="pill-details">
                <div class="details-content">
                    <p><strong>URL:</strong> ${provider.url}</p>
                    <p><strong>API Key:</strong> ${this.maskApiKey(provider.apiKey)}</p>
                </div>
            </div>
        `;

        pill.querySelector('.pill-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            eventBus.dispatchEvent(new CustomEvent('removeProvider', { 
                detail: { id: provider.id } 
            }));
        });

        pill.addEventListener('click', (e) => {
            if (!e.target.closest('.pill-remove')) {
                document.querySelectorAll('.settings-pill.expanded').forEach(p => {
                    if (p !== pill) p.classList.remove('expanded');
                });
                pill.classList.toggle('expanded');
                
                if (!pill.classList.contains('expanded')) {
                    eventBus.dispatchEvent(new CustomEvent('setActiveProvider', { 
                        detail: { id: provider.id } 
                    }));
                }
            }
        });

        return pill;
    }

    getStatusIcon(status) {
        switch(status) {
            case 'valid':
                return '<svg class="icon-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
            case 'invalid':
                return '<svg class="icon-error" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
            default:
                return '<svg class="icon-pending" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
        }
    }

    async addProvider(url, apiKey) {
        console.log('Adding provider:', { url, apiKey });
        const provider = { url, apiKey, isActive: false };
        const isValid = await this.validateProvider(url, apiKey);
        provider.isValid = isValid;
        
        const id = Date.now().toString();
        this.providers.set(id, provider);
        
        console.log('Provider added:', { id, provider });
        return { id, provider };
    }

    removeProvider(id) {
        console.log('Removing provider with id:', id);
        this.providers.delete(id);
        this.saveToLocalStorage();
    }

    setActiveProvider(id) {
        console.log('Setting active provider with id:', id);
        for (const [key, provider] of this.providers) {
            provider.isActive = key === id;
        }
        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        console.log('Saving providers to localStorage');
        const data = Array.from(this.providers.entries()).map(([id, provider]) => ({
            id,
            ...provider
        }));
        localStorage.setItem('apiProviders', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        console.log('Loading providers from localStorage');
        const data = JSON.parse(localStorage.getItem('apiProviders') || '[]');
        this.providers.clear();
        data.forEach(item => {
            const { id, ...provider } = item;
            this.providers.set(id, provider);
        });
    }

    renderPill(id, provider) {
        console.log('Rendering pill for provider:', provider);
        const pillsContainer = document.querySelector('.settings-pills-container');
        if (pillsContainer) {
            const pill = this.createPill(provider);
            pillsContainer.appendChild(pill);
        } else {
            console.warn('Pills container not found');
        }
    }

    maskApiKey(apiKey) {
        if (!apiKey) return '';
        const firstFour = apiKey.substring(0, 4);
        const lastFour = apiKey.substring(apiKey.length - 4);
        return `${firstFour}...${lastFour}`;
    }
} 


export const settingsPills = new SettingsPills();