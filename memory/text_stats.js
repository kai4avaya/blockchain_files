import indexDBOverlay from './local/file_worker';
import { generateVersionNonce, generateGlobalTimestamp } from '../utils/utils';

let textStatsWorker;
let workerIdleTimeout;

class TextStatsManager {
  constructor() {
    this.workerTasks = new Map();
    this.tableName = 'text_stats';
  }

  initializeWorker() {
    if (!textStatsWorker) {
      textStatsWorker = new Worker("../workers/text_stats_worker.js");
      
      textStatsWorker.onmessage = (event) => {
        const { taskId, stats, error } = event.data;
        
        if (error) {
          this.rejectTask(taskId, error);
        } else {
          this.resolveTask(taskId, stats);
        }
        
        // Reset idle timeout
        clearTimeout(workerIdleTimeout);
        workerIdleTimeout = setTimeout(() => this.terminateWorker(), 30000);
      };
    }
  }

  terminateWorker() {
    if (textStatsWorker) {
      textStatsWorker.terminate();
      textStatsWorker = null;
      clearTimeout(workerIdleTimeout);
    }
  }

  resolveTask(taskId, result) {
    const task = this.workerTasks.get(taskId);
    if (task) {
      task.resolve(result);
      this.workerTasks.delete(taskId);
    }
  }

  rejectTask(taskId, error) {
    const task = this.workerTasks.get(taskId);
    if (task) {
      task.reject(error);
      this.workerTasks.delete(taskId);
    }
  }

  async processTextStats(text, fileId) {
    this.initializeWorker();
    
    console.log('Sending text to worker:', { fileId, textLength: text.length });
    
    const taskId = `${fileId}-${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      this.workerTasks.set(taskId, { resolve, reject });
      
      textStatsWorker.postMessage({
        taskId,
        text,
        fileId
      });
    });
  }

  async saveTextStats(fileId, stats) {
    try {
      console.log('Saving text stats:', { fileId, stats });
      
      const textStatsData = {
        fileId,
        ...stats,
        lastUpdated: Date.now(),
        version: 1,
        versionNonce: generateVersionNonce(),
        globalTimestamp: generateGlobalTimestamp(),
        lastEditedBy: localStorage.getItem('login_block') || 'no_login',
        isDeleted: false
      };

      await indexDBOverlay.saveData('text_stats', textStatsData);
      console.log('Text stats saved successfully');
      
    } catch (error) {
      console.error('Error saving text stats:', error);
      throw error;
    }
  }

  // Helper method to retrieve stats for a file
  async getTextStats(fileId) {
    try {
      return await indexDBOverlay.getItem(this.tableName, fileId);
    } catch (error) {
      console.error('Error retrieving text stats:', error);
      return null;
    }
  }
}

export const textStats = new TextStatsManager(); 