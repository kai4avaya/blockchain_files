// workers\backup_worker.ts
import indexDBOverlay from '../memory/local/file_worker'
import config from '../configs/config.json'
async function backupDatabase(instanceName: string) {
    const dbData: { [storeName: string]: any[] } = {};
  
    for (const storeName of Object.keys(config.dbStores)) {
      const data = await indexDBOverlay.getData(storeName);
      dbData[storeName] = data;
    }
  
    // Compress the data (e.g., using LZString)
    const compressedData = LZString.compress(JSON.stringify(dbData));
  
    // Store in localStorage
    localStorage.setItem(instanceName, compressedData);
  }
  

  async function restoreDatabase(instanceName: string) {
    const compressedData = localStorage.getItem(instanceName);
    if (!compressedData) {
      console.error('No backup found for this instance.');
      return;
    }
  
    const dbData = JSON.parse(LZString.decompress(compressedData));
  
    for (const [storeName, dataArray] of Object.entries(dbData)) {
      for (const data of dataArray) {
        await indexDBOverlay.saveData(storeName, data);
      }
    }
  }

  