// #region shared with https://github.com/paranext/paranext-multi-extension-template/blob/main/webpack.config.ts

import webpack from 'webpack';
import configBridge from './webpack/webpack.config.bridge';
import configWebView from './webpack/webpack.config.web-view';
import configMain from './webpack/webpack.config.main';

// Note: Using a .ts file as the webpack config requires not having "type": "module" in package.json
// https://stackoverflow.com/a/76005614

// We want to build the bridge bundle, then WebViews, then main.
const config: webpack.Configuration[] = [configBridge, configWebView, configMain];

export default config;

// #endregion
