/**
 * Storage entry point.
 *
 * Purpose: hand out the single Store instance for this process, chosen
 * by the STORE_BACKEND setting. The instance is kept on globalThis so
 * the in-memory data survives hot reloads during development.
 */
import { firebaseCredentials, storeBackend } from '@/config/env';
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
      const backend = storeBackend();
      // ----- Say so loudly: a deployed host that meant to use Firestore
      // but never switched STORE_BACKEND loses every circle on restart.
      if (backend === 'memory' && firebaseCredentials()) {
         console.warn(
            'FIREBASE_CREDENTIALS is set but STORE_BACKEND is not "firestore", so data is kept in memory and resets on restart.',
         );
      }
      holder.careCircleStore =
         backend === 'firestore' ? new FirestoreStore() : new MemoryStore();
   }
   return holder.careCircleStore;
}

export type { Store } from '@/store/store';
