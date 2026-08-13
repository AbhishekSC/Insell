// Geolocation utility functions

/**
 * Get user's current location using browser's Geolocation API
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Reverse geocode coordinates to get address details
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<Object>}
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    // Using OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to reverse geocode');
    }
    
    const data = await response.json();
    const address = data.address || {};
    
    return {
      country: address.country || '',
      countryCode: address.country_code || '',
      city: address.city || address.town || address.village || address.county || '',
      state: address.state || address.region || '',
      address: address.road ? `${address.road}${address.house_number ? ` ${address.house_number}` : ''}` : '',
      formattedAddress: data.display_name || '',
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
};

/**
 * Get full location details (coordinates + address)
 * @returns {Promise<Object>}
 */
export const getFullLocationDetails = async () => {
  try {
    const coordinates = await getCurrentLocation();
    const addressDetails = await reverseGeocode(coordinates.latitude, coordinates.longitude);
    
    return {
      ...coordinates,
      ...addressDetails,
    };
  } catch (error) {
    console.error('Error getting full location details:', error);
    throw error;
  }
};
