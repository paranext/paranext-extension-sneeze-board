import path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import configBase, { rootDir } from './webpack.config.base';

/**
 * Webpack configuration for building the bridge bundle.
 *
 * The bridge runs as a Node child process spawned by extension main via
 * `papi.elevatedPrivileges.createProcess.fork`. It is fully self-contained (no Platform.Bible
 * sandbox restrictions apply); it speaks NetworkComms.Net binary frames over TCP and exchanges IPC
 * messages with the extension main over Node's built-in `process.send` / `child.on('message')`
 * channel.
 */
const configBridge: webpack.Configuration = merge(configBase, {
  name: 'bridge',
  target: 'node22',
  entry: path.join(rootDir, 'src/bridge/index.ts'),
  output: {
    path: path.join(rootDir, 'dist/assets/bridge'),
    filename: 'index.js',
    library: { type: 'commonjs2' },
    clean: false,
  },
  externals: [
    // Built-in Node modules — never bundle these
    'node:net',
    'net',
    'node:child_process',
    'child_process',
    'node:os',
    'os',
    'node:path',
    'path',
    'node:fs',
    'fs',
    'node:buffer',
    'buffer',
    'node:util',
    'util',
  ],
  externalsType: 'node-commonjs',
  experiments: { outputModule: false },
  optimization: { minimize: false },
  devtool: 'inline-source-map',
});

export default configBridge;
