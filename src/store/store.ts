/**
 * Storage contract.
 *
 * Purpose: the one interface the app uses to read and write records.
 * Every record other than the profile lives under its profile, so a
 * query can never return another family's data. Two backends implement
 * it: memory for local work and tests, Firestore on Cloud Run.
 */
import type {
   CareProfile,
   CollectionMap,
   CollectionName,
} from '@/domain/types';

export interface Store {
   getProfile(id: string): Promise<CareProfile | null>;
   getProfileByCode(circleCode: string): Promise<CareProfile | null>;
   listProfiles(): Promise<CareProfile[]>;
   putProfile(profile: CareProfile): Promise<void>;
   /** Removes a profile and every record under it. */
   deleteProfile(id: string): Promise<void>;

   get<K extends CollectionName>(
      collection: K,
      profileId: string,
      id: string,
   ): Promise<CollectionMap[K] | null>;

   list<K extends CollectionName>(
      collection: K,
      profileId: string,
   ): Promise<CollectionMap[K][]>;

   /**
    * Records of one profile whose text field equals one of the values.
    * Used to read only the days or statuses a page needs.
    */
   listIn<K extends CollectionName>(
      collection: K,
      profileId: string,
      field: keyof CollectionMap[K] & string,
      values: readonly string[],
   ): Promise<CollectionMap[K][]>;

   put<K extends CollectionName>(
      collection: K,
      record: CollectionMap[K],
   ): Promise<void>;

   putMany<K extends CollectionName>(
      collection: K,
      records: readonly CollectionMap[K][],
   ): Promise<void>;

   remove<K extends CollectionName>(
      collection: K,
      profileId: string,
      id: string,
   ): Promise<void>;
}

/** Collections under a profile, used when a profile is deleted. */
export const COLLECTION_NAMES: readonly CollectionName[] = [
   'members',
   'medications',
   'doses',
   'appointments',
   'tasks',
   'handovers',
   'questions',
   'readings',
   'documents',
   'proposals',
   'notifications',
   'audit',
];
