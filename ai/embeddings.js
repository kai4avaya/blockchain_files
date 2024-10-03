// embeddings.js
class EmbeddingWorker {
    constructor() {
        this.initializationPromise = null;
        if (!EmbeddingWorker.instance) {
            this.worker = new Worker(new URL('../workers/embedding_worker.js', import.meta.url), { type: 'module' });
            this.isReady = false;
            this.taskQueue = [];
            this.pendingTasks = {}; // Map of fileId to task

            this.worker.onmessage = this.handleWorkerMessage.bind(this);

            EmbeddingWorker.instance = this;
        }
        return EmbeddingWorker.instance;
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
            } else {
                console.error(`Task not found for fileId: ${fileId}, Error: ${data}`);
            }
        }
    }

    initialize() {
        if (!this.initializationPromise) {
            this.initializationPromise = new Promise((resolve, reject) => {
                this.worker.postMessage({ type: 'initialize' });
                const handleInitMessage = (e) => {
                    if (e.data.type === 'ready') {
                        this.isReady = true;
                        this.worker.removeEventListener('message', handleInitMessage);
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

    generateEmbeddings(text, fileId) {
        if (fileId === undefined) {
            console.error("generateEmbeddings called without fileId");
            return Promise.reject(new Error("fileId is required"));
        }
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