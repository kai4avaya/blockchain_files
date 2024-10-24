// embeddings.js
// class EmbeddingWorker {
//     constructor() {
//         this.initializationPromise = null;
//         if (!EmbeddingWorker.instance) {
//             this.worker = new Worker(new URL('../workers/embedding_worker.js', import.meta.url), { type: 'module' });
//             this.isReady = false;
//             this.taskQueue = [];
//             this.pendingTasks = {}; // Map of fileId to task

//             this.worker.onmessage = this.handleWorkerMessage.bind(this);

//             this.worker.onerror = (e) => {
//                 console.error('Worker error:', e);
//                 console.error('Error message:', e.message);
//                 console.error('Error filename:', e.filename);
//                 console.error('Error lineno:', e.lineno);
//                 console.error('Error stack:', e.error ? e.error.stack : 'No stack available');
//             };

//             EmbeddingWorker.instance = this;
//         }
//         return EmbeddingWorker.instance;
//     }

//     handleWorkerMessage(e) {
//         const { type, data, fileId } = e.data;
//         if (type === 'ready') {
//             this.isReady = true;
//             this.processQueuedTasks();
//         } else if (type === 'embeddingsResult') {
//             if (fileId === undefined) {
//                 console.error("Received embeddingsResult without fileId");
//                 return;
//             }
//             const task = this.pendingTasks[fileId];
//             if (task) {
//                 task.resolve(data);
//                 delete this.pendingTasks[fileId];
//             } else {
//                 console.error(`Task not found for fileId: ${fileId}`);
//             }
//         } else if (type === 'error') {
//             if (fileId === undefined) {
//                 console.error("Received error without fileId:", data);
//                 return;
//             }
//             const task = this.pendingTasks[fileId];
//             if (task) {
//                 console.error(`Rejecting task for fileId: ${fileId}`);
//                 task.reject(new Error(data));
//                 delete this.pendingTasks[fileId];
//             } else {
//                 console.error(`Task not found for fileId: ${fileId}, Error: ${data}`);
//             }
//         }
//     }

//     initialize() {
//         if (!this.initializationPromise) {
//             this.initializationPromise = new Promise((resolve, reject) => {
//                 this.worker.postMessage({ type: 'initialize' });
//                 const handleInitMessage = (e) => {
//                     if (e.data.type === 'ready') {
//                         this.isReady = true;
//                         this.worker.removeEventListener('message', handleInitMessage);
//                         resolve();
//                     } else if (e.data.type === 'error') {
//                         this.worker.removeEventListener('message', handleInitMessage);
//                         reject(new Error(e.data.data));
//                     }
//                 };
//                 this.worker.addEventListener('message', handleInitMessage);
//             });
//         }
//         return this.initializationPromise;
//     }

//     generateEmbeddings(text, fileId) {
//         if (fileId === undefined) {
//             console.error("generateEmbeddings called without fileId");
//             return Promise.reject(new Error("fileId is required"));
//         }
//         return new Promise((resolve, reject) => {
//             const task = { text, fileId, resolve, reject };
//             this.taskQueue.push(task);
//             if (this.isReady) {
//                 this.processQueuedTasks();
//             }
//         });
//     }

//     processQueuedTasks() {
//         while (this.taskQueue.length > 0) {
//             const task = this.taskQueue.shift();
//             this.pendingTasks[task.fileId] = task;
//             this.worker.postMessage({
//                 type: 'generateEmbeddings',
//                 data: task.text,
//                 fileId: task.fileId
//             });
//         }
//     }
// }

// const embeddingWorker = new EmbeddingWorker();
// export default embeddingWorker;


// embeddings.js
class EmbeddingWorker {
    constructor() {
        if (!EmbeddingWorker.instance) {
            this.initializationPromise = null;
            this.worker = null;
            this.isReady = false;
            this.taskQueue = [];
            this.pendingTasks = {}; // Map of fileId to task
            this.idleTimeout = null;
            this.IDLE_TIMEOUT_MS = 30000; // 30 seconds
            
            EmbeddingWorker.instance = this;
        }
        return EmbeddingWorker.instance;
    }

