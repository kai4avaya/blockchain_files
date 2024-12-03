class SwitchToggle {
    constructor() {
        this.isActive = false;
    }

    initialize() {
        const switchContainer = document.querySelector('.switch-container');
        const checkbox = switchContainer?.querySelector('#mermaid-switch');
        
        if (checkbox) {
            // Remove any existing listeners first
            checkbox.removeEventListener('change', this.handleChange);
            // Add new listener
            checkbox.addEventListener('change', this.handleChange.bind(this));
        }
    }

    handleChange(e) {
        this.isActive = e.target.checked;
        toast.show(
            this.isActive ? 
            'AI Diagram Generation Enabled' : 
            'AI Diagram Generation Disabled',
            this.isActive ? 'success' : 'info'
        );
    }

    isEnabled() {
        return this.isActive;
    }
}

const switchToggle = new SwitchToggle();
export default switchToggle;