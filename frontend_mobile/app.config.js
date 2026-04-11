const appJson = require('./app.json');

const config = appJson.expo || {};

const androidMapsApiKey =
  process.env.EXPO_PUBLIC_ANDROID_PLACES ||
  process.env.EXPO_PUBLIC_PLACES_KEY ||
  process.env.EXPO_PUBLIC_MAPS_API_KEY ||
  '';

const iosMapsApiKey =
  process.env.EXPO_PUBLIC_IOS_PLACES ||
  process.env.EXPO_PUBLIC_PLACES_KEY ||
  process.env.EXPO_PUBLIC_MAPS_API_KEY ||
  '';

module.exports = {
  ...config,
  android: {
    ...(config.android || {}),
    config: {
      ...((config.android && config.android.config) || {}),
      googleMaps: {
        ...((((config.android || {}).config || {}).googleMaps) || {}),
        apiKey: androidMapsApiKey,
      },
    },
  },
  ios: {
    ...(config.ios || {}),
    config: {
      ...((config.ios && config.ios.config) || {}),
      googleMapsApiKey: iosMapsApiKey,
    },
  },
};
