import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  AdminUser,
  AuditLog,
  Booking,
  Campaign,
  Contact,
  ContactActivity,
  DiscountCode,
  EventItem,
  EventMetadata,
  PaymentAdvice,
  Segment,
} from '@/domain/types';

/**
 * Local, on-device database for the test build. Every screen reads through
 * this store and writes through `src/data/repo/*`, which is the swap point
 * for a Firebase/Postgres backend later.
 */
export interface DbState {
  seeded: boolean;
  users: AdminUser[];
  events: EventItem[];
  bookings: Booking[];
  contacts: Contact[];
  activities: ContactActivity[];
  paymentAdvice: PaymentAdvice[];
  segments: Segment[];
  campaigns: Campaign[];
  audit: AuditLog[];
  discounts: DiscountCode[];
  metadata: EventMetadata;
}

export const emptyDb = (): DbState => ({
  seeded: false,
  users: [],
  events: [],
  bookings: [],
  contacts: [],
  activities: [],
  paymentAdvice: [],
  segments: [],
  campaigns: [],
  audit: [],
  discounts: [],
  metadata: {
    prerequisites: [],
    tags: [],
    included: [],
    gains: [],
    categories: [],
    formats: [],
    levels: [],
    heardAboutSources: [],
  },
});

export const useDb = create<DbState>()(
  persist(() => emptyDb(), {
    name: 'africon-admin-db',
    version: 2,
    storage: createJSONStorage(() => AsyncStorage),
    migrate: (persisted, version) => {
      const state = persisted as DbState;
      // v2: every seeded admin user is named "Daky".
      if (version < 2 && state?.users) {
        const seeded = new Set(['admin@africon.ai', 'content@africon.ai', 'viewer@africon.ai', 'former.staff@africon.ai']);
        state.users = state.users.map((u) => (seeded.has(u.email) ? { ...u, displayName: 'Daky' } : u));
      }
      return state;
    },
  }),
);

export const db = {
  get: () => useDb.getState(),
  set: (fn: (s: DbState) => Partial<DbState>) => useDb.setState(fn),
  replace: (state: DbState) => useDb.setState(state, true),
};

/** Resolves once persisted data has loaded from disk. */
export function whenHydrated(): Promise<void> {
  if (useDb.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useDb.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
