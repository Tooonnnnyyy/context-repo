import type { Workspace } from '../types'

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('context-workspaces', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('spaces')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Browser storage is unavailable. Allow site storage to keep your notes on this device.'))
  })
}
export async function loadWorkspace(owner: string): Promise<Workspace | null> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('spaces', 'readonly'); const request = tx.objectStore('spaces').get(owner)
    request.onsuccess = () => resolve(request.result?.schema === 1 ? request.result : null)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}
export async function saveWorkspace(owner: string, workspace: Workspace): Promise<void> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('spaces', 'readwrite')
    tx.objectStore('spaces').put(workspace, owner)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(new Error('Your browser could not save this change. Export a backup before leaving.')) }
  })
}
