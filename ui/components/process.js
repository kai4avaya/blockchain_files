class StatusIndicator {
    constructor() {
        this.container = document.getElementById('status-container');
        this.statuses = [];
        this.isVisible = false;
        this.setupEventListener();
        this.setupScrollbar();
    }

    setupEventListener() {
        window.addEventListener('statusUpdate', (event) => {
            this.addStatus(event.detail.status);
        });
    }

    setupScrollbar() {
        this.container.classList.add('custom-scrollbar');
    }

    scrollToBottom() {
        this.container.scrollTo({
            top: this.container.scrollHeight,
            behavior: 'smooth'
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
            this.scrollToBottom();

            setTimeout(() => {
                statusItem.querySelector('.spinner').outerHTML = '<span class="checkmark">✓</span>';
                setTimeout(() => {
                    statusItem.classList.add('fade-out');
                    setTimeout(() => {
                        if (this.container.contains(statusItem)) {
                            this.container.removeChild(statusItem);
                            this.statuses = this.statuses.filter(item => item !== statusItem);
                        }
                        if (this.statuses.length === 0) {
                            this.hide();
                        }
                    }, 300);
                }, 1000);
            }, 1000);
        }
    }

    complete() {
        this.statuses.forEach(statusItem => {
            if (statusItem.querySelector('.spinner')) {
                statusItem.querySelector('.spinner').outerHTML = '<span class="checkmark">✓</span>';
            }
        });

        setTimeout(() => {
            this.hide();
            setTimeout(() => {
                this.container.innerHTML = '';
                this.statuses = [];
            }, 500);
        }, 1000);
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