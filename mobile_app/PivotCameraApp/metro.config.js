// metro.config.js
const { getDefaultConfig } = require("@expo/metro-config");
const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...require("node-libs-react-native"),
  stream: require.resolve("stream-browserify"),
  crypto: require.resolve("crypto-browserify"),
  randombytes: require.resolve("randombytes"),
  net: require.resolve("react-native-tcp-socket"),
  tls: require.resolve("react-native-tcp-socket"),
};

config.resolver.sourceExts.push("cjs"); // ws ships .cjs bundles
module.exports = config;
