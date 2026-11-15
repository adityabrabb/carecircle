/**
 * Firestore storage.
 *
 * Purpose: a Store backed by Google Cloud Firestore. Profiles are
 * top-level documents; every other record sits in a sub-collection of
 * its profile, so each read is scoped to one family and needs no
 * composite index. On Cloud Run the client signs in with the service
 * account automatically.
 */
import { Firestore } from '@google-cloud/firestore';
import type {
   CareProfile,
   CollectionMap,
   CollectionName,
} from '@/domain/types';
import { COLLECTION_NAMES, type Store } from '@/store/store';

const PROFILES = 'profiles';

/** Firestore accepts at most 500 writes in one batch. */
const BATCH_LIMIT = 400;

/** Firestore accepts at most 30 values in one "in" filter. */
const IN_LIMIT = 30;

export class FirestoreStore implements Store {
   private readonly db: Firestore;

   constructor() {
      this.db = new Firestore({ ignoreUndefinedProperties: true });
   }

   /** Purpose: reference to a sub-collection of one profile. */
   private sub(collection: CollectionName, profileId: string) {
      return this.db
         .collection(PROFILES)
         .doc(profileId)
         .collection(collection);
   }

   async getProfile(id: string): Promise<CareProfile | null> {
      const snapshot = await this.db.collection(PROFILES).doc(id).get();
      return snapshot.exists ? (snapshot.data() as CareProfile) : null;
   }

   async getProfileByCode(circleCode: string): Promise<CareProfile | null> {
      const snapshot = await this.db
         .collection(PROFILES)
         .where('circleCode', '==', circleCode)
         .limit(1)
         .get();
      const first = snapshot.docs[0];
      return first ? (first.data() as CareProfile) : null;
   }

   async listProfiles(): Promise<CareProfile[]> {
      const snapshot = await this.db.collection(PROFILES).get();
      return snapshot.docs.map((doc) => doc.data() as CareProfile);
   }

   async putProfile(profile: CareProfile): Promise<void> {
      await this.db.collection(PROFILES).doc(profile.id).set(profile);
   }

   async deleteProfile(id: string): Promise<void> {
      for (const collection of COLLECTION_NAMES) {
         const snapshot = await this.sub(collection, id).get();
         for (let start = 0; start < snapshot.docs.length; start += BATCH_LIMIT) {
            const batch = this.db.batch();
            for (const doc of snapshot.docs.slice(start, start + BATCH_LIMIT)) {
               batch.delete(doc.ref);
            }
            await batch.commit();
         }
      }
      await this.db.collection(PROFILES).doc(id).delete();
   }

   async get<K extends CollectionName>(
      collection: K,
      profileId: string,
      id: string,
   ): Promise<CollectionMap[K] | null> {
      const snapshot = await this.sub(collection, profileId).doc(id).get();
      return snapshot.exists ? (snapshot.data() as CollectionMap[K]) : null;
   }

   async list<K extends CollectionName>(
      collection: K,
      profileId: string,
   ): Promise<CollectionMap[K][]> {
      const snapshot = await this.sub(collection, profileId).get();
      return snapshot.docs.map((doc) => doc.data() as CollectionMap[K]);
   }

   async listIn<K extends CollectionName>(
      collection: K,
      profileId: string,
      field: keyof CollectionMap[K] & string,
      values: readonly string[],
   ): Promise<CollectionMap[K][]> {
      if (values.length === 0) {
         return [];
      }
      const found: CollectionMap[K][] = [];
      for (let start = 0; start < values.length; start += IN_LIMIT) {
         const snapshot = await this.sub(collection, profileId)
            .where(field, 'in', values.slice(start, start + IN_LIMIT))
            .get();
         for (const doc of snapshot.docs) {
            found.push(doc.data() as CollectionMap[K]);
         }
      }
      return found;
   }

   async put<K extends CollectionName>(
      collection: K,
      record: CollectionMap[K],
   ): Promise<void> {
      await this.sub(collection, record.profileId).doc(record.id).set(record);
   }

   async putMany<K extends CollectionName>(
      collection: K,
      records: readonly CollectionMap[K][],
   ): Promise<void> {
      for (let start = 0; start < records.length; start += BATCH_LIMIT) {
         const batch = this.db.batch();
         for (const record of records.slice(start, start + BATCH_LIMIT)) {
            batch.set(
               this.sub(collection, record.profileId).doc(record.id),
               record,
            );
         }
         await batch.commit();
      }
   }

   async remove<K extends CollectionName>(
      collection: K,
      profileId: string,
      id: string,
   ): Promise<void> {
      await this.sub(collection, profileId).doc(id).delete();
   }
}
