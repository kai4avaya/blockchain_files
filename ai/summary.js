// const worker = new Worker('../worker/summary_worker.js');

// export function summarizeText(text_to_summarize, fileId, fileName) {
//     worker.onmessage = function(e) {
//     const { summary, keywords } = e.data;
//     console.log('Summary:', summary);
//     console.log('Keywords:', keywords);
//     };
//     worker.postMessage({ text: text_to_summarize });
// }



const summaryWorker = new Worker('../workers/summary_worker.js');
const dbWorker = new Worker('../workers/memory_worker.js');

const SUMMARY_DB_NAME = 'summaryAndTopicsDB';  // New database name

export function summarizeText(text_to_summarize, fileId, fileName) {
    summaryWorker.onmessage = function(e) {
        const { summary, keywords } = e.data;
        console.log('Summary:', summary);
        console.log('Keywords:', keywords);

        // Save summary to IndexedDB using the dbWorker
        dbWorker.postMessage({
            id: 'saveSummary',
            action: 'saveData',
            data: {
                storeName: 'summaries',
                data: {
                    id: fileId,
                    fileName: fileName,
                    summary: summary,
                    timestamp: Date.now()
                },
                dbName: SUMMARY_DB_NAME
            }
        });

        // Save keywords to IndexedDB using the dbWorker
        dbWorker.postMessage({
            id: 'saveKeywords',
            action: 'saveData',
            data: {
                storeName: 'topics',
                data: {
                    id: fileId,
                    fileName: fileName,
                    keywords: keywords,
                    timestamp: Date.now()
                },
                dbName: SUMMARY_DB_NAME
            }
        });
    };

    summaryWorker.postMessage({ text: text_to_summarize, fileId, fileName });
}

// Set up listener for dbWorker responses
dbWorker.onmessage = function(event) {
    const { id, data, error } = event.data;
    if (error) {
        console.error(`Error in operation ${id}:`, error);
    } else {
        console.log(`Operation ${id} completed:`, data);
    }
};

// Function to initialize the database
export function initializeSummaryDB() {
    dbWorker.postMessage({
        id: 'initDB',
        action: 'initializeDB',
        data: {
            storeNames: ['summaries', 'topics'],
            dbName: SUMMARY_DB_NAME  // Specify the new database name
        }
    });
}

// Call this when your application starts
initializeSummaryDB();