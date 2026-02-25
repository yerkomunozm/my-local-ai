import { UserProfile } from "../types";

const PROFILE_KEY = "profile:default";
const MIGRATION_KEY = "meta:migration:v1";

export function createProfileRepo(
  userProfileDb: {
    get: (key: string) => Promise<unknown>;
    put: (key: string, value: unknown) => Promise<void>;
  }
) {
  const defaultProfile = (): UserProfile => ({
    userId: "default",
    traits: [],
    facts: [],
    updatedAt: Date.now(),
  });

  const getProfile = async (): Promise<UserProfile> => {
    try {
      const profile = (await userProfileDb.get(PROFILE_KEY)) as UserProfile | undefined;
      if (profile?.userId === "default") {
        return profile;
      }
    } catch {
      // handled below by default initializer
    }

    const profile = defaultProfile();
    await userProfileDb.put(PROFILE_KEY, profile);
    return profile;
  };

  const updateProfile = async (data: Pick<UserProfile, "traits" | "facts">): Promise<UserProfile> => {
    const next: UserProfile = {
      userId: "default",
      traits: data.traits,
      facts: data.facts,
      updatedAt: Date.now(),
    };
    await userProfileDb.put(PROFILE_KEY, next);
    return next;
  };

  const isMigrationDone = async (): Promise<boolean> => {
    try {
      const meta = (await userProfileDb.get(MIGRATION_KEY)) as { done?: boolean };
      return Boolean(meta?.done);
    } catch {
      return false;
    }
  };

  const markMigrationDone = async (): Promise<void> => {
    await userProfileDb.put(MIGRATION_KEY, { done: true, updatedAt: Date.now() });
  };

  return {
    getProfile,
    updateProfile,
    isMigrationDone,
    markMigrationDone,
  };
}