    createWorker() {
        if (!this.worker) {
            this.worker = new Worker(new URL('../workers/embedding_worker.js', import.meta.url), { type: 'module' });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = (e) => {
                console.error('Worker error:', e);
                console.error('Error message:', e.message);
                console.error('Error filename:', e.filename);
                console.error('Error lineno:', e.lineno);
                console.error('Error stack:', e.error ? e.error.stack : 'No stack available');
            };
        }
    }

    resetIdleTimeout() {
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
        }
        this.idleTimeout = setTimeout(() => this.terminateWorker(), this.IDLE_TIMEOUT_MS);
    }

    async terminateWorker() {
        if (this.worker && Object.keys(this.pendingTasks).length === 0) {
            // Send termination message to worker
            this.worker.postMessage({ type: 'terminate' });
            
            // Wait for termination confirmation or timeout after 1 second
            try {
                await Promise.race([
                    new Promise((resolve) => {
                        const terminationHandler = (e) => {
                            if (e.data.type === 'terminationComplete') {
                                this.worker.removeEventListener('message', terminationHandler);
                                resolve();
                            }
                        };
                        this.worker.addEventListener('message', terminationHandler);
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Worker termination timed out')), 1000))
                ]);
            } catch (error) {
                console.warn('Worker termination warning:', error);
            }

            // Clean up worker resources
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            this.initializationPromise = null;
            
            if (this.idleTimeout) {
                clearTimeout(this.idleTimeout);
                this.idleTimeout = null;
            }
        }
    }

    handleWorkerMessage(e) {
        const { type, data, fileId } = e.data;
        if (type === 'ready') {
            this.isReady = true;
            this.processQueuedTasks();
        } else if (type === 'embeddingsResult') {
            if (fileId === undefined) {
                console.error("Received embeddingsResult without fileId");
                return;
            }
            const task = this.pendingTasks[fileId];
            if (task) {
                task.resolve(data);
                delete this.pendingTasks[fileId];
                this.resetIdleTimeout(); // Reset timeout after task completion
            } else {
                console.error(`Task not found for fileId: ${fileId}`);
            }
        } else if (type === 'error') {
            if (fileId === undefined) {
                console.error("Received error without fileId:", data);
                return;
            }
            const task = this.pendingTasks[fileId];
            if (task) {
                console.error(`Rejecting task for fileId: ${fileId}`);
                task.reject(new Error(data));
                delete this.pendingTasks[fileId];
                this.resetIdleTimeout(); // Reset timeout after task completion
            } else {
                console.error(`Task not found for fileId: ${fileId}, Error: ${data}`);
            }
        }
    }

    initialize() {
        this.createWorker(); // Ensure worker exists
        
        if (!this.initializationPromise) {
            this.initializationPromise = new Promise((resolve, reject) => {
                this.worker.postMessage({ type: 'initialize' });
                const handleInitMessage = (e) => {
                    if (e.data.type === 'ready') {
                        this.isReady = true;
                        this.worker.removeEventListener('message', handleInitMessage);
                        this.resetIdleTimeout(); // Start idle timeout after initialization
                        resolve();
                    } else if (e.data.type === 'error') {
                        this.worker.removeEventListener('message', handleInitMessage);
                        reject(new Error(e.data.data));
                    }
                };
                this.worker.addEventListener('message', handleInitMessage);
            });
        }
        return this.initializationPromise;
    }

    async generateEmbeddings(text, fileId) {
        if (fileId === undefined) {
            console.error("generateEmbeddings called without fileId");
            return Promise.reject(new Error("fileId is required"));
        }

        // Ensure worker is initialized
        if (!this.isReady) {
            await this.initialize();
        }

        // Reset idle timeout when a new task comes in
        this.resetIdleTimeout();

        return new Promise((resolve, reject) => {
            const task = { text, fileId, resolve, reject };
            this.taskQueue.push(task);
            if (this.isReady) {
                this.processQueuedTasks();
            }
        });
    }

    processQueuedTasks() {
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            this.pendingTasks[task.fileId] = task;
            this.worker.postMessage({
                type: 'generateEmbeddings',
                data: task.text,
                fileId: task.fileId
            });
        }
    }
}

const embeddingWorker = new EmbeddingWorker();
export default embeddingWorker;