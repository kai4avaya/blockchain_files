class AIWorkerPool {
  constructor(poolSize = 4) {
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = new Map();
    
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker('path/to/ai_worker.js');
      this.workers.push(worker);
    }
  }

  async processRequest(modelId, messages, options = {}) {
    return new Promise((resolve, reject) => {
      const task = {
        modelId,
        messages,
        options,
        resolve,
        reject
      };

      if (this.hasAvailableWorker()) {
        this.assignTaskToWorker(task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  hasAvailableWorker() {
    return this.workers.some(worker => !this.activeWorkers.has(worker));
  }

  assignTaskToWorker(task) {
    const availableWorker = this.workers.find(worker => !this.activeWorkers.has(worker));
    if (!availableWorker) return;

    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'stream') {
        task.options.onStream?.(event.data.chunk);
      } else if (event.data.type === 'complete') {
        this.completeTask(availableWorker, task, event.data.result);
      } else if (event.data.type === 'error') {
        this.handleTaskError(availableWorker, task, event.data.error);
      }
    };

    this.activeWorkers.set(availableWorker, task);
    availableWorker.postMessage({
      modelId: task.modelId,
      messages: task.messages,
      options: task.options
    }, [messageChannel.port2]);
  }

  completeTask(worker, task, result) {
    this.activeWorkers.delete(worker);
    task.resolve(result);
    this.processNextTask();
  }

  handleTaskError(worker, task, error) {
    this.activeWorkers.delete(worker);
    task.reject(error);
    this.processNextTask();
  }

  processNextTask() {
    if (this.taskQueue.length > 0 && this.hasAvailableWorker()) {
      const nextTask = this.taskQueue.shift();
      this.assignTaskToWorker(nextTask);
    }
  }
}
