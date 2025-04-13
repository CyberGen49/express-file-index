# Express File Index

[![GitHub last commit](https://img.shields.io/github/last-commit/CyberGen49/express-file-index)](https://github.com/CyberGen49/express-file-index)
[![NPM Version](https://img.shields.io/npm/v/express-file-index)](https://www.npmjs.com/package/express-file-index)
[![NPM Downloads](https://img.shields.io/npm/dw/express-file-index)](https://www.npmjs.com/package/express-file-index)

`express-file-index` is an Express middleware that serves static files and provides a navigable file index for directories. It's designed to be lightweight, customizable, and easy to integrate into existing Express apps.

![Screenshot of both themes](./promo.png)

Check out this project in production on my personal file server [here](https://files.cybah.me/)!

## Features

- **Directory Indexing**: Display a navigable file index for directories.
- **Static File Serving**: Serve files directly from the specified root directory.
- **Customizable UI**: Use the built-in EJS templates or provide your own.
- **Sorting Options**: Sort files by name, size, or modification date.
- **Hidden Files**: Hide files with specific prefixes from the index.
- **Zip Downloads**: Optionally allow downloading directories as zip archives.
- **Recursive Directory Stats**: Optionally calculate accurate sizes and modification times for directories.
- **Custom File Viewer**: View and share images, videos, audio files, rendered markdown, and text files complete with syntax highlighting with a custom file viewer.
- **Readme Display**: Parse and display README.md files in directories.
- **Clean URL Aliases**: Allow accessing files and directories with clean aliases in addition to their normal names.
- **JSON API**: Allow fetching directory indexes as JSON.

## Installation

Install the package using npm:

```bash
npm install express-file-index
```

## Usage

Here's an example of how to use `express-file-index` in an Express app:

```javascript
const express = require('express');
const index = require('express-file-index');

const app = express();

app.use(index({
    rootDir: './public',
    serverName: 'Example Files',
    allowZipDownloads: true,
    statDirs: true
}));

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
```

## Configuration

The middleware accepts an options object to customize its behavior. The available options are as follows:

### `string` `rootDir`
The root directory of the file index.

Defaults to `./`.

### `string` `serverName`
The name to use for the root directory in the file index.

Defaults to the hostname request header.

### `string[]` `hiddenFilePrefixes`
A list of file prefixes that should be hidden from the file index.

**IMPORTANT:** This option DOES NOT block access to these files; it only hides them from view in the index. They are still downloadable by path.

Defaults to `[ '.', '_' ]`.

### `string[]` `indexFiles`
A list of file names that should be sent on directory requests instead of the file index.

Defaults to `[ 'index.html' ]`.

### `boolean` `statDirs`
Whether to recursively process directories to calculate accurate sizes and modification times.

This will slow index loading if you have lots of files and/or slow storage.

Defaults to `false`.

### `string` `defaultFileSortType`
The value by which files are sorted by default. Can be one of `name` (sort alphabetically by file name), `modified` (sort by modification time), or `size` (sort by size).

Defaults to `name`.

### `string` `defaultFileSortOrder`
The direction in which to order files by default. Can be one of `asc` (ascending order) or `desc` (descending order). Descending order will reverse the order of the files after they're sorted.

Defaults to `asc`.

### `boolean` `handle404`
Whether to handle 404 errors by displaying a custom error page.

When set to `false`, `next()` will be called, passing the request to the next middleware.

Defaults to `false`.

### `string` `handle404Document`
The path to a custom 404 error page. `handle404` must be `true` for this option to work.

Defaults to the built-in error page.

### `boolean` `allowZipDownloads`
Whether to allow downloading directories recursively as zip archives when the `format=zip` query parameter is present.

When enabled, users will have the option to download directories (files and subdirectories) as zip archives. These zips are built and streamed to the user in real-time, so no extra space is used, but the CPU and network may be impacted during large zipping operations.

Defaults to `false`.

### `number` `zipZlibLevel`
The level of zlib compression (`0`-`9`) to use when streaming zip archives to users. Higher values result in smaller archives, but require more time and CPU power to compress. `0` is no compression.

This option only applies when `allowZipDownloads` is `true`.

Defaults to `0`.

### `boolean` `allowJsonRequests`
Whether to expose file index data as JSON when the `format=json` query parameter is present.

When requested, a JSON response will be returned containing an object with a single `data` property. This property contains the data outlined in the [Customization](#customization) section below.

**Note:** This may expose sensitive information in the form of absolute file paths. Enable at your own risk.

Defaults to `false`.

### `boolean` `allowCleanPathAliases`
Whether to allow clean aliases for files and directories in URLs.

Clean aliases take the file/directory name, convert it to lowercase, replace spaces with dashes, and remove all characters other than a-z, 0-9, dashes, and underscores.

This option is useful for making URLs more readable, but may cause conflicts with existing files and directories. If a file or directory exists with the same name as the alias, the file or directory will take priority. When two files have the same alias in the same directory, the alias will not work and the files will need to be accessed by their original names.

Enabling this option may also impact performance due to the extra processing required to resolve aliases and check for conflicts.

Defaults to `false`.

### `boolean` `forceCleanPathAliases`
Whether to force clean path aliases by using them when navigating the file index. `allowCleanPathAliases` must be `true` for this option to work.

Defaults to `false`.

### `boolean` `enableLogging`
Whether debug/activity logs should be printed to the console.

Defaults to `false`.

### `string` `indexEjsPath`
The path to an EJS template file to use for the file index.

Defaults to the built-in template.

### `string` `viewerEjsPath`
The path to an EJS template file to use for viewing files in the browser.

Defaults to the built-in template.

### `string` `fileSelectAction`
What should happen when a file is selected in the file index. Can be one of:

- `default`: Leave it up to the browser to either download the file or open it in the same tab, depending on the file type.
- `download`: Always download the file, regardless of the file type.
- `render`: Render the file using `express-file-index`'s custom file viewer.

Defaults to `'render'`.

### `string` `fileTimeFormat`
A string representing the format of displayed file modification times using [Day.js format placeholders](https://day.js.org/docs/en/display/format).

Defaults to `'MMM D, YYYY'`.

### `boolean` `useRelativeTimes`
Whether to use relative times for files in the file list instead of absolute times.

When enabled, file modification times will be displayed as relative times (e.g., "2 hours ago") instead of formatted absolute dates.

Defaults to `true`.

## Directory Query Parameters

These query parameters can be set on any directory URL handled by `express-file-index`. Invalid values for these parameters will be ignored/defaulted.

### `format`
Controls the format in which the file index is returned. Accepts one of the following values:

- `json`: If the `allowJsonRequests` option is `true`, returns the file index data as a JSON object.
- `zip`: If the `allowZipDownloads` option is `true`, returns an uncompressed zip file of the directory and all of its subdirectories.

Defaults to the rendered EJS template.

### `sortType`
Controls the value to sort files by. Accepts one of `name`, `modified`, `size`.

Defaults to the value set for the `defaultFileSortType` option.

### `sortOrder`
Controls the direction files are sorted in. Accepts one of `asc`, `desc`.

Defaults to the value set for the `defaultFileSortOrder` option.

## File Query Parameters

These query parameters can be set on any static file URL handled by `express-file-index`. Invalid values for these parameters will be ignored/defaulted.

### `format`
Controls the format in which the file is returned. Accepts one of the following values:

- `render`: Returns rendered HTML for the custom file viewer.
- `json`: If the `allowJsonRequests` option is `true`, returns the file metadata and rendering data as a JSON object.

Defaults to the static file data.

## Customization

You can customize the file index UI by providing your own EJS template files via the `indexEjsPath` and `viewerEjsPath` options for file index pages and viewer pages respectively.

This same data is available by request with the `format=json` query parameter on both directory and file URLs, if `allowJsonRequests` is `true`.

### File Index Data

The following data is provided to the `indexEjsPath` template under the `data` object:

- `opts`: The `options` object you provided when initializing `express-file-index` merged with the default values you didn't explicitly set.
- `ancestors`: An array of [ancestor](#ancestor)s representing the parent directories of the current directory.
- `dir`: An [ancestor](#ancestor) object for the current directory.
- `files`: A sorted array of [file](#file)s in the current directory.
- `sortType`: The current sort type (`name`, `size`, or `modified`).
- `sortOrder`: The current sort order (`asc` or `desc`).
- `packageVersion`: The `express-file-index` version.
- `nodejsVersion`: The Node.js version.
- `osPlatform`: The operating system platform.
- `osArch`: The operating system architecture.
- `processTimeMs`: The number of milliseconds it took to process the request.

### File Viewer Data

The following data is provided to the `viewerEjsPath` template under the `data` object:

- `opts`: The `options` object you provided when initializing `express-file-index` merged with the default values you didn't explicitly set.
- `ancestors`: An array of [ancestor](#ancestor)s representing the parent directories of the requested file.
- `file`: A [file](#file) object containing data for the requested file.
- `packageVersion`: The `express-file-index` version.
- `nodejsVersion`: The Node.js version.
- `osPlatform`: The operating system platform.
- `osArch`: The operating system architecture.
- `processTimeMs`: The number of milliseconds it took to process the request.

### Data types

#### Ancestor

Ancestor objects contain the following properties:

- `string` `name`: The name of the ancestor
- `string` `path`: The ancestor's relative path (or alias if `forceCleanPathAliases` is `true`).

#### File

File objects contain the following properties:

- `string` `name`: The file name.
- `string` `nameAlias`: The sanitized alias of the file name.
- `string` `path`: The file's relative path (or alias if `forceCleanPathAliases` is `true`).
- `string` `pathAlias`: The file's relative clean alias path, or `null` if `allowCleanPathAliases` is `false`.
- `string` `pathTrue`: The file's actual relative path.
- `boolean` `isDirectory`: Whether or not the file is a directory.
- `number` `size`: The file's size in bytes, or `0` if it's a directory and the `statDirs` option is `false`.
- `string` `sizeHuman`: The human-readable size of the file or `'-'` if `size` is `0`.
- `number` `modified`: The file's millisecond timestamp, or `0` if it's a directory and the `statDirs` option is `false`.
- `string` `modifiedHuman`: The human-readable modification time or `'-'` if `modified` is `0`.
- `string` `modifiedRelative`: The human-readable relative modification time or `'-'` if `modified` is `0`.
- `string` `type`: One of `'file'`, `'folder'`, `'text'`, `'image'`, `'audio'`, `'video'`, `'compressed'`, `'software'`.
- `string` `icon`: A [Google Material Symbol](https://fonts.google.com/icons) name.