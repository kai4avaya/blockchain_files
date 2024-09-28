// TextProcessorWorker.js
class TextProcessorWorker {
    constructor() {
        if (!TextProcessorWorker.instance) {
            this.worker = new Worker(new URL('../workers/text_processor_worker.js', import.meta.url), { type: 'module' });
            this.taskQueue = [];
            this.isProcessing = false;

            this.worker.onmessage = (e) => {
                const { type, data, fileId } = e.data;
                if (type === 'processedText') {
                    this.onTextProcessed(fileId, data);
                } else if (type === 'error') {
                    console.error('Text processing error:', data);
                    this.onProcessingError(fileId, data);
                }
                this.processNextTask();
            };

            TextProcessorWorker.instance = this;
        }
        return TextProcessorWorker.instance;
    }

    processText(content, fileType, fileId) {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ content, fileType, fileId, resolve, reject });
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
        const { content, fileType, fileId, resolve, reject } = this.taskQueue.shift();

        this.worker.postMessage({
            type: 'processText',
            data: content,
            fileType: fileType,
            fileId: fileId
        });

        this.currentTask = { fileId, resolve, reject };
    }

    onTextProcessed(fileId, processedText) {
        if (this.currentTask && this.currentTask.fileId === fileId) {
            this.currentTask.resolve(processedText);
            this.currentTask = null;
        }
    }

    onProcessingError(fileId, error) {
        if (this.currentTask && this.currentTask.fileId === fileId) {
            this.currentTask.reject(new Error(error));
            this.currentTask = null;
        }
    }
}

const textProcessorWorker = new TextProcessorWorker();
export default textProcessorWorker;