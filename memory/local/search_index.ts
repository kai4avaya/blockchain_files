export interface SearchIndex {
    keywords: Set<string>;
    summaries: Array<{
        fileId: string;
        fileName: string;
        summary: string;
        keywords: string[];
    }>;
    files: Array<{
        id: string;
        name: string;
        type: string;
    }>;
    fileMetadata: Map<string, any>;
}

// Update the global declaration
declare global {
    interface Window {
        globalSearchIndex: SearchIndex;
    }
}

export class SearchIndexManager {
    private static instance: SearchIndexManager;
    private searchIndex: SearchIndex = {
        keywords: new Set(),
        summaries: [],
        files: [],
        fileMetadata: new Map()
    };

    private constructor() {
        // Update window object with new name
        window.globalSearchIndex = this.searchIndex;
    }

    public static getInstance(): SearchIndexManager {
        if (!SearchIndexManager.instance) {
            SearchIndexManager.instance = new SearchIndexManager();
        }
        return SearchIndexManager.instance;
    }

    public async populateSearchIndex(indexDBOverlay: any): Promise<void> {
        try {
            // Get all summaries and files
            const summaries = await indexDBOverlay.getAll('summaries');
            const files = await indexDBOverlay.getAll('files');

            // Reset the search index
            this.searchIndex.keywords = new Set();
            this.searchIndex.summaries = [];
            this.searchIndex.files = [];
            this.searchIndex.fileMetadata.clear();

            // Process summaries
            summaries.forEach((summary: any) => {
                if (!summary.isDeleted) {
                    // Add summary with its associated file info
                    this.searchIndex.summaries.push({
                        fileId: summary.fileId,
                        fileName: summary.fileName,
                        summary: summary.summary,
                        keywords: Array.isArray(summary.keywords) ? summary.keywords : []
                    });

                    // Add keywords to the set
                    if (Array.isArray(summary.keywords)) {
                        summary.keywords.forEach((keyword: string) => {
                            this.searchIndex.keywords.add(keyword);
                        });
                    }
                }
            });

            // Process files
            files.forEach((file: any) => {
                if (!file.isDeleted) {
                    this.searchIndex.files.push({
                        id: file.id,
                        name: file.name,
                        type: file.fileType || file.type
                    });
                    this.searchIndex.fileMetadata.set(file.id, file);
                }
            });

            // Update window object with new name
            window.globalSearchIndex = this.searchIndex;
            
            console.log('Search index populated:', {
                keywordsCount: this.searchIndex.keywords.size,
                summariesCount: this.searchIndex.summaries.length,
                filesCount: this.searchIndex.files.length
            });
        } catch (error) {
            console.error('Error populating search index:', error);
            throw error;
        }
    }

    public updateIndex(data: any, type: 'summary' | 'file'): void {
        if (data.isDeleted) {
            return;
        }

        if (type === 'summary') {
            // Update summaries
            this.searchIndex.summaries.push({
                fileId: data.fileId,
                fileName: data.fileName,
                summary: data.summary,
                keywords: Array.isArray(data.keywords) ? data.keywords : []
            });

            // Update keywords
            if (Array.isArray(data.keywords)) {
                data.keywords.forEach((keyword: string) => {
                    this.searchIndex.keywords.add(keyword);
                });
            }
        } else if (type === 'file') {
            // Update files
            this.searchIndex.files.push({
                id: data.id,
                name: data.name,
                type: data.fileType || data.type
            });
            this.searchIndex.fileMetadata.set(data.id, data);
        }

        // Update window object with new name
        window.globalSearchIndex = this.searchIndex;
    }

    // Helper method to get summary by fileId
    public getSummaryByFileId(fileId: string) {
        return this.searchIndex.summaries.find(summary => summary.fileId === fileId);
    }

    // Helper method to get file by id
    public getFileById(fileId: string) {
        return this.searchIndex.files.find(file => file.id === fileId);
    }
}