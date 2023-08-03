# paranext-extension-sneeze-board
Example Paranext extension to display a Sneeze Board

## Summary

This is a sample webpack Platform.Bible extension project: Sneeze Board to track team members' work-related sneezes.
- `package.json` contains information about this extension npm package. It is required for Platform.Bible to use the extension properly. It is copied into the build folder
- `src` contains the source code for the extension
  - `src/main.ts` is the main entry file for the Sneeze Board extension
  - `src/types/sneeze-board.d.ts` is this extension's types file that defines how other extensions can use this extension through the `papi`. It is copied into the build folder
  - `sneeze-board.web-view.tsx` file defines a React WebView that Platform.Bible displays
- `public` contains static files that are copied into the build folder
  - `public/manifest.json` is the manifest file that defines the Sneeze Board extension and important properties for Platform.Bible
  - `public/package.json` defines the npm package for this extension and is required for Platform.Bible to use it appropriately
  - `public/assets` contains asset files the extension and its WebViews can retrieve using the `papi-extension:` protocol
- `dist` is a generated folder containing the built extension files
- `release` is a generated folder containing a zip of the built extension files

## To install

### Configure paths to `paranext-core` repo

In order to interact with `paranext-core`, you must point `package.json` to your installed `paranext-core` repository:

1. Follow the instructions to install [`paranext-core`](https://github.com/paranext/paranext-core#developer-install). We recommend you clone `paranext-core` in the same parent directory in which you cloned this repository so you do not have to reconfigure paths to `paranext-core`.
2. If you cloned `paranext-core` anywhere other than in the same parent directory in which you cloned this repository, update the paths to `paranext-core` in this repository's `package.json` to point to the correct `paranext-core` directory.

### Install dependencies

Run `npm install` to install local and published dependencies

## To run

### Running Paranext with your extension

To run Paranext with your extension:

`npm start`

Note: The built extension will be in the `dist` folder. In order for Platform.Bible to run your extension, you must provide the directory to your built extension to Platform.Bible via a command-line argument. This command-line argument is already provided in this `package.json`'s `start` script. If you want to start Platform.Bible and use the Sneeze Board extension any other way, you must provide this command-line argument or put the `dist` folder into Platform.Bible's `extensions` folder.

### Building your extension independently

To watch extension files (in `src`) for changes:

`npm run watch`

To build the Sneeze Board extension once:

`npm run build`

## To package for distribution

To package the Sneeze Board extension into a zip file for distribution:

`npm run package`

## Special features of the template

The paranext-extension-template has special features and specific configuration to make building an extension for Platform.Bible easier. Following are a few important notes:

### React WebView files - `.web-view.tsx`

Platform.Bible WebViews must be treated differently than other code, so the template makes doing that simpler:

- WebView code must be bundled and can only import specific packages provided by Platform.Bible (see `externals` in `webpack.config.base.ts`), so this template bundles React WebViews before bundling the main extension file to support this requirement. The template discovers and bundles files that end with `.web-view.tsx` in this way.
  - Note: while watching for changes, if you add a new `.web-view.tsx` file, you must either restart webpack or make a nominal change and save in an existing `.web-view.tsx` file for webpack to discover and bundle this new file.
- WebView code and styles must be provided to the `papi` as strings, so you can import WebView files with [`?inline`](#special-imports) after the file path to import the file as a string.

### Special imports

- Adding `?inline` to the end of a file import causes that file to be imported as a string after being transformed by webpack loaders but before bundling dependencies (except if that file is a React WebView file, in which case dependencies will be bundled). The contents of the file will be on the file's default export.
  - Ex: `import myFile from './file-path?inline`
- Adding `?raw` to the end of a file import treats a file the same way as `?inline` except that it will be imported directly without being transformed by webpack.

### Misc features

- Platform.Bible extension code must be bundled all together in one file, so webpack bundles all the code together into one main extension file.
- Platform.Bible extensions can interact with other extensions, but they cannot import and export like in a normal Node environment. Instead, they interact through the `papi`. As such, the `src/types` folder contains this extension's declarations file that tells other extensions how to interact with it through the `papi`.

### Two-step webpack build

This extension template is built by webpack (`webpack.config.ts`) in two steps: a WebView bundling step and a main bundling step:

#### Build 1: TypeScript WebView bundling

Webpack (`./webpack/webpack.config.web-view.ts`) prepares TypeScript WebViews for use and outputs them into temporary build folders adjacent to the WebView files:
- Formats WebViews to match how they should look to work in Platform.Bible
- Transpiles React/TypeScript WebViews into JavaScript
- Bundles dependencies into the WebViews
- Embeds Sourcemaps into the WebViews inline

#### Build 2: Main and final bundling

Webpack (`./webpack/webpack.config.main.ts`) prepares the main extension file and bundles the extension together into the `dist` folder:
- Transpiles the main TypeScript file and its imported modules into JavaScript
- Injects the bundled WebViews into the main file
- Bundles dependencies into the main file
- Embeds Sourcemaps into the file inline
- Packages everything up into an extension folder `dist`
