// EmbeddingWorker.js (updated)
class EmbeddingWorker {
    constructor() {
        if (!EmbeddingWorker.instance) {
            this.worker = new Worker(new URL('./embedding_worker.js', import.meta.url), { type: 'module' });
            this.taskQueue = [];
            this.isProcessing = false;

            this.worker.onmessage = (e) => {
                const { type, data, fileId } = e.data;
                if (type === 'embeddingsResult') {
                    this.onEmbeddingsGenerated(fileId, data);
                } else if (type === 'error') {
                    console.error('Embedding error:', data);
                    this.onEmbeddingError(fileId, data);
                }
                this.processNextTask();
            };

            EmbeddingWorker.instance = this;
        }
        return EmbeddingWorker.instance;
    }

    generateEmbeddings(chunks, fileId) {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ chunks, fileId, resolve, reject });
            if (!this.isProcessing) {
                this.processNextTask();
            }
        });
    }

    processNextTask() {
        if (this.taskQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { chunks, fileId, resolve, reject } = this.taskQueue.shift();

        this.worker.postMessage({
            type: 'generateEmbeddings',
            data: chunks,
            fileId: fileId
        });

        this.currentTask = { fileId, resolve, reject };
    }

    onEmbeddingsGenerated(fileId, embeddings) {
        if (this.currentTask && this.currentTask.fileId === fileId) {
            this.currentTask.resolve(embeddings);
            this.currentTask = null;
        }
    }

    onEmbeddingError(fileId, error) {
        if (this.currentTask && this.currentTask.fileId === fileId) {
            this.currentTask.reject(new Error(error));
            this.currentTask = null;
        }
    }
}

const embeddingWorker = new EmbeddingWorker();
export default embeddingWorker;