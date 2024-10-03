const summaryWorker = new Worker(new URL('../workers/summary_worker.js', import.meta.url), { type: 'module' });
const dbWorker = new Worker('../workers/memory_worker.js');

export function summarizeText(text_to_summarize, fileId, fileName) {
    return new Promise((resolve, reject) => {
        
        const messageHandler = function(e) {
            
            if (e.data.error) {
                console.error("Worker error:", e.data.error);
                summaryWorker.removeEventListener('message', messageHandler);
                reject(new Error(e.data.error));
                return;
            }
            
            const { summary, keywords } = e.data;

            summaryWorker.removeEventListener('message', messageHandler);
            resolve({ summary, keywords });
        };

        summaryWorker.addEventListener('message', messageHandler);
        
        summaryWorker.postMessage({ text: text_to_summarize, fileId, fileName });
        
        // Add a timeout to prevent hanging
        setTimeout(() => {
            summaryWorker.removeEventListener('message', messageHandler);
            reject(new Error('Summary worker timed out'));
        }, 30000); // 30 seconds timeout
    });
}

// Set up listener for dbWorker responses
dbWorker.onmessage = function(event) {
    const { id, data, error } = event.data;
    if (error) {
        console.error(`Error in operation ${id}:`, error);
    } else {
    }
};
