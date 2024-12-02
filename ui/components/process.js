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
        this.masterStatus = null;
    }

    setupEventListener() {
        window.addEventListener('statusUpdate', (event) => {
            this.addStatus(
                event.detail.status, 
                event.detail.isPersistent,
                event.detail.timeout
            );
        });
        
        window.addEventListener('masterStatusUpdate', (event) => {
            this.addMasterStatus(event.detail.status);
        });
        
        window.addEventListener('masterStatusComplete', (event) => {
            this.completeMasterStatus(event.detail.status);
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

    addStatus(status, isPersistent = false, timeout = null) {
        this.show();
        
        if (status.toLowerCase() === 'done') {
            this.complete();
            return;
        }

        if (isPersistent && this.activeStatus) {
            const prevSpinner = this.activeStatus?.querySelector('.spinner');
            if (prevSpinner) {
                prevSpinner.outerHTML = '<span class="checkmark">✓</span>';
                this.fadeOutStatus(this.activeStatus);
                this.activeStatus = null;
            }
        }

        const statusItem = document.createElement('div');
        statusItem.className = 'status-item';
        statusItem.innerHTML = `
            <span>${status}</span>
            <div class="spinner"></div>
        `;
        
        if (this.masterStatus) {
            this.container.insertBefore(statusItem, this.masterStatus.nextSibling);
        } else {
            this.container.appendChild(statusItem);
        }
        
        this.statuses.push(statusItem);
        this.scrollToBottom();

        if (isPersistent) {
            this.activeStatus = statusItem;
            
            if (timeout) {
                setTimeout(() => {
                    if (statusItem === this.activeStatus) {
                        const spinner = statusItem.querySelector('.spinner');
                        if (spinner) {
                            spinner.outerHTML = '<span class="warning">⚠</span>';
                            this.fadeOutStatus(statusItem);
                            this.activeStatus = null;
                        }
                    }
                }, timeout);
            }
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
        
        if (statusItem === this.masterStatus) {
            setTimeout(() => {
                statusItem.classList.add('fade-out');
                setTimeout(() => {
                    if (statusItem?.isConnected && this.container.contains(statusItem)) {
                        this.container.removeChild(statusItem);
                        this.statuses = this.statuses.filter(item => item !== statusItem);
                        
                        if (this.statuses.length === 0 && !this.masterStatus) {
                            this.hide();
                        }
                    }
                }, 300);
            }, 1000);
            return;
        }
        
        statusItem.classList.add('fade-out');
        setTimeout(() => {
            if (statusItem?.isConnected && this.container.contains(statusItem)) {
                this.container.removeChild(statusItem);
                this.statuses = this.statuses.filter(item => item !== statusItem);
                
                if (this.statuses.length === 0 && !this.masterStatus) {
                    this.hide();
                }
            }
        }, 300);
    }

    complete() {
        requestAnimationFrame(() => {
            if (this.activeStatus && this.activeStatus !== this.masterStatus) {
                const spinner = this.activeStatus.querySelector('.spinner');
                if (spinner) {
                    spinner.outerHTML = '<span class="checkmark">✓</span>';
                    this.fadeOutStatus(this.activeStatus);
                    this.activeStatus = null;
                }
            }

            this.statuses.forEach(statusItem => {
                if (statusItem !== this.masterStatus) {
                    const spinner = statusItem?.querySelector('.spinner');
                    if (spinner && statusItem.isConnected) {
                        spinner.outerHTML = '<span class="checkmark">✓</span>';
                    }
                }
            });

            if (!this.masterStatus) {
                setTimeout(() => {
                    this.hide();
                    setTimeout(() => {
                        if (this.container) {
                            this.container.innerHTML = '';
                            this.statuses = [];
                        }
                    }, 500);
                }, 1000);
            }
        });
    }

    addMasterStatus(status) {
        this.show();
        
        if (!this.masterStatus) {
            const masterStatusItem = document.createElement('div');
            masterStatusItem.className = 'status-item master-status';
            masterStatusItem.innerHTML = `
                <span>${status}</span>
                <div class="spinner"></div>
            `;
            
            this.container.insertBefore(masterStatusItem, this.container.firstChild);
            this.masterStatus = masterStatusItem;
            this.container.classList.add('has-master');
        }
    }

    completeMasterStatus(status) {
        if (this.masterStatus) {
            requestAnimationFrame(() => {
                const spinner = this.masterStatus.querySelector('.spinner');
                if (spinner) {
                    if (status) {
                        this.masterStatus.querySelector('span').textContent = status;
                    }
                    spinner.outerHTML = '<span class="checkmark">✓</span>';
                    
                    setTimeout(() => {
                        this.fadeOutStatus(this.masterStatus);
                        this.masterStatus = null;
                        this.container.classList.remove('has-master');
                    }, 2000);
                }
            });
        }
    }
}

// Create a single instance
const statusIndicator = new StatusIndicator();

export function updateStatus(status, isPersistent = false, timeout = null) {
    window.dispatchEvent(new CustomEvent('statusUpdate', { 
        detail: { 
            status,
            isPersistent,
            timeout
        }
    }));
}

export function startPersistentStatus(status, timeout = null) {
    window.dispatchEvent(new CustomEvent('statusUpdate', { 
        detail: { 
            status,
            isPersistent: true,
            timeout
        }
    }));
}

export function completePersistentStatus(status = 'Done') {
    window.dispatchEvent(new CustomEvent('statusUpdate', { 
        detail: { 
            status: status
        }
    }));
}

export function startMasterStatus(status) {
    window.dispatchEvent(new CustomEvent('masterStatusUpdate', { 
        detail: { status }
    }));
}

export function completeMasterStatus(status) {
    window.dispatchEvent(new CustomEvent('masterStatusComplete', { 
        detail: { status }
    }));
}

// If you need direct access to the StatusIndicator instance (usually not necessary)
export function getStatusIndicator() {
    return statusIndicator;
}
