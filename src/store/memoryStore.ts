/**
 * In-memory storage.
 *
 * Purpose: a Store that keeps everything in process memory. Used for
 * local development and unit tests, where no database is available.
 * Records are copied on the way in and out so callers cannot change
 * stored data by accident.
 */
import type {
   CareProfile,
   CollectionMap,
   CollectionName,
} from '@/domain/types';
import { COLLECTION_NAMES, type Store } from '@/store/store';

type RecordTable = Map<string, { id: string; profileId: string }>;

/** Purpose: deep copy of a plain record. */
function copy<T>(value: T): T {
   return structuredClone(value);
}

export class MemoryStore implements Store {
   private readonly profiles = new Map<string, CareProfile>();
   private readonly tables = new Map<CollectionName, RecordTable>();

   /** Purpose: the table for a collection, created on first use. */
   private table(collection: CollectionName): RecordTable {
      let table = this.tables.get(collection);
      if (!table) {
         table = new Map();
         this.tables.set(collection, table);
      }
      return table;
   }

   /** Purpose: key that keeps each profile's records apart. */
   private static key(profileId: string, id: string): string {
      return `${profileId}/${id}`;
   }

   async getProfile(id: string): Promise<CareProfile | null> {
      const profile = this.profiles.get(id);
      return profile ? copy(profile) : null;
   }

   async getProfileByCode(circleCode: string): Promise<CareProfile | null> {
      for (const profile of this.profiles.values()) {
         if (profile.circleCode === circleCode) {
            return copy(profile);
         }
      }
      return null;
   }

   async listProfiles(): Promise<CareProfile[]> {
      return [...this.profiles.values()].map(copy);
   }

   async putProfile(profile: CareProfile): Promise<void> {
      this.profiles.set(profile.id, copy(profile));
   }

   async deleteProfile(id: string): Promise<void> {
      this.profiles.delete(id);
      for (const collection of COLLECTION_NAMES) {
         const table = this.table(collection);
         for (const [key, record] of table) {
            if (record.profileId === id) {
               table.delete(key);
            }
         }
      }
   }

   async get<K extends CollectionName>(
      collection: K,
      profileId: string,
      id: string,
   ): Promise<CollectionMap[K] | null> {
      const record = this.table(collection).get(
         MemoryStore.key(profileId, id),
      );
      return record ? (copy(record) as CollectionMap[K]) : null;
   }

   async list<K extends CollectionName>(
      collection: K,
      profileId: string,
   ): Promise<CollectionMap[K][]> {
      const found: CollectionMap[K][] = [];
      for (const record of this.table(collection).values()) {
         if (record.profileId === profileId) {
            found.push(copy(record) as CollectionMap[K]);
         }
      }
      return found;
   }

   async listIn<K extends CollectionName>(
      collection: K,
      profileId: string,
      field: keyof CollectionMap[K] & string,
      values: readonly string[],
   ): Promise<CollectionMap[K][]> {
      const all = await this.list(collection, profileId);
      return all.filter((record) =>
         values.includes(String(record[field])),
      );
   }

   async put<K extends CollectionName>(
      collection: K,
      record: CollectionMap[K],
   ): Promise<void> {
      this.table(collection).set(
         MemoryStore.key(record.profileId, record.id),
         copy(record),
      );
   }

   async putMany<K extends CollectionName>(
      collection: K,
      records: readonly CollectionMap[K][],
   ): Promise<void> {
      for (const record of records) {
         await this.put(collection, record);
      }
   }

   async remove<K extends CollectionName>(
      collection: K,
      profileId: string,
      id: string,
   ): Promise<void> {
      this.table(collection).delete(MemoryStore.key(profileId, id));
   }
}
