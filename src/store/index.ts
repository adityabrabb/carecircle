/**
 * Storage entry point.
 *
 * Purpose: hand out the single Store instance for this process, chosen
 * by the STORE_BACKEND setting. The instance is kept on globalThis so
 * the in-memory data survives hot reloads during development.
 */
import { storeBackend } from '@/config/env';
import { FirestoreStore } from '@/store/firestoreStore';
import { MemoryStore } from '@/store/memoryStore';
import type { Store } from '@/store/store';

interface StoreHolder {
   careCircleStore?: Store;
}

/** Purpose: the shared Store, created on first use. */
export function getStore(): Store {
   const holder = globalThis as StoreHolder;
   if (!holder.careCircleStore) {
      holder.careCircleStore =
         storeBackend() === 'firestore'
            ? new FirestoreStore()
            : new MemoryStore();
   }
   return holder.careCircleStore;
}

export type { Store } from '@/store/store';
