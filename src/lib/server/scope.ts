/**
 * Scope helper utilities for profile-based resource access.
 *
 * Resource Scoping Rules:
 * - Global (null profile_id): accessible to all profiles
 * - Profile-specific (non-null profile_id): accessible only to that profile
 * - Effective set for a profile: global resources + resources with same profile_id
 */

/**
 * Determines if a resource is global (accessible to all profiles).
 * A resource is global if its profile_id is null.
 */
export function isGlobalResource(profileId: string | null): boolean {
  return profileId === null;
}

/**
 * Determines if a resource is profile-specific.
 * A resource is profile-specific if its profile_id is not null.
 */
export function isProfileSpecificResource(profileId: string | null): boolean {
  return profileId !== null;
}

/**
 * Determines if a resource is accessible to a given profile.
 * Accessible if: resource is global OR resource profile matches the key profile.
 */
export function isResourceAccessibleToProfile(
  resourceProfileId: string | null,
  keyProfileId: string
): boolean {
  return isGlobalResource(resourceProfileId) || resourceProfileId === keyProfileId;
}

/**
 * Filters an array of resource profile IDs to only those accessible to a given profile.
 * Used to ensure models selected for a key are compatible with the key's profile.
 */
export function filterEligibleResourceIds(
  resourceProfileIds: Array<{ id: string; profileId: string | null }>,
  keyProfileId: string
): string[] {
  return resourceProfileIds
    .filter((resource) => isResourceAccessibleToProfile(resource.profileId, keyProfileId))
    .map((resource) => resource.id);
}

/**
 * Determines if a model (with its backend) is eligible for a virtual key.
 * A model is eligible if:
 * - model's backend is global OR
 * - model's backend profile_id matches the key's profile_id
 */
export function isModelEligibleForKey(
  modelBackendProfileId: string | null,
  keyProfileId: string
): boolean {
  return isResourceAccessibleToProfile(modelBackendProfileId, keyProfileId);
}

/**
 * Returns the scope label for a resource.
 * Used in UI to display whether a resource is global or profile-scoped.
 */
export function getScopeLabel(profileId: string | null, profileName?: string): string {
  if (profileId === null) {
    return 'Global';
  }
  return profileName ? `${profileName}` : 'Profile-scoped';
}

/**
 * Computes effective resources for a profile from a mixed global/profile-scoped set.
 * Returns all resources where profile_id is null OR profile_id matches the keyProfileId.
 */
export function computeEffectiveResources<T extends { profileId: string | null }>(
  resources: T[],
  keyProfileId: string
): T[] {
  return resources.filter((resource) =>
    isResourceAccessibleToProfile(resource.profileId, keyProfileId)
  );
}

/**
 * Validates that a set of models are all eligible for a given key profile.
 * Returns { valid: true } or { valid: false, ineligibleCount: number, ineligibleIds: string[] }
 */
export function validateModelEligibility(
  models: Array<{ id: string; backendProfileId: string | null }>,
  keyProfileId: string
): { valid: boolean; ineligibleIds: string[] } {
  const ineligibleIds = models
    .filter((model) => !isModelEligibleForKey(model.backendProfileId, keyProfileId))
    .map((model) => model.id);

  return {
    valid: ineligibleIds.length === 0,
    ineligibleIds
  };
}

/**
 * Filters models to only those eligible for a given key profile.
 * Used during key save to auto-clean incompatible models.
 */
export function filterEligibleModels(
  models: Array<{ id: string; backendProfileId: string | null }>,
  keyProfileId: string
): string[] {
  return models
    .filter((model) => isModelEligibleForKey(model.backendProfileId, keyProfileId))
    .map((model) => model.id);
}
