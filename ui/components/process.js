class StatusIndicator {
    constructor() {
        this.container = document.getElementById('status-container');
        this.statuses = [];
        this.isVisible = false;
        this.setupEventListener();
    }

    setupEventListener() {
        window.addEventListener('statusUpdate', (event) => {
            this.addStatus(event.detail.status);
        });
    }

    show() {
        if (!this.isVisible) {
            this.container.classList.add('visible');
            this.isVisible = true;
        }
    }

    hide() {
        if (this.isVisible) {
            this.container.classList.remove('visible');
            this.isVisible = false;
        }
    }

    addStatus(status) {
        this.show();
        if (status.toLowerCase() === 'done') {
            this.complete();
        } else {
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            statusItem.innerHTML = `
                <span>${status}</span>
                <div class="spinner"></div>
            `;
            this.container.appendChild(statusItem);
            this.statuses.push(statusItem);

            setTimeout(() => {
                statusItem.querySelector('.spinner').outerHTML = '<span class="checkmark">✓</span>';
            }, 2000);
        }
    }

    complete() {
        setTimeout(() => {
            this.hide();
            setTimeout(() => {
                this.container.innerHTML = '';
                this.statuses = [];
            }, 500); // Wait for fade out to complete before clearing
        }, 2000);
    }
}

// Create a single instance
const statusIndicator = new StatusIndicator();

export function updateStatus(status) {
    window.dispatchEvent(new CustomEvent('statusUpdate', { 
        detail: { status: status }
    }));
}

// If you need direct access to the StatusIndicator instance (usually not necessary)
export function getStatusIndicator() {
    return statusIndicator;
}