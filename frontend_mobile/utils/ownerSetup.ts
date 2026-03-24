import { fetchPharmaciesService, getOnboarding } from '@chemisttasker/shared-core';

export type OwnerSetupStatus = {
  onboardingExists: boolean;
  onboardingComplete: boolean;
  pharmaciesCount: number;
  numberOfPharmacies: number;
  nextPath: string | null;
};

const OWNER_ONBOARDING_PATH = '/setup/owner/onboarding';
const OWNER_PHARMACIES_PATH = '/setup/owner/pharmacies';
const OWNER_DASHBOARD_PATH = '/owner/dashboard';

export async function getOwnerSetupStatus(): Promise<OwnerSetupStatus> {
  try {
    const onboarding: any = await getOnboarding('owner');
    const numberOfPharmacies = Math.max(1, Number(onboarding?.number_of_pharmacies) || 1);
    const onboardingComplete = Boolean(
      onboarding?.submitted_for_verification || (
        onboarding?.first_name &&
        onboarding?.last_name &&
        onboarding?.username &&
        onboarding?.phone_number &&
        onboarding?.role
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

    const pharmacies: any = await fetchPharmaciesService({});
    const pharmacyList = Array.isArray(pharmacies?.results) ? pharmacies.results : Array.isArray(pharmacies) ? pharmacies : [];
    const pharmaciesCount = pharmacyList.length;

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
  dashboard: OWNER_DASHBOARD_PATH,
};
