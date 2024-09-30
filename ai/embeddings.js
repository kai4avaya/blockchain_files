// class EmbeddingWorker {
//     constructor() {
//         this.initializationPromise = null;
//         if (!EmbeddingWorker.instance) {
//             this.worker = new Worker(new URL('../workers/embedding_worker.js', import.meta.url), { type: 'module' });
//             this.isReady = false;
//             this.taskQueue = [];

//             this.worker.onmessage = this.handleWorkerMessage.bind(this);

//             EmbeddingWorker.instance = this;
//         }
//         return EmbeddingWorker.instance;
//     }

//     // handleWorkerMessage(e) {
//     //     const { type, data, fileId } = e.data;
//     //     if (type === 'ready') {
//     //         this.isReady = true;
//     //         this.processQueuedTasks();
//     //     } else if (type === 'embeddingsResult') {
//     //         const task = this.taskQueue.find(t => t.fileId === fileId);
//     //         if (task) {
//     //             task.resolve(data); // Resolve with the full embeddings array
//     //             this.taskQueue = this.taskQueue.filter(t => t.fileId !== fileId);
//     //         }
//     //     } else if (type === 'error') {
//     //         const task = this.taskQueue.find(t => t.fileId === fileId);
//     //         if (task) {
//     //             task.reject(new Error(data));
//     //             this.taskQueue = this.taskQueue.filter(t => t.fileId !== fileId);
//     //         }
//     //     }
//     // }
//     handleWorkerMessage(e) {
//         const { type, data, fileId } = e.data;
//         if (type === 'ready') {
//             this.isReady = true;
//             this.processQueuedTasks();
//         } else if (type === 'embeddingsResult') {
//             const task = this.taskQueue.find(t => t.fileId === fileId);
//             if (task) {
//                 console.log(`Resolving task for fileId: ${fileId}`);
//                 task.resolve(data); // Resolve with the full embeddings array
//                 this.taskQueue = this.taskQueue.filter(t => t.fileId !== fileId); // Remove the task from the queue
//             } else {
//                 console.error(`Task not found for fileId: ${fileId}`);
//             }
//         } else if (type === 'error') {
//             const task = this.taskQueue.find(t => t.fileId === fileId);
//             if (task) {
//                 console.error(`Rejecting task for fileId: ${fileId}`);
//                 task.reject(new Error(data)); // Reject with the error message
//                 this.taskQueue = this.taskQueue.filter(t => t.fileId !== fileId);
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
//         console.log("i am text in embeddingworker", text, typeof text)
//         return new Promise((resolve, reject) => {
//             this.taskQueue.push({ text, fileId, resolve, reject });
//             if (this.isReady) {
//                 this.processQueuedTasks();
//             }
//         });
//     }
//     processQueuedTasks() {
//         while (this.taskQueue.length > 0) {
//             const task = this.taskQueue.shift(); // Remove the task from the queue
//             console.log("i am fileId", task.fileId)
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
            const task = this.pendingTasks[fileId];
            if (task) {
                console.log(`Resolving task for fileId: ${fileId}`);
                task.resolve(data); // Resolve the promise with the embeddings data
                delete this.pendingTasks[fileId]; // Remove from pendingTasks
            } else {
                console.error(`Task not found for fileId: ${fileId}`);
            }
        } else if (type === 'error') {
            const task = this.pendingTasks[fileId];
            if (task) {
                console.error(`Rejecting task for fileId: ${fileId}`);
                task.reject(new Error(data)); // Reject the promise with the error
                delete this.pendingTasks[fileId];
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
        console.log("Generating embeddings for fileId:", fileId);
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
            const task = this.taskQueue.shift(); // Remove the task from the queue
            this.pendingTasks[task.fileId] = task; // Add to pendingTasks
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
