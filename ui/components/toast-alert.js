class ToastAlert {
    constructor() {
        this.container = this.createContainer();
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast-alert toast-${type} toast-enter`;
        
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;

        this.container.appendChild(toast);

        // Trigger enter animation
        setTimeout(() => {
            toast.classList.remove('toast-enter');
        }, 10);

        // Setup exit animation
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                if (this.container.contains(toast)) {
                    this.container.removeChild(toast);
                }
            }, 300); // Match animation duration
        }, duration);
    }

    getIcon(type) {
        switch(type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            default:
                return 'ℹ';
        }
    }
}

const toast = new ToastAlert();
export default toast; 