const DB_NAME = 'manga-upload-queue'
const STORE = 'queue'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface StoredQueueItem {
  id: number
  storyId: string
  chapterNumber: number
  title: string
  files: File[]
  status: string
}

export async function loadQueue(): Promise<StoredQueueItem[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const all: StoredQueueItem[] = await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()

    return all.filter(item => {
      if (item.status === 'done' || item.status === 'exists') return false
      return true
    }).map(item => ({
      ...item,
      status: item.status === 'creating' || item.status === 'uploading' ? 'error' : item.status,
    }))
  } catch {
    return []
  }
}

export async function saveQueue(items: StoredQueueItem[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)

    await new Promise<void>((resolve, reject) => {
      const clear = store.clear()
      clear.onerror = () => reject(clear.error)
      clear.onsuccess = () => {
        let remaining = items.length
        if (remaining === 0) { resolve(); return }
        for (const item of items) {
          const put = store.put(item)
          put.onerror = () => reject(put.error)
          put.onsuccess = () => {
            remaining--
            if (remaining === 0) resolve()
          }
        }
      }
    })

    db.close()
  } catch {
    // silently fail — storage is best-effort
  }
}

export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    db.close()
  } catch {
    // silently fail
  }
}
