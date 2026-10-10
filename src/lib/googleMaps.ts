type PlaceLocation = { lat: () => number; lng: () => number };
type Place = {
  formattedAddress?: string;
  location?: PlaceLocation;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};
type PlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes: string[];
  placeholder: string;
};
type MapsLibrary = {
  importLibrary: (name: 'places') => Promise<{
    PlaceAutocompleteElement: new () => PlaceAutocompleteElement;
  }>;
};

declare global {
  interface Window {
    google?: { maps: MapsLibrary };
    __afrixaGoogleMapsLoad?: Promise<MapsLibrary>;
    __afrixaGoogleMapsCallback?: () => void;
  }
}

const loadMaps = (apiKey: string): Promise<MapsLibrary> => {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__afrixaGoogleMapsLoad) return window.__afrixaGoogleMapsLoad;

  window.__afrixaGoogleMapsLoad = new Promise((resolve, reject) => {
    const callbackName = '__afrixaGoogleMapsCallback';
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Google Maps timeout')), 15000);
    window[callbackName] = () => {
      window.clearTimeout(timeout);
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps unavailable'));
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    window.__afrixaGoogleMapsLoad = undefined;
    throw error;
  });

  return window.__afrixaGoogleMapsLoad;
};

export async function createAddressAutocomplete(
  container: HTMLElement,
  onSelect: (address: string, coordinates: { lat: number; lng: number } | null) => void,
): Promise<() => void> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new Error('Google Maps API key is not configured');

  const maps = await loadMaps(apiKey);
  const { PlaceAutocompleteElement: PlaceAutocomplete } = await maps.importLibrary('places');
  const autocomplete = new PlaceAutocomplete();
  autocomplete.placeholder = 'Adresse de livraison';
  autocomplete.includedRegionCodes = ['ci', 'sn', 'ml', 'bf', 'gn', 'cm', 'tg', 'bj'];
  autocomplete.className = 'afrixa-place-autocomplete';
  autocomplete.addEventListener('gmp-select', async (event: Event) => {
    const placePrediction = (event as Event & {
      placePrediction?: { toPlace: () => Place };
    }).placePrediction;
    if (!placePrediction) return;

    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
      const location = place.location;
      onSelect(place.formattedAddress ?? '', location ? { lat: location.lat(), lng: location.lng() } : null);
    } catch {
      onSelect('', null);
    }
  });
  container.replaceChildren(autocomplete);
  return () => autocomplete.remove();
}
