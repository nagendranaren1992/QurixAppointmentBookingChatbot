// Metro config that lets us import SVG files as React components.
// Required because Expo's default config treats .svg as an asset (Image source),
// not a renderable component. With this config:
//
//   import QurixLogo from './assets/qurix_logo.svg';
//   <QurixLogo width={32} height={32} />
//
// works on web AND native via react-native-svg + react-native-svg-transformer.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
