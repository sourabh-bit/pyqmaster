/**
 * BLACKBOX PATCH: Transparent localStorage to IndexedDB Migration
 * 
 * This patch intercepts localStorage operations for chat_messages keys
 * and redirects them to IndexedDB to avoid the 5MB localStorage limit.
 * 
 * Strategy:
 * - Keep localStorage synchronous
 * - Store actual data in IndexedDB
 * - Store a small marker "__IDB__" in localStorage to indicate data is in IndexedDB
 * - Expose async function to load data from IndexedDB
 * 
 * Paste this at the top of main.tsx or App.tsx BEFORE the app renders.
 */

(function() {
  'use strict';

  const DB_NAME = 'secure_chat_db';
  const STORE_NAME = 'messages_store';
  const DB_VERSION = 1;
  const IDB_MARKER = '__IDB__';

  // Store IndexedDB reference
  let idbDatabase: IDBDatabase | null = null;

  // Open IndexedDB
  function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (idbDatabase) {
        resolve(idbDatabase);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[ChatStoragePatch] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        idbDatabase = request.result;
        console.log('[ChatStoragePatch] IndexedDB opened successfully');
        resolve(idbDatabase);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          console.log('[ChatStoragePatch] Object store created');
        }
      };
    });
  }

  // Save to IndexedDB
  async function saveToIDB(key: string, value: string): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Read from IndexedDB
  async function readFromIDB(key: string): Promise<string | null> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Delete from IndexedDB
  async function deleteFromIDB(key: string): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Check if key should be intercepted
  function shouldIntercept(key: string): boolean {
    return key.startsWith('chat_messages');
  }

  // Migrate localStorage data to IndexedDB (one-time)
  async function migrateFromLocalStorage(): Promise<void> {
    try {
      const migrationKey = '__chat_storage_migrated';
      const migrated = localStorage.getItem(migrationKey);
      if (migrated === 'true') {
        console.log('[ChatStoragePatch] Migration already completed');
        return;
      }

      console.log('[ChatStoragePatch] Starting migration from localStorage...');

      // Find all chat_messages keys in localStorage
      const keysToMigrate: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && shouldIntercept(key)) {
          keysToMigrate.push(key);
        }
      }

      // Migrate each key
      for (const key of keysToMigrate) {
        const value = localStorage.getItem(key);
        if (value && value !== IDB_MARKER) {
          // Save to IndexedDB
          await saveToIDB(key, value);
          // Replace localStorage with marker
          localStorage.setItem(key, IDB_MARKER);
          console.log(`[ChatStoragePatch] Migrated: ${key}`);
        }
      }

      // Mark migration as complete
      localStorage.setItem(migrationKey, 'true');
      console.log(`[ChatStoragePatch] Migration complete. Migrated ${keysToMigrate.length} keys.`);
    } catch (error) {
      console.error('[ChatStoragePatch] Migration failed:', error);
    }
  }

  // Override localStorage.setItem for chat_messages* keys
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key: string, value: string): void {
    if (shouldIntercept(key)) {
      // Save to IndexedDB (async, but don't wait)
      saveToIDB(key, value).catch(err => {
        console.error(`[ChatStoragePatch] Failed to save ${key} to IDB:`, err);
        // Fallback to localStorage
        originalSetItem(key, value);
      });
      // Store marker in localStorage
      originalSetItem(key, IDB_MARKER);
    } else {
      originalSetItem(key, value);
    }
  };

  // Override localStorage.getItem for chat_messages* keys
  const originalGetItem = localStorage.getItem.bind(localStorage);
  localStorage.getItem = function(key: string): string | null {
    if (shouldIntercept(key)) {
      const localValue = originalGetItem(key);
      // If marker exists, data is in IndexedDB
      if (localValue === IDB_MARKER) {
        // Return empty string to indicate data exists but is in IDB
        // The app should use __loadChatMessagesFromIDB to get actual data
        return '[]';
      }
      return localValue;
    }
    return originalGetItem(key);
  };

  // Override localStorage.removeItem for chat_messages* keys
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = function(key: string): void {
    if (shouldIntercept(key)) {
      // Delete from IndexedDB (async, but don't wait)
      deleteFromIDB(key).catch(err => {
        console.error(`[ChatStoragePatch] Failed to delete ${key} from IDB:`, err);
      });
    }
    originalRemoveItem(key);
  };

  // Global function to load chat messages from IndexedDB
  // Usage: await window.__loadChatMessagesFromIDB('chat_messages')
  // Or: await window.__loadChatMessagesFromIDB('chat_messages_admin')
  (window as any).__loadChatMessagesFromIDB = async function(key: string): Promise<string | null> {
    if (!key) {
      key = 'chat_messages';
    }
    try {
      const value = await readFromIDB(key);
      if (value !== null) {
        return value;
      }
      // Fallback: check localStorage
      const localValue = originalGetItem(key);
      if (localValue && localValue !== IDB_MARKER) {
        return localValue;
      }
      return null;
    } catch (error) {
      console.error(`[ChatStoragePatch] Failed to load ${key} from IDB:`, error);
      // Fallback to localStorage
      const localValue = originalGetItem(key);
      return (localValue && localValue !== IDB_MARKER) ? localValue : null;
    }
  };

  // Initialize: run migration on load
  migrateFromLocalStorage().then(() => {
    console.log('[ChatStoragePatch] Initialization complete');
  }).catch((error) => {
    console.error('[ChatStoragePatch] Initialization error:', error);
  });

  console.log('[ChatStoragePatch] Blackbox patch loaded');
})();
