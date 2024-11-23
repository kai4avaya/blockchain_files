class SettingsModalHandler {
    constructor() {
        this.tempSettings = {
            provider: '',
            apiKey: '',
            model: ''
        };
        
        // Wait for DOM to be ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Get all required elements
        const elements = {
            saveButton: document.getElementById('saveSettingsButton'),
            aiProviderInput: document.getElementById('aiProviderInput'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            aiModelSelect: document.getElementById('aiModelSelect'),
            clearButton: document.getElementById('clearSettingsButton'),
            settingsIcon: document.getElementById('settingsIcon')
        };

        // Log available elements
        console.log('Found elements:', {
            hasSaveButton: !!elements.saveButton,
            hasProviderInput: !!elements.aiProviderInput,
            hasKeyInput: !!elements.apiKeyInput,
            hasModelSelect: !!elements.aiModelSelect
        });

        // Ensure save button exists before adding listener
        if (elements.saveButton) {
            // Remove any existing listeners
            const newSaveButton = elements.saveButton.cloneNode(true);
            elements.saveButton.parentNode?.replaceChild(newSaveButton, elements.saveButton);
            
            // Add new listener
            newSaveButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Save button clicked');
                
                const provider = elements.aiProviderInput?.value.trim() || '';
                const apiKey = elements.apiKeyInput?.value.trim() || '';
                const model = elements.aiModelSelect?.value || '';

                console.log('Saving settings:', { 
                    hasProvider: !!provider, 
                    hasKey: !!apiKey, 
                    model 
                });

                try {
                    localStorage.setItem('aiProvider', provider);
                    localStorage.setItem('apiKey', apiKey);
                    localStorage.setItem('aiModel', model);
                    
                    console.log('Settings saved successfully');
                    this.showToast('Settings saved successfully!', 'success');
                    
                    window.dispatchEvent(new CustomEvent('settingsUpdated', {
                        detail: { provider, model }
                    }));
                } catch (error) {
                    console.error('Error saving settings:', error);
                    this.showToast('Error saving settings', 'error');
                }
            });
        } else {
            console.error('Save button not found in DOM');
        }

        // Setup other listeners
        if (elements.aiProviderInput) {
            elements.aiProviderInput.addEventListener('input', (e) => {
                this.tempSettings.provider = e.target.value.trim();
                console.log('Provider updated:', this.tempSettings.provider);
            });
        }

        if (elements.apiKeyInput) {
            elements.apiKeyInput.addEventListener('input', (e) => {
                this.tempSettings.apiKey = e.target.value.trim();
                console.log('API Key updated:', !!this.tempSettings.apiKey);
            });
        }

        if (elements.aiModelSelect) {
            elements.aiModelSelect.addEventListener('change', (e) => {
                this.tempSettings.model = e.target.value;
                console.log('Model updated:', this.tempSettings.model);
            });
        }

        // Load any existing settings
        this.loadSavedSettings();
    }

    loadSavedSettings() {
        const aiProvider = localStorage.getItem('aiProvider') || '';
        const apiKey = localStorage.getItem('apiKey') || '';
        const aiModel = localStorage.getItem('aiModel') || '';

        // Get input elements
        const aiProviderInput = document.getElementById('aiProviderInput');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const aiModelSelect = document.getElementById('aiModelSelect');

        if (aiProviderInput) aiProviderInput.value = aiProvider;
        if (apiKeyInput) apiKeyInput.value = apiKey;
        if (aiModelSelect) aiModelSelect.value = aiModel;
    }

    setupListeners() {
        // Get elements
        const aiProviderInput = document.getElementById('aiProviderInput');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const aiModelSelect = document.getElementById('aiModelSelect');
        const saveButton = document.getElementById('saveSettingsButton');
        const clearButton = document.getElementById('clearSettingsButton');

        console.log('Setting up listeners with elements:', { 
            aiProviderInput, 
            apiKeyInput, 
            aiModelSelect, 
            saveButton,
            clearButton 
        });

        // Save button event listener
        if (saveButton) {

            console.log("hey save button")
            saveButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Save button clicked');
                
                // Get current values directly from inputs
                const provider = aiProviderInput ? aiProviderInput.value.trim() : '';
                const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
                const model = aiModelSelect ? aiModelSelect.value : '';

                console.log('Current values:', { 
                    hasProvider: !!provider, 
                    hasKey: !!apiKey, 
                    model 
                });

                // Update tempSettings
                this.tempSettings = {
                    provider,
                    apiKey,
                    model
                };

                // Save to localStorage
                try {
                    localStorage.setItem('aiProvider', provider);
                    localStorage.setItem('apiKey', apiKey);
                    localStorage.setItem('aiModel', model);
                    
                    console.log('Saved to localStorage:', {
                        savedProvider: localStorage.getItem('aiProvider'),
                        hasKey: !!localStorage.getItem('apiKey'),
                        savedModel: localStorage.getItem('aiModel')
                    });

                    this.updateSettingsStatus();
                    this.updateClearButton();
                    this.showToast('Settings saved successfully!', 'success');

                    // Dispatch event for other parts of the application
                    window.dispatchEvent(new CustomEvent('settingsUpdated', {
                        detail: {
                            provider,
                            model
                        }
                    }));
                } catch (error) {
                    console.error('Error saving to localStorage:', error);
                    this.showToast('Error saving settings', 'error');
                }
            });

            // Add visual feedback for click
            saveButton.addEventListener('mousedown', () => {
                saveButton.style.transform = 'scale(0.95)';
            });

            saveButton.addEventListener('mouseup', () => {
                saveButton.style.transform = 'scale(1)';
            });
        }

        // Input event listeners with debounce
        if (aiProviderInput) {
            aiProviderInput.addEventListener('input', this.debounce((e) => {
                this.tempSettings.provider = e.target.value.trim();
                console.log('Provider updated:', this.tempSettings.provider);
            }, 300));
        }

        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', this.debounce((e) => {
                this.tempSettings.apiKey = e.target.value.trim();
                console.log('API Key updated:', !!this.tempSettings.apiKey);
            }, 300));
        }

        if (aiModelSelect) {
            aiModelSelect.addEventListener('change', (e) => {
                this.tempSettings.model = e.target.value;
                console.log('Model updated:', this.tempSettings.model);
            });
        }

        // Clear button event listener
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                console.log('Clear button clicked');
                this.clearSettings();
            });
        }
    }

    saveSettings() {
        console.log('Saving settings...', this.tempSettings); // Debug log

        if (!this.validateSettings()) {
            console.log('Settings validation failed'); // Debug log
            return;
        }

        try {
            // Save from temp settings to localStorage
            localStorage.setItem('aiProvider', this.tempSettings.provider);
            localStorage.setItem('apiKey', this.tempSettings.apiKey);
            localStorage.setItem('aiModel', this.tempSettings.model);

            console.log('Settings saved to localStorage:', {
                provider: this.tempSettings.provider,
                model: this.tempSettings.model,
                hasKey: !!this.tempSettings.apiKey
            }); // Debug log

            this.updateSettingsStatus();
            this.updateClearButton();
            this.showToast('Settings saved successfully!', 'success');

            // Dispatch event for other parts of the application
            window.dispatchEvent(new CustomEvent('settingsUpdated', {
                detail: {
                    provider: this.tempSettings.provider,
                    model: this.tempSettings.model
                }
            }));
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Error saving settings', 'error');
        }
    }

    showSaveIndicator(element) {
        // Add a temporary visual indicator that the value was saved
        element.classList.add('saved');
        setTimeout(() => {
            element.classList.remove('saved');
        }, 1000);
    }

    setupTooltips() {
        const aiProviderInput = document.getElementById('aiProviderInput');
        if (aiProviderInput) {
            aiProviderInput.title = 'Enter the API endpoint URL (e.g., https://api.openai.com/v1/chat/completions)';
        }

        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.title = 'Enter your API key';
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Add a static method to ensure singleton
    static getInstance() {
        if (!SettingsModalHandler.instance) {
            SettingsModalHandler.instance = new SettingsModalHandler();
        }
        return SettingsModalHandler.instance;
    }

    // Add method to check if settings are configured
    isConfigured() {
        const provider = localStorage.getItem('aiProvider');
        const key = localStorage.getItem('apiKey');
        return !!(provider && key);
    }

    // Add method to get current settings
    getSettings() {
        return {
            provider: localStorage.getItem('aiProvider') || '',
            apiKey: localStorage.getItem('apiKey') || '',
            model: localStorage.getItem('aiModel') || ''
        };
    }

    validateSettings() {
        const { provider, apiKey } = this.tempSettings;
        
        if (!provider) {
            this.showToast('API Provider URL is required', 'error');
            return false;
        }

        try {
            new URL(provider); // Validate URL format
        } catch (error) {
            this.showToast('Invalid API URL format', 'error');
            return false;
        }

        if (!apiKey) {
            this.showToast('API Key is required', 'error');
            return false;
        }

        return true;
    }

    clearSettings() {
        // Clear localStorage
        localStorage.removeItem('aiProvider');
        localStorage.removeItem('apiKey');
        localStorage.removeItem('aiModel');

        // Clear temp settings
        this.tempSettings = {
            provider: '',
            apiKey: '',
            model: ''
        };

        // Clear inputs
        this.loadSavedSettings();
        
        // Update UI
        this.updateClearButton();
        this.showToast('Settings cleared', 'info');
        
        // Dispatch event for other parts of the application
        window.dispatchEvent(new CustomEvent('settingsCleared'));
    }
}

// Add CSS for the new UI elements
const style = document.createElement('style');
style.textContent = `
    .settings-input.modified {
        border-color: #4CAF50;
        box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);
    }

    .settings-status {
        margin-top: 10px;
        padding: 8px;
        border-radius: 4px;
        background: #f5f5f5;
    }

    .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;
        background: #ccc;
    }

    .status-dot.active {
        background: #4CAF50;
    }

    .settings-buttons {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }

    .settings-clear-btn {
        background-color: #f44336;
        color: white;
        padding: 10px 15px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .settings-clear-btn:hover {
        background-color: #d32f2f;
    }
`;

document.head.appendChild(style);

// Export a singleton instance
const settingsHandler = SettingsModalHandler.getInstance();
export default settingsHandler; 