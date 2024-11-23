import { eventBus } from '../eventBus.js';
import toast from './toast-alert.js';

export class SettingsPills {
    constructor() {
        this.providers = new Map();
        
        // Define handlers first
        this.handleAddProvider = async (event) => {
            console.log('addProvider event received:', event.detail);
            const { url, apiKey } = event.detail;
            const { id, provider } = await this.addProvider(url, apiKey);
            this.renderPill(id, provider);
            this.saveToLocalStorage();
        };

        this.handleRemoveProvider = (event) => {
            console.log('removeProvider event received:', event.detail);
            const { id } = event.detail;
            this.removeProvider(id);
            document.querySelector(`.settings-pill[data-id="${id}"]`).remove();
        };

        this.handleSetActiveProvider = (event) => {
            console.log('setActiveProvider event received:', event.detail);
            const { id } = event.detail;
            this.setActiveProvider(id);
            document.querySelectorAll('.settings-pill').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.id === id);
            });
        };

        // Bind handlers to this instance
        this.handleAddProvider = this.handleAddProvider.bind(this);
        this.handleRemoveProvider = this.handleRemoveProvider.bind(this);
        this.handleSetActiveProvider = this.handleSetActiveProvider.bind(this);
        
        // Initialize
        this.loadFromLocalStorage();
        this.setupEventListeners();
        console.log('SettingsPills initialized');
    }

    setupEventListeners() {
        console.log('Setting up event listeners for SettingsPills');
        
        // Remove any existing listeners
        eventBus.removeEventListener('addProvider', this.handleAddProvider);
        eventBus.removeEventListener('removeProvider', this.handleRemoveProvider);
        eventBus.removeEventListener('setActiveProvider', this.handleSetActiveProvider);
        eventBus.removeEventListener('renderExistingPills', this.handleRenderExistingPills);

        // Add event listeners
        eventBus.addEventListener('addProvider', this.handleAddProvider);
        eventBus.addEventListener('removeProvider', this.handleRemoveProvider);
        eventBus.addEventListener('setActiveProvider', this.handleSetActiveProvider);
        eventBus.addEventListener('renderExistingPills', () => {
            console.log('renderExistingPills event received');
            this.renderExistingPills();
        });
    }

    async validateProvider(url, apiKey) {
        console.log('Validating provider:', url);
        toast.show('Validating provider...', 'info');
        
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
            toast.show('Provider validation failed', 'error');
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
        pill.className = `settings-pill ${provider.isActive ? 'active' : ''}`;
        pill.dataset.id = provider.id;
        pill.dataset.url = provider.url;
        
        const status = provider.isValid === undefined ? 'pending' : 
                      provider.isValid ? 'valid' : 'invalid';

        pill.innerHTML = `
            <span class="pill-text">${this.truncateUrl(provider.url)}</span>
            <span class="pill-status ${status}">
                ${this.getStatusIcon(status)}
            </span>
            <button class="pill-remove-settings" aria-label="Remove provider" 
                style="background-color: transparent; color: #6b7280; width:fit-content">×</button>
            <div class="pill-details">
                <div class="details-content">
                    <p><strong>URL:</strong> ${provider.url}</p>
                    <p><strong>API Key:</strong> ${this.maskApiKey(provider.apiKey)}</p>
                </div>
            </div>
        `;

        const removeButton = pill.querySelector('.pill-remove-settings');
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            eventBus.dispatchEvent(new CustomEvent('removeProvider', { 
                detail: { id: provider.id } 
            }));
        }, { once: true });

        // Double click detection
        let clickTimeout;
        let clickCount = 0;

        pill.addEventListener('click', (e) => {
            if (e.target.closest('.pill-remove-settings')) return;
            
            clickCount++;
            
            if (clickCount === 1) {
                clickTimeout = setTimeout(() => {
                    // Single click - set as active
                    document.querySelectorAll('.settings-pill').forEach(p => {
                        p.classList.remove('active');
                    });
                    pill.classList.add('active');
                    
                    // Dispatch event to set active provider
                    eventBus.dispatchEvent(new CustomEvent('setActiveProvider', { 
                        detail: { id: provider.id } 
                    }));
                    
                    clickCount = 0;
                }, 250); // Adjust timing for double click detection
            } else {
                // Double click - toggle expansion
                clearTimeout(clickTimeout);
                clickCount = 0;
                
                document.querySelectorAll('.settings-pill.expanded').forEach(p => {
                    if (p !== pill) p.classList.remove('expanded');
                });
                pill.classList.toggle('expanded');
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

        // Check for existing provider
        const existingProvider = Array.from(this.providers.entries()).find(([_, provider]) => 
            provider.url.toLowerCase() === url.toLowerCase()
        );

        if (existingProvider) {
            console.log('Provider with this URL already exists:', existingProvider);
            toast.show('Updating existing provider...', 'info');
            
            if (existingProvider[1].apiKey !== apiKey) {
                existingProvider[1].apiKey = apiKey;
                const isValid = await this.validateProvider(url, apiKey);
                existingProvider[1].isValid = isValid;
                
                toast.show(isValid ? 'Provider updated successfully' : 'Invalid provider credentials', 
                          isValid ? 'success' : 'error');
                
                this.saveToLocalStorage();
                this.renderExistingPills();
            }
            return { id: existingProvider[0], provider: existingProvider[1] };
        }

        // Create new provider
        const provider = { url, apiKey, isActive: false };
        const isValid = await this.validateProvider(url, apiKey);
        provider.isValid = isValid;
        
        if (!isValid) {
            toast.show('Failed to validate provider credentials', 'error');
            return null;
        }

        const id = Date.now().toString();
        this.providers.set(id, provider);
        
        toast.show('New provider added successfully', 'success');
        this.saveToLocalStorage();
        return { id, provider };
    }

    removeProvider(id) {
        console.log('Removing provider with id:', id);
        const provider = this.providers.get(id);
        if (provider) {
            this.providers.delete(id);
            this.saveToLocalStorage();
            toast.show('Provider removed', 'info');
        }
    }

    setActiveProvider(id) {
        console.log('Setting active provider with id:', id);
        const provider = this.providers.get(id);
        if (provider) {
            for (const [key, p] of this.providers) {
                p.isActive = key === id;
            }
            this.saveToLocalStorage();
            toast.show(`Active provider set to ${this.truncateUrl(provider.url)}`, 'success');
        }
    }

    saveToLocalStorage() {
        console.log('Saving providers to localStorage');
        // Convert Map to array and remove any duplicates based on URL
        const uniqueProviders = Array.from(this.providers.entries())
            .reduce((acc, [id, provider]) => {
                const existingIndex = acc.findIndex(([_, p]) => 
                    p.url.toLowerCase() === provider.url.toLowerCase()
                );
                if (existingIndex === -1) {
                    acc.push([id, provider]);
                }
                return acc;
            }, []);

        const data = uniqueProviders.map(([id, provider]) => ({
            id,
            ...provider
        }));

        localStorage.setItem('apiProviders', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        console.log('Loading providers from localStorage');
        const data = JSON.parse(localStorage.getItem('apiProviders') || '[]');
        this.providers.clear();
        
        // Filter out duplicates while loading
        const uniqueProviders = data.reduce((acc, item) => {
            const { id, ...provider } = item;
            const existingProvider = Array.from(acc.values())
                .find(p => p.url.toLowerCase() === provider.url.toLowerCase());
            
            if (!existingProvider) {
                acc.set(id, provider);
            }
            return acc;
        }, new Map());

        this.providers = uniqueProviders;
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

    renderExistingPills() {
        console.log('Rendering existing pills');
        const pillsContainer = document.querySelector('.settings-pills-container');
        if (pillsContainer) {
            pillsContainer.innerHTML = '';
            this.providers.forEach((provider, id) => {
                const pill = this.createPill({ ...provider, id });
                pillsContainer.appendChild(pill);
            });
        }
    }

    cleanup() {
        eventBus.removeEventListener('addProvider', this.handleAddProvider);
        eventBus.removeEventListener('removeProvider', this.handleRemoveProvider);
        eventBus.removeEventListener('setActiveProvider', this.handleSetActiveProvider);
        eventBus.removeEventListener('renderExistingPills', this.handleRenderExistingPills);
    }
} 


export const settingsPills = new SettingsPills();