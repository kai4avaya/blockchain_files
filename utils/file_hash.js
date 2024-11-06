// utils\file_hash.js

export const FileHashTracker = (function () {
  let instance;

  class HashTracker {
    constructor() {
      if (instance) {
        return instance;
      }

      instance = this;
      this.hashMap = new Map();
      this.titleMap = new Set();
    }

    // Simple filename check without file reading
    hasFileName(filename) {
      return this.titleMap.has(filename);
    }

    // Record a new filename and hash
    recordFile(filename, hash) {
      this.titleMap.add(filename);
      this.hashMap.set(hash, {
        filename,
        timestamp: Date.now(),
      });
    }

    // Quick check before file processing
    shouldProcessFile(filename) {
      if (this.hasFileName(filename)) {
        console.warn(`File "${filename}" already exists`);
        return false;
      }
      return true;
    }

    // After successful IndexDB save, record the file
    async recordSuccessfulFile(file, hash) {
      this.recordFile(file.name, hash);
      return true;
    }

    // Clear tracking
    clear() {
      this.hashMap.clear();
      this.titleMap.clear();
    }

    // Check if filename already exists
    hasTitle(filename) {
      return {
        exists: this.titleMap.has(filename),
        filename,
      };
    }

    // Add a filename to tracking
    addTitle(filename) {
      if (this.titleMap.has(filename)) {
        return false;
      }
      this.titleMap.add(filename);
      return true;
    }

    // Remove a filename from tracking
    removeTitle(filename) {
      return this.titleMap.delete(filename);
    }

    async createHash(data) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // New method to hash any input
    async hashString(input) {
      try {
        // Convert input to string if it's not already
        const stringToHash =
          typeof input === "string" ? input : JSON.stringify(input);

        const encoder = new TextEncoder();
        const data = encoder.encode(stringToHash);
        const hash = await this.createHash(data);

        return {
          success: true,
          hash,
          originalType: typeof input,
          inputLength: stringToHash.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          input,
        };
      }
    }

    async processFile(file) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hash = await this.createHash(arrayBuffer);

        const isDuplicate = this.hashMap.has(hash);
        const fileInfo = {
          filename: file.name,
          timestamp: Date.now(),
          size: file.size,
        };

        if (isDuplicate) {
          const original = this.hashMap.get(hash);
          this.notifyDuplicate(fileInfo, original, hash);
          return { isDuplicate: true, hash, original, duplicate: fileInfo };
        }

        this.hashMap.set(hash, fileInfo);
        return { isDuplicate: false, hash, fileInfo };
      } catch (error) {
        console.error("Error processing file:", error);
        throw new Error(`File processing failed: ${error.message}`);
      }
    }

    async processContent(content) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hash = await this.createHash(data);

        const isDuplicate = this.hashMap.has(hash);
        const contentInfo = {
          filename: "content-" + Date.now(),
          timestamp: Date.now(),
          size: data.length,
        };

        if (isDuplicate) {
          const original = this.hashMap.get(hash);
          return { isDuplicate: true, hash, original };
        }

        this.hashMap.set(hash, contentInfo);
        return { isDuplicate: false, hash, contentInfo };
      } catch (error) {
        console.error("Error processing content:", error);
        throw new Error(`Content processing failed: ${error.message}`);
      }
    }
    async checkFileUnique(file) {
      if (this.titleMap.has(file.name)) {
        return {
          isUnique: false,
          reason: "filename",
          filename: file.name,
        };
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hash = await this.createHashWithFilename(arrayBuffer, file.name);

        if (this.hashMap.has(hash)) {
          const original = this.hashMap.get(hash);
          return {
            isDuplicate: true,
            hash,
            original,
            duplicate: {
              filename: file.name,
              size: file.size,
            },
          };
        }

        // Store the hash immediately if it's not a duplicate
        const fileInfo = {
          filename: file.name,
          timestamp: Date.now(),
          size: file.size,
        };

        this.hashMap.set(hash, fileInfo);
        return {
          isDuplicate: false,
          hash,
          fileInfo,
        };
      } catch (error) {
        console.error("Error checking file:", error);
        throw new Error(`File check failed: ${error.message}`);
      }
    }

    async createHashWithFilename(data, filename) {
      // Combine filename with content for unique hash
      const encoder = new TextEncoder();
      const filenameData = encoder.encode(filename);

      // Concatenate the arrays
      const combinedData = new Uint8Array([
        ...filenameData,
        ...new Uint8Array(data),
      ]);

      return this.createHash(combinedData);
    }

    checkDuplicateFilenames(fileList) {
        if (!fileList) return { validFiles: [], duplicates: [] };

        const validFiles = [];
        const duplicates = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (this.titleMap.has(file.name)) {
                duplicates.push({
                    file,
                    original: {
                        filename: file.name
                    }
                });
            } else {
                this.titleMap.add(file.name);
                validFiles.push(file);
            }
        }

        return { validFiles, duplicates };
    }



    deleteHash(hash) {
      if (!this.hashMap.has(hash)) {
        return {
          success: false,
          message: "Hash not found",
          hash,
        };
      }

      const deletedInfo = this.hashMap.get(hash);
      const deleted = this.hashMap.delete(hash);

      return {
        success: deleted,
        message: deleted
          ? "Hash deleted successfully"
          : "Failed to delete hash",
        hash,
        deletedInfo,
      };
    }

    removeFilename(filename) {
        this.titleMap.delete(filename);
    }

    notifyDuplicate(newFile, originalFile, hash) {
      window.dispatchEvent(
        new CustomEvent("hashDuplicate", {
          detail: {
            original: originalFile,
            duplicate: newFile,
            hash,
          },
        })
      );
    }

    getAllHashes() {
      return Array.from(this.hashMap.entries())
        .map(([hash, data]) => ({
          hash,
          ...data,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    getHash(hash) {
      const info = this.hashMap.get(hash);
      return info
        ? { success: true, hash, info }
        : { success: false, hash, message: "Hash not found" };
    }

    hasHash(hash) {
      return {
        exists: this.hashMap.has(hash),
        hash,
        info: this.hashMap.get(hash) || null,
      };
    }

    clearHashes() {
      const count = this.hashMap.size;
      this.hashMap.clear();
      return {
        success: true,
        message: `Cleared ${count} hashes`,
        count,
      };
    }

    formatSize(bytes) {
      const units = ["B", "KB", "MB", "GB"];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
  }

  return {
    getInstance: function () {
      if (!instance) {
        instance = new HashTracker();
      }
      return instance;
    },
  };
})();

// Optimized filterDuplicateFiles function
export async function filterUniqueFiles(fileList) {
  if (!fileList) return { validFiles: [], duplicates: [] };

  const hashTracker = FileHashTracker.getInstance();
  const validFiles = [];
  const duplicates = [];

  for (const file of fileList) {
    const checkResult = await hashTracker.checkFileUnique(file);

    if (checkResult.isUnique) {
      validFiles.push(file);
      await hashTracker.addFile(file);
    } else {
      duplicates.push({
        file,
        reason: checkResult.reason,
        original: checkResult.original,
      });
    }
  }

  return { validFiles, duplicates };
}


  
export function quickCheckFiles(fileList) {
    const hashTracker = FileHashTracker.getInstance();
    const validFiles = [];
    const duplicates = [];

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (hashTracker.shouldProcessFile(file.name)) {
            validFiles.push(file);
        } else {
            duplicates.push(file);
        }
    }

    return { validFiles, duplicates };
}


export function filterDuplicateFiles(fileList) {
    const hashTracker = FileHashTracker.getInstance();
    return hashTracker.checkDuplicateFilenames(fileList);
}