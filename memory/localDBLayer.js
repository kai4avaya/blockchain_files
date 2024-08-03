const DB_NAME = 'MyAppDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('data', { keyPath: 'id' });
    };
  });
}

async function saveData(data) {
  const db = await openDB();
  const transaction = db.transaction(['data'], 'readwrite');
  const store = transaction.objectStore('data');
  await store.put(data);
}

async function getData(id) {
  const db = await openDB();
  const transaction = db.transaction(['data'], 'readonly');
  const store = transaction.objectStore('data');
  return store.get(id);
}
