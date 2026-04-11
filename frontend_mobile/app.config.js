const appJson = require('./app.json');
module.exports = ({ config }) => {
  const baseConfig = config || appJson.expo || {};

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

  return {
    ...baseConfig,
    android: {
      ...(baseConfig.android || {}),
      config: {
        ...((baseConfig.android && baseConfig.android.config) || {}),
        googleMaps: {
          ...((((baseConfig.android || {}).config || {}).googleMaps) || {}),
          apiKey: androidMapsApiKey,
        },
      },
    },
    ios: {
      ...(baseConfig.ios || {}),
      config: {
        ...((baseConfig.ios && baseConfig.ios.config) || {}),
        googleMapsApiKey: iosMapsApiKey,
      },
    },
  };
};
