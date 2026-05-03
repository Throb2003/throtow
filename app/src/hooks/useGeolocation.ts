import { useCallback, useState } from 'react';

import type { LocationPoint } from '@/types/app';

type UseGeolocationResult = {
  currentLocation: LocationPoint | null;
  loading: boolean;
  error: string | null;
  requestCurrentLocation: () => Promise<LocationPoint | null>;
};

const formatAddress = (latitude: number, longitude: number) =>
  `Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)}`;

export function useGeolocation(): UseGeolocationResult {
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      const message = 'Geolocation is not supported by your browser.';
      setError(message);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        });
      });

      const location: LocationPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address: formatAddress(position.coords.latitude, position.coords.longitude),
      };

      setCurrentLocation(location);
      return location;
    } catch (caughtError) {
      const browserError = caughtError as GeolocationPositionError | undefined;
      const message =
        browserError?.code === browserError?.PERMISSION_DENIED
          ? 'Location access was denied. Please allow location access and try again.'
          : browserError?.code === browserError?.POSITION_UNAVAILABLE
            ? 'Your current location could not be determined.'
            : browserError?.code === browserError?.TIMEOUT
              ? 'Location request timed out. Please try again.'
              : 'Unable to get your current location right now.';

      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    currentLocation,
    loading,
    error,
    requestCurrentLocation,
  };
}