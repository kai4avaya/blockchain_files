// memory\local\backup.ts
  const backupWorker = new Worker('../../workers/backup_worker');

function backupInstance(instanceName: string) {
  backupWorker.postMessage({ action: 'backup', instanceName });
}

function restoreInstance(instanceName: string) {
  backupWorker.postMessage({ action: 'restore', instanceName });
}

backupWorker.onmessage = (event) => {
  const { action, status, message } = event.data;
  if (status === 'success') {
    console.log(`${action} completed successfully.`);
  } else {
    console.error(`${action} failed: ${message}`);
  }
};
