
import { openDB, IDBPDatabase } from 'idb';
import { FileMetadata } from '../types';

const DB_NAME = 'rayan-meta-db';
const STORE_NAME = 'file-metadata';

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Retrieves file metadata from IndexedDB asynchronously.
 */
export const getFileMetadata = async (path: string): Promise<FileMetadata | undefined> => {
  try {
      const db = await getDb();
      return await db.get(STORE_NAME, path);
  } catch (e) {
      console.warn('Error fetching metadata from IDB', e);
      return undefined;
  }
};

/**
 * Saves file metadata to IndexedDB asynchronously.
 */
export const saveFileMetadata = async (metadata: FileMetadata): Promise<void> => {
  try {
      const db = await getDb();
      await db.put(STORE_NAME, metadata);
  } catch (e) {
      console.warn('Error saving metadata to IDB', e);
  }
};

/**
 * Clears the entire metadata cache.
 */
export const clearMetadataCache = async (): Promise<void> => {
   const db = await getDb();
   await db.clear(STORE_NAME);
};
