// ai\summary.js

const summaryWorker = new Worker(new URL('../workers/summary_worker.js', import.meta.url), { type: 'module' });
const dbWorker = new Worker(new URL('../workers/memory_worker.js', import.meta.url), { type: 'module' });

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
            
            // Make sure to remove the event listener before resolving
            summaryWorker.removeEventListener('message', messageHandler);
            resolve({ summary, keywords });
        };

        summaryWorker.addEventListener('message', messageHandler);
        
        // Send only the first 1000 words if not already limited
        const limitedText = text_to_summarize.split(/\s+/).slice(0, 1000).join(' ');
        summaryWorker.postMessage({ text: limitedText, fileId, fileName });
        
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

dbWorker.onerror = (e) => {
    console.error('Worker error:', e);
    console.error('Error message:', e.message);
    console.error('Error filename:', e.filename);
    console.error('Error lineno:', e.lineno);
    console.error('Error stack:', e.error ? e.error.stack : 'No stack available');
};
