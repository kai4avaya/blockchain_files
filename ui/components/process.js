class StatusIndicator {
    constructor() {
        this.container = document.getElementById('status-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'status-container';
            document.body.appendChild(this.container);
        }
        this.statuses = [];
        this.isVisible = false;
        this.setupEventListener();
        this.setupScrollbar();
        this.activeStatus = null;
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

    addStatus(status, isPersistent = false) {
        this.show();
        
        if (status.toLowerCase() === 'done') {
            this.complete();
            return;
        }

        if (this.activeStatus) {
            requestAnimationFrame(() => {
                const spinner = this.activeStatus?.querySelector('.spinner');
                if (spinner) {
                    spinner.outerHTML = '<span class="checkmark">✓</span>';
                    this.fadeOutStatus(this.activeStatus);
                }
            });
        }

        const statusItem = document.createElement('div');
        statusItem.className = 'status-item';
        statusItem.innerHTML = `
            <span>${status}</span>
            <div class="spinner"></div>
        `;
        
        this.container.appendChild(statusItem);
        this.statuses.push(statusItem);
        this.scrollToBottom();

        if (isPersistent) {
            this.activeStatus = statusItem;
        } else {
            setTimeout(() => {
                requestAnimationFrame(() => {
                    const spinner = statusItem?.querySelector('.spinner');
                    if (spinner && statusItem.isConnected) {
                        spinner.outerHTML = '<span class="checkmark">✓</span>';
                        this.fadeOutStatus(statusItem);
                    }
                });
            }, 1000);
        }
    }

    fadeOutStatus(statusItem) {
        if (!statusItem?.isConnected) return;
        
        setTimeout(() => {
            statusItem.classList.add('fade-out');
            setTimeout(() => {
                if (statusItem?.isConnected && this.container.contains(statusItem)) {
                    this.container.removeChild(statusItem);
                    this.statuses = this.statuses.filter(item => item !== statusItem);
                    
                    if (this.statuses.length === 0) {
                        this.hide();
                    }
                }
            }, 300);
        }, 1000);
    }

    complete() {
        requestAnimationFrame(() => {
            if (this.activeStatus) {
                const spinner = this.activeStatus.querySelector('.spinner');
                if (spinner) {
                    spinner.outerHTML = '<span class="checkmark">✓</span>';
                    this.fadeOutStatus(this.activeStatus);
                    this.activeStatus = null;
                }
            }

            this.statuses.forEach(statusItem => {
                const spinner = statusItem?.querySelector('.spinner');
                if (spinner && statusItem.isConnected) {
                    spinner.outerHTML = '<span class="checkmark">✓</span>';
                }
            });

            setTimeout(() => {
                this.hide();
                setTimeout(() => {
                    if (this.container) {
                        this.container.innerHTML = '';
                        this.statuses = [];
                    }
                }, 500);
            }, 1000);
        });
    }
}

// Create a single instance
const statusIndicator = new StatusIndicator();

export function updateStatus(status, isPersistent = false) {
    window.dispatchEvent(new CustomEvent('statusUpdate', { 
        detail: { 
            status: status,
            isPersistent: isPersistent 
        }
    }));
}

// If you need direct access to the StatusIndicator instance (usually not necessary)
export function getStatusIndicator() {
    return statusIndicator;
}