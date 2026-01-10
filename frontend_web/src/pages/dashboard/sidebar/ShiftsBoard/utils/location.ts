import { TravelLocation } from '../types';

export const parseLocationNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeOnboardingLocation = (raw: any): TravelLocation => {
  const source = raw?.data ?? raw ?? {};
  return {
    streetAddress: source.street_address ?? source.streetAddress ?? '',
    suburb: source.suburb ?? '',
    state: source.state ?? '',
    postcode: source.postcode ?? '',
    googlePlaceId: source.google_place_id ?? source.googlePlaceId ?? '',
    latitude: parseLocationNumber(source.latitude),
    longitude: parseLocationNumber(source.longitude),
  };
};

export const formatTravelLocation = (location: TravelLocation) => {
  const street = location.streetAddress.trim();
  const suburb = location.suburb.trim();
  const state = location.state.trim();
  const postcode = location.postcode.trim();
  const cityLine = [suburb, state, postcode].filter(Boolean).join(' ');
  const parts = [street, cityLine].filter(Boolean);
  return parts.join(', ');
};

export const buildCounterOfferMessage = (
  message: string,
  travelRequested: boolean,
  location: TravelLocation
) => {
  const base = (message ?? '').trim();
  if (!travelRequested) return base;
  const travelLine = formatTravelLocation(location);
  if (!travelLine) return base;
  const travelMessage = `Traveling from: ${travelLine}`;
  if (base.includes(travelMessage)) return base;
  return base ? `${base}\n\n${travelMessage}` : travelMessage;
};
