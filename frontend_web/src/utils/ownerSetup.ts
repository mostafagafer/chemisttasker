import { fetchPharmaciesService, getOnboardingDetail } from "@chemisttasker/shared-core";

export type OwnerSetupStatus = {
  onboardingExists: boolean;
  onboardingComplete: boolean;
  pharmaciesCount: number;
  numberOfPharmacies: number;
  nextPath: string | null;
};

const OWNER_ONBOARDING_PATH = "/setup/owner/onboarding";
const OWNER_PHARMACIES_PATH = "/setup/owner/pharmacies";

export async function getOwnerSetupStatus(): Promise<OwnerSetupStatus> {
  try {
    const onboarding = await getOnboardingDetail("owner");
    const numberOfPharmacies = Math.max(1, Number((onboarding as any)?.number_of_pharmacies) || 1);
    const onboardingComplete = Boolean(
      (onboarding as any)?.submitted_for_verification ||
        (
          (onboarding as any)?.first_name &&
          (onboarding as any)?.last_name &&
          (onboarding as any)?.username &&
          (onboarding as any)?.phone_number &&
          (onboarding as any)?.role
        )
    );

    if (!onboardingComplete) {
      return {
        onboardingExists: true,
        onboardingComplete: false,
        pharmaciesCount: 0,
        numberOfPharmacies,
        nextPath: OWNER_ONBOARDING_PATH,
      };
    }

    const pharmacies = await fetchPharmaciesService({});
    const pharmaciesCount = Array.isArray(pharmacies) ? pharmacies.length : 0;

    return {
      onboardingExists: true,
      onboardingComplete: true,
      pharmaciesCount,
      numberOfPharmacies,
      nextPath: pharmaciesCount > 0 ? null : OWNER_PHARMACIES_PATH,
    };
  } catch (error: any) {
    if (error?.status === 404 || error?.response?.status === 404) {
      return {
        onboardingExists: false,
        onboardingComplete: false,
        pharmaciesCount: 0,
        numberOfPharmacies: 1,
        nextPath: OWNER_ONBOARDING_PATH,
      };
    }
    throw error;
  }
}

export const ownerSetupPaths = {
  onboarding: OWNER_ONBOARDING_PATH,
  pharmacies: OWNER_PHARMACIES_PATH,
};
