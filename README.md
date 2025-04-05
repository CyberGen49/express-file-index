# Express File Index

`express-file-index` is an Express middleware that serves static files and provides a navigable file index for directories. It's designed to be lightweight, customizable, and easy to integrate into existing Express apps.

![Screenshot of both themes](./promo.png)

I use this project for my personal file server. Check it out [here](https://files.cybah.me/)!

## Features

- **Static File Serving**: Serves files directly from the specified root directory.
- **Directory Indexing**: Displays a navigable file index for directories.
- **Customizable UI**: Use the built-in EJS template or provide your own.
- **Sorting Options**: Sort files by name, size, or modification date.
- **Hidden Files**: Hide files with specific prefixes from the index.
- **Zip Downloads**: Optionally allow downloading directories as zip archives.
- **Recursive Directory Stats**: Calculate accurate sizes and modification times for directories.
- **Readme Display**: Parse and display README.md files in directories.
- **File Previews**: View images, videos, audio files, and text files complete with syntax highlighting without leaving the file index.
- **Clean URL Aliases**: Allow accessing files and directories with clean aliases in addition to their normal names.
- **JSON API**: Allow fetching directory indexes as JSON.

## Installation

Install the package using npm:

```bash
npm install express-file-index
```

## Usage

Here's an example of how to use `express-file-index` in an Express application:

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
    console.log('Server is running on http://localhost:3000');
});
```

## Configuration

The middleware accepts an options object to customize its behavior. Below are the available options:

### `string` `rootDir`
The root directory of the file index.

Defaults to `./`.

### `string` `serverName`
The name to use for the root directory in the file index.

Defaults to the hostname of the server.

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

### `boolean` `handle404`
Whether to handle 404 errors by displaying a custom error page.

When set to `false`, `next()` will be called, passing the request to the next middleware.

Defaults to `false`.

### `string` `handle404Document`
The path to a custom 404 error page. `handle404` must be `true` for this option to work.

Defaults to the built-in error page.

### `boolean` `allowZipDownloads`
Whether to allow downloading directories recursively as (uncompressed) zip archives when the `format=zip` query parameter is present.

When enabled, users will have the option to download directories (files and subdirectories) as zip archives. These zips are built and streamed to the user in real-time, so no extra space is used, but the CPU and network may be impacted during large zipping operations.

Defaults to `false`.

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

### `string[]` `ejsFilePath`
The path to an EJS template file to use for the file index. 

This option is not recommended for most use cases, but can be used to develop your own file index UI. See the [Customization](#customization) section below for details.

Defaults to the built-in template.

### `string` `fileSelectAction`
What should happen when a file is selected in the file index. Can be one of:

- `default`: Leave it up to the browser to either download the file or open it in the same tab, depending on the file type.
- `download`: Always download the file, regardless of the file type.
- `preview`: Preview the file in a popup within the file index. If the file can't be previewed, the user will be prompted to download it.

Defaults to `'preview'`.

### `string` `fileTimeFormat`
A string representing the format of displayed file modification times using [Day.js format placeholders](https://day.js.org/docs/en/display/format).

Defaults to `'MMM D, YYYY'`.

## Query Parameters

### `format`
Controls the format in which the file index is returned. Accepts one of the following values:

- `json`: If the `allowJsonRequests` option is `true`, returns the file index data as a JSON object containing a single `data` property, which contains the data outlined in the [Customization](#customization) section below.
- `zip`: If the `allowZipDownloads` option is `true`, returns an uncompressed zip file of the directory and all of its subdirectories.

All other values for this parameter will be ignored.

### `preview`
Instructs the file index UI to open a preview for a specified file on load. Accepts the name of a file immediately within the requested directory.

This option will be ignored if the specified file name doesn't exist in the requested directory.

## Customization

You can customize the file index UI by providing your own EJS template file via the `ejsFilePath` option. The following data is available as properties under the `data` object:

- `opts`: The `options` object you provided when initializing `express-file-index` merged with the default values you didn't explicitly set.
- `ancestors`: An array of parent directories., each with `name` and `path` properties.
- `dir`: An object describing the current directory, with the same format as an `ancestors` item.
- `files`: A sorted array of files and directories in the current directory. Each entry contains the following:
  - `string` `name`: The file name
  - `string` `path`: If `forceCleanPathAliases` is `true`, this is the file's relative clean alias path. If it's `false`, this is the file's actual relative path.
  - `string` `pathAlias`: The file's relative clean alias path, or `null` if `allowCleanPathAliases` is `false`
  - `string` `pathTrue`: The file's actual relative path
  - `boolean` `isDirectory`: Whether or not the file is a directory
  - `number|string` `size`: The file's size in bytes, or `'-'` if not applicable
  - `number|string` `modified`: The file's millisecond timestamp, or `'-'` if not applicable
  - `string` `type` One of `'file'`, `'folder'`, `'text'`, `'image'`, `'audio'`, `'video'`, `'compressed'`, `'software'`
  - `string` `icon` A [Google Material Symbol](https://fonts.google.com/icons) name
- `sortType`: The current sort type (`name`, `size`, or `modified`).
- `sortOrder`: The current sort order (`asc` or `desc`).
- `nodejsVersion`: The Node.js version.
- `osPlatform`: The operating system platform.
- `osArch`: The operating system architecture.
- `renderStartTime`: A millisecond timestamp representing the time the request was received.