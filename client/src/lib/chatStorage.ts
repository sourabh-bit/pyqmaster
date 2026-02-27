/**
 * IndexedDB Storage Utility for Chat Messages
 * 
 * Provides async functions to store chat messages in IndexedDB
 * instead of localStorage to avoid the 5MB limit.
 * 
 * Database: secure_chat_db
 * Object Store: messages_store
 */

const DB_NAME = 'secure_chat_db';
const STORE_NAME = 'messages_store';
const DB_VERSION = 1;

let idbDatabase: IDBDatabase | null = null;

/**
 * Open IndexedDB connection
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (idbDatabase) {
    return idbDatabase;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[ChatStorage] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      idbDatabase = request.result;
      resolve(idbDatabase);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save chat messages to IndexedDB
 * @param key - Storage key (e.g., 'chat_messages', 'chat_messages_admin', 'chat_messages_friend')
 * @param data - Stringified JSON data to store
 */
export async function saveChatMessages(key: string, data: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, value: data });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load chat messages from IndexedDB
 * @param key - Storage key (e.g., 'chat_messages', 'chat_messages_admin', 'chat_messages_friend')
 * @returns Stringified JSON data or empty array string '[]' if not found
 */
export async function loadChatMessages(key: string): Promise<string> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result;
      if (result && result.value) {
        resolve(result.value);
      } else {
        resolve('[]');
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear chat messages from IndexedDB
 * @param key - Storage key to delete
 */
export async function clearChatMessages(key: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
