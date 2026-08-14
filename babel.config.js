module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    // react-native-worklets/plugin muss immer der letzte Eintrag bleiben (Reanimated 4).
    plugins: ['react-native-worklets/plugin'],
  };
};
