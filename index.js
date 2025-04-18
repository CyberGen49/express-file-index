const fs = require('fs').promises; // Use the promise-based fs API
const path = require('path');
const Express = require('express');
const ejs = require('ejs');
const archiver = require('archiver');
const dayjs = require('dayjs');

/**
 * @typedef {Object} DefaultIndexOptions
 * @property {string} rootDir
 * The root directory of the file index.
 * 
 * Defaults to `./`.
 * @property {string} serverName
 * The name to use for the root directory in the file index.
 * 
 * Defaults to the hostname request header.
 * @property {string[]} hiddenFilePrefixes
 * A list of file prefixes that should be hidden from the file index.
 * 
 * **IMPORTANT:** This option DOES NOT block access to these files; it only hides them from view in the index. They are still downloadable by path.
 * 
 * Defaults to `[ '.', '_' ]`.
 * @property {string[]} indexFiles
 * A list of file names that should be sent on directory requests instead of the file index.
 * 
 * Defaults to `[ 'index.html' ]`.
 * @property {boolean} statDirs
 * Whether to recursively process directories to calculate accurate sizes and modification times.
 * 
 * This will slow index loading if you have lots of files and/or slow storage.
 * 
 * Defaults to `false`.
 * @property {'name'|'modified'|'size'} defaultFileSortType
 * The value by which files are sorted by default. Can be one of `name` (sort alphabetically by file name), `modified` (sort by modification time), or `size` (sort by size).
 * 
 * See the `defaultFileSortOrder` option to reverse the order of the files after they're sorted, if you need files sorted newest first, for example.
 * 
 * This value can be set per request with the `sortType` query parameter.
 * 
 * Defaults to `name`.
 * @property {'asc'|'desc'} defaultFileSortOrder
 * The direction in which to order files by default. Can be one of `asc` (ascending order) or `desc` (descending order). Descending order will reverse the order of the files after they're sorted.
 * 
 * See the `defaultFileSortType` option to change the value by which files are sorted.
 * 
 * This value can be set per request with the `sortOrder` query parameter.
 * 
 * Defaults to `asc`.
 * @property {boolean} handle404
 * Whether to handle 404 errors by displaying a custom error page.
 * 
 * When set to `false`, `next()` will be called, passing the request to the next middleware.
 * 
 * Defaults to `false`.
 * @property {string} handle404Document
 * The path to a custom 404 error page. `handle404` must be `true` for this option to work.
 * 
 * Defaults to the built-in error page.
 * @property {boolean} allowZipDownloads
 * Whether to allow downloading directories recursively as zip archives when the `format=zip` query parameter is present.
 * 
 * When enabled, users will have the option to download directories (files and subdirectories) as zip archives. These zips are built and streamed to the user in real-time, so no extra space is used, but the CPU and network may be impacted during large zipping operations.
 * 
 * Defaults to `false`.
 * @property {number} zipZlibLevel
 * The level of zlib compression (`0`-`9`) to use when streaming zip archives to users. Higher values result in smaller archives, but require more time and CPU power to compress. `0` is no compression.
 * 
 * This option only applies when `allowZipDownloads` is `true`.
 * 
 * Defaults to `0`.
 * @property {boolean} allowJsonRequests
 * Whether to expose file index data as JSON when the `format=json` query parameter is present.
 * 
 * When requested, a JSON response will be returned containing an object with a single `data` property. This property contains the data outlined in the **Customization** section of the project readme.
 * 
 * Note that this may expose sensitive information in the form of absolute file paths. Enable at your own risk.
 * 
 * Defaults to `false`.
 * @property {boolean} allowCleanPathAliases
 * Whether to allow clean aliases for files and directories in URLs.
 * 
 * Clean aliases take the file/directory name, convert it to lowercase, replace spaces with dashes, and remove all characters other than a-z, 0-9, dashes, and underscores.
 * 
 * This option is useful for making URLs more readable, but may cause conflicts with existing files and directories. If a file or directory exists with the same name as the alias, the file or directory will take priority. When two files have the same alias in the same directory, the alias will not work and the files will need to be accessed by their original names.
 * 
 * Enabling this option may also impact performance due to the extra processing required to resolve aliases and check for conflicts.
 * 
 * Defaults to `false`.
 * @property {boolean} forceCleanPathAliases
 * Whether to force clean path aliases by using them when navigating the file index. `allowCleanPathAliases` must be `true` for this option to work.
 * 
 * Defaults to `false`.
 * @property {boolean} enableLogging
 * Whether debug/activity logs should be printed to the console.
 * 
 * Defaults to `false`.
 * @property {string[]} indexEjsPath
 * The path to an EJS template file to use for the file index. 
 * 
 * This option is not recommended for most use cases, but can be used to develop your own file index UI. See the **Customization** section of the project readme for details.
 * 
 * Defaults to the built-in template.
 * @property {string[]} viewerEjsPath
 * The path to an EJS template file to use for viewing files in the browser.
 * 
 * This option is not recommended for most use cases, but can be used to develop your own file viewer UI. See the **Customization** section of the project readme for details.
 * 
 * Defaults to the built-in template.
 * @property {'default'|'download'|'view'} fileSelectAction
 * What should happen when a file is selected in the file index. Can be one of:
 * 
 * - `default`: Leave it up to the browser to either download the file or open it in the same tab, depending on the file type.
 * - `download`: Always download the file, regardless of the file type.
 * - `render`: Render the file using `express-file-index`'s custom file viewer.
 * 
 * Defaults to `'view'`.
 * @property {string} fileTimeFormat
 * A string representing the format of displayed file modification times using [Day.js format placeholders](https://day.js.org/docs/en/display/format).
 * 
 * Defaults to `'MMM D, YYYY'`.
 * @property {boolean} useRelativeTimes
 * Whether to use relative times for files in the file list instead of absolute times.
 * 
 * When enabled, file modification times will be displayed as relative times (e.g., "2 hours ago") instead of formatted absolute dates.
 * 
 * Defaults to `true`.
 */

// Function to sanitize a file name so no URL encoding is needed
const getFileNameAlias = (fileName) => {
    return fileName
            .toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^a-z0-9-_\.]/g, '');
};

// Function to asynchronously check if a file exists
const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Function to round a number based on its size
const roundSmart = (num) => {
    if (num < 1)
        return parseFloat(num.toFixed(3));
    if (num < 10)
        return parseFloat(num.toFixed(2));
    if (num < 100)
        return parseFloat(num.toFixed(1));
    return parseFloat(num.toFixed(0));
};

// Function to format bytes into a human-readable string
const formatBytes = bytes => {
    const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB' ];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return `${roundSmart(bytes)} ${units[i]}`;
};

const msToRelativeTime = (ms) => {
    const secs = Math.round(ms / 1000);
    const mins = Math.round(secs / 60);
    const hours = Math.round(mins / 60);
    const days = Math.round(hours / 24);
    const weeks = Math.round(days / 7);
    const months = Math.round(days / 30.4369);
    const years = Math.round(days / 365.2422);
    if (secs < 180) return 'Moments';
    if (mins < 120) return `${mins} minutes`;
    if (hours < 48) return `${hours} hours`;
    if (days < 14) return `${days} days`;
    if (weeks < 12) return `${weeks} weeks`;
    if (months < 24) return `${months} months`;
    return `${years} years`;
}
const getRelativeTimestamp = (ts, anchor = Date.now()) => {
    const ms = anchor - ts;
    const relativeTime = msToRelativeTime(ms);
    if (ms < 0)
        return `${relativeTime} from now`;
    return `${relativeTime} ago`;
}

/**
 * @type {DefaultIndexOptions}
 */
const defaultOpts = {
    rootDir: './',
    serverName: '',
    hiddenFilePrefixes: [ '.', '_' ],
    indexFiles: [ 'index.html' ],
    statDirs: false,
    defaultFileSortType: 'name',
    defaultFileSortOrder: 'asc',
    handle404: false,
    handle404Document: path.join(__dirname, '404.html'),
    allowZipDownloads: false,
    zipZlibLevel: 0,
    allowJsonRequests: false,
    allowCleanPathAliases: false,
    forceCleanPathAliases: false,
    enableLogging: false,
    indexEjsPath: path.join(__dirname, 'index.ejs'),
    viewerEjsPath: path.join(__dirname, 'viewer.ejs'),
    fileSelectAction: 'render',
    fileTimeFormat: 'MMM D, YYYY',
    useRelativeTimes: true
};

/**
 * An Express middleware to serve static files and show a navigable file index for directories.
 * @param {DefaultIndexOptions} options Options for controlling this middleware.
 * @returns {Express.Router} An Express router to be used by your app.
 */
module.exports = (options = {}) => async (req, res, next) => {

    // Merge options with default options
    const opts = { ...defaultOpts, ...options };
    opts.serverName = opts.serverName || req.hostname;

    // Get paths and options
    const renderStartTime = Date.now();
    const pathRoot = path.resolve(opts.rootDir);
    let pathRel = path.normalize('/' + decodeURI(req.path));
    let pathAbs = path.normalize(path.join(pathRoot, pathRel));

    // Logging function
    const log = (message) => {
        if (!opts.enableLogging) return;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`[${ip}] ${message}`);
    };
    
    // Function to resolve the actual relative file path of an alias path
    // If a file exists with the same name as the alias, it will be used instead
    // If a resolution can't be found, null is returned
    const resolvePathAlias = async (pathRelAlias) => {
        if (!opts.allowCleanPathAliases) return pathRelAlias;
        const parts = pathRelAlias.split('/').filter(Boolean);
        let currentDir = pathRoot;
        let pathRelParts = [];
        for (const requestedFileNameAlias of parts) {
            const stats = await fs.stat(currentDir);
            if (stats.isDirectory()) {
                const fileNames = await fs.readdir(currentDir);
                let found = false;
                for (const fileName of fileNames) {
                    const fileNameAlias = getFileNameAlias(fileName);
                    if (fileName === requestedFileNameAlias) {
                        pathRelParts.push(fileName);
                        found = true;
                        break;
                    }
                    if (fileNameAlias === requestedFileNameAlias) {
                        pathRelParts.push(fileName);
                        found = true;
                        break;
                    }
                }
                if (!found)
                    return null;
            } else {
                pathRelParts.push(requestedFileNameAlias);
            }
            currentDir = path.join(currentDir, pathRelParts[pathRelParts.length - 1]);
        }
        const pathRel = path.join('/', ...pathRelParts);
        log(`Resolved alias path: ${pathRelAlias} -> ${pathRel}`);
        return pathRel;
    };

    // Get the alias of a file path while avoiding conflicts with existing files/matching aliases
    // This conflict check runs in every ancestor directory of the path
    // Path parts where there are conflicts should use the original part
    const pathAliasPartMap = {};
    const dirFileNames = {};
    const fileNameAliasesMap = {};
    const getPathAlias = async (pathRel) => {
        if (!opts.allowCleanPathAliases) return pathRel;
        const parts = pathRel.split('/').filter(Boolean);
        let currentDir = pathRoot;
        let pathRelAliasParts = [];

        const process = async(pathAbs, fileNameRequested) => {
            const fileNameRequestedAlias = getFileNameAlias(fileNameRequested);
            const stats = await fs.stat(pathAbs);
            if (stats.isDirectory()) {
                let fileNames;
                if (!dirFileNames[pathAbs]) {
                    dirFileNames[pathAbs] = [];
                    fileNames = await fs.readdir(pathAbs)
                    for (const fileName of fileNames) {
                        dirFileNames[pathAbs].push(fileName);
                        if (!fileNameAliasesMap[fileName])
                            fileNameAliasesMap[fileName] = getFileNameAlias(fileName);
                    }
                } else {
                    fileNames = dirFileNames[pathAbs];
                }
                let conflicted = false;
                for (const fileName of fileNames) {
                    if (fileName === fileNameRequested) continue;
                    if (fileName == fileNameRequestedAlias) {
                        log(`Path alias conflict in directory ${pathAbs}: Alias of "${fileNameRequested}" is "${fileNameRequestedAlias}", but "${fileName}" exists - the file will take priority`);
                        conflicted = true;
                        break;
                    }
                    const fileNameAlias = fileNameAliasesMap[fileName] || getFileNameAlias(fileName);
                    if (fileNameAlias == fileNameRequestedAlias) {
                        log(`Path alias conflict in directory ${pathAbs}: Aliases of "${fileNameRequested}" and "${fileName}" are both "${fileNameRequestedAlias}" - the alias will not work`);
                        conflicted = true;
                        break;
                    }
                }
                if (conflicted) {
                    return fileNameRequested;
                } else {
                    return fileNameRequestedAlias;
                }
            } else {
                return fileNameRequested;
            }
        }

        for (const fileNameRequested of parts) {
            const subpath = path.join(currentDir, fileNameRequested);
            const aliasPartCached = pathAliasPartMap[subpath];
            const aliasPart = aliasPartCached || await process(currentDir, fileNameRequested);
            if (!aliasPartCached)
                pathAliasPartMap[subpath] = aliasPart;
            pathRelAliasParts.push(aliasPart);
            currentDir = path.join(currentDir, fileNameRequested);
        }

        const pathRelAlias = path.join('/', ...pathRelAliasParts);
        return pathRelAlias;
    };

    // Function to get file data object
    const getFileData = async(filePathAbs, filePathRel, shouldRecurse = opts.statDirs) => {
        const fileName = path.basename(filePathAbs);
        const fileExt = path.extname(fileName).toLowerCase();
        const stats = await fs.stat(filePathAbs);
        const isDirectory = stats.isDirectory();
        let size = isDirectory ? 0 : stats.size;
        let modified = isDirectory ? 0 : stats.mtimeMs;

        // Process directories if enabled
        if (isDirectory && shouldRecurse) {
            const recurse = async (dirPath) => {
                const fileNames = await fs.readdir(dirPath);
                for (const fileName of fileNames) {
                    const filePathAbs = path.join(dirPath, fileName);
                    const stats = await fs.stat(filePathAbs);
                    if (stats.isDirectory()) {
                        await recurse(filePathAbs);
                    } else {
                        size += stats.size;
                        modified = Math.max(modified, stats.mtimeMs);
                    }
                }
            };
            await recurse(filePathAbs);
        }

        // Determine file type and icon
        const typeExtensions = require(path.join(__dirname, 'type-extensions.json'));
        const typeIcons = {
            file: 'draft',
            folder: 'folder',
            text: 'description',
            image: 'image',
            audio: 'volume_up',
            video: 'movie',
            compressed: 'folder_zip',
            software: 'wysiwyg'
        };
        const fileType = isDirectory ? 'folder' : Object.keys(typeExtensions).find(type =>
            typeExtensions[type].includes(fileExt)
        ) || 'file';

        // Add to list
        const trailingSlash = (isDirectory && filePathRel != '/') ? '/' : '';
        const filePathRelAlias = opts.allowCleanPathAliases ? await getPathAlias(filePathRel) + trailingSlash : null;
        const fileNameAlias = getFileNameAlias(fileName);
        const data = {
            name: fileName,
            nameAlias: fileNameAlias,
            path: (opts.forceCleanPathAliases ? filePathRelAlias : filePathRel + trailingSlash),
            pathAlias: filePathRelAlias,
            pathTrue: filePathRel + trailingSlash,
            isDirectory,
            size,
            sizeHuman: size ? formatBytes(size) : '-',
            modified,
            modifiedHuman: modified ? dayjs(modified).format(opts.fileTimeFormat) : '-',
            modifiedRelative: modified ? (getRelativeTimestamp(modified)) : '-',
            type: fileType,
            icon: typeIcons[fileType]
        };
        return data;
    }

    // Handle asset requests
    const asset = req.query.expressFileIndexAsset;
    if (asset) {
        const assetsDir = path.join(__dirname, 'assets');
        const assetPathRel = path.normalize('/' + decodeURI(asset));
        const assetPathAbs = path.join(assetsDir, assetPathRel);
        try {
            await fs.access(assetPathAbs);
            const assetStats = await fs.stat(assetPathAbs);
            if (assetStats.isFile()) {
                log(`Requested built-in asset: ${assetPathAbs}`);
                return res.sendFile(assetPathAbs);
            }
        } catch (error) {}
    }

    // Attempt to find path alias if the path doesn't exist
    if (!await fileExists(pathAbs) && opts.allowCleanPathAliases) {
        const unsanitizedPathRel = await resolvePathAlias(pathRel);
        if (unsanitizedPathRel) {
            pathRel = unsanitizedPathRel;
            pathAbs = path.join(pathRoot, pathRel);
        }
    }

    // Make sure the file exists
    if (!await fileExists(pathAbs)) {
        // Handle error 404 if enabled
        if (opts.handle404) {
            log(`Handling 404 for file: ${pathAbs}`);
            return res.status(404).sendFile(opts.handle404Document);
        } else {
            return next();
        }
    }

    // Initialize render data
    const renderData = {
        opts,
        packageVersion: require(path.join(__dirname, 'package.json')).version,
        nodejsVersion: process.version,
        osPlatform: process.platform,
        osArch: process.arch
    };

    // Get parent directory names and paths
    const pathParts = pathRel.split('/').filter(Boolean);
    const ancestors = [
        { name: opts.serverName, path: '/' },
    ];
    for (let i = 0; i < pathParts.length; i++) {
        const ancestorPathRel = '/' + pathParts.slice(0, i + 1).join('/');
        const ancestorPathRelAlias = await getPathAlias(ancestorPathRel);
        const ancestorName = pathParts[i];
        ancestors.push({
            name: ancestorName,
            path: opts.forceCleanPathAliases ? ancestorPathRelAlias : ancestorPathRel,
            pathAlias: ancestorPathRelAlias,
            pathTrue: ancestorPathRel,
        });
    }
    renderData.ancestors = ancestors;

    // Get requested resource stats
    const stats = await fs.stat(pathAbs);

    // If the requested resource is a file
    if (stats.isFile()) {

        // If rendered viewer is requested
        if (req.query.format == 'render') {
            log(`Rendering file viewer for file: ${pathAbs}`);
            renderData.ancestors.pop();
            renderData.file = await getFileData(pathAbs, pathRel);
            renderData.processTimeMs = Date.now() - renderStartTime;
            const html = await ejs.renderFile(opts.viewerEjsPath, { data: renderData });
            res.setHeader('Content-Type', 'text/html');
            return res.end(html);
        }

        // If JSON data is requested and enabled
        if (req.query.format == 'json') {
            if (!opts.allowJsonRequests) {
                log(`Sending JSON disabled message for directory: ${pathAbs}`);
                return res.status(403).json({
                    error: `JSON requests are disabled.`
                });
            }
            log(`Sending JSON data for file: ${pathAbs}`);
            renderData.file = await getFileData(pathAbs, pathRel);
            renderData.processTimeMs = Date.now() - renderStartTime;
            return res.json({ data: renderData });
        }

        // Serve static file
        log(`Requested static file: ${pathAbs}`);
        return res.sendFile(pathAbs);

    }
    
    // Redirect directory requests without a trailing slash to include it
    if (!req.path.endsWith('/')) {
        return res.redirect(301, req.path + '/');
    }

    // Redirect old preview URLs to new render URLs
    if (req.query.preview) {
        return res.redirect(path.join(pathRel, req.query.preview) + '?format=render');
    }
    
    // Zip and send if requested and enabled
    if (req.query.format == 'zip' && opts.allowZipDownloads) {
        log(`Requested zip download of directory: ${pathAbs}`);

        // Process files recursively
        const entryArgs = [];
        const recurse = async (dirPath) => {
            const fileNames = await fs.readdir(dirPath);
            for (const fileName of fileNames) {
                if (opts.hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
                    continue;
                const filePathAbs = path.join(dirPath, fileName);
                const filePathAbsReal = await fs.realpath(filePathAbs);
                const filePathRel = path.relative(pathAbs, filePathAbs);
                const stats = await fs.stat(filePathAbsReal);
                if (stats.isDirectory()) {
                    await recurse(filePathAbs);
                } else {
                    entryArgs.push([ filePathAbsReal, { name: filePathRel } ]);
                }
            }
        };
        await recurse(pathAbs);
        log(`Recursively discovered ${entryArgs.length} files in directory: ${pathAbs}`);

        // Communicate to the client
        const zipFileName = path.basename(pathAbs) + '.zip';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

        // Create uncompressed archive and pipe files to response
        const archive = archiver('zip', {
            zlib: { level: opts.zipZlibLevel }
        });
        archive.on('entry', entry => {
            log(`Added file to zip: ${path.join(pathAbs, entry.name)}`);
        });
        archive.on('error', (err) => {
            log(`Error during zip download: ${err.message}`);
            res.status(500).send(err.message);
        });
        archive.on('close', () => {
            log(`Finished zip download of directory: ${pathAbs}`);
        });
        archive.pipe(res);
        for (const args of entryArgs) {
            archive.file(...args);
        };
        archive.finalize();

        // Clean up on user disconnect
        req.on('close', () => {
            if (archive.closed) return;
            log(`Aborted zip download of directory: ${pathAbs}`);
            archive.abort();
        });

        return;
    }

    // Check for index files
    for (const name of opts.indexFiles) {
        const pathIndexFile = path.join(pathAbs, name);
        if (!await fileExists(pathIndexFile)) continue;
        log(`Requested index file: ${pathIndexFile}`);
        return res.sendFile(pathIndexFile);
    }

    // Read directory
    const fileNames = await fs.readdir(pathAbs);
    dirFileNames[pathAbs] = fileNames;
    const filesOnly = [];
    const dirsOnly = [];

    for (const fileName of fileNames) {

        // Skip if the file hs a hidden prefix
        if (opts.hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
            continue;

        // Get file paths
        const filePathAbs = path.join(pathAbs, fileName);
        const filePathRel = path.join(pathRel, fileName);

        // Get and save file data
        const data = await getFileData(filePathAbs, filePathRel);
        if (data.isDirectory)
            dirsOnly.push(data);
        else
            filesOnly.push(data);

    }

    // Sort files
    const sortType = req.query.sortType || opts.defaultFileSortType;
    const sortOrder = req.query.sortOrder || opts.defaultFileSortOrder;
    const sortFunctions = {
        name: (a, b) => a.name.localeCompare(b.name, undefined, {
            sensitivity: 'base',
            numeric: true
        }),
        size: (a, b) => a.size - b.size,
        modified: (a, b) => a.modified - b.modified
    };
    dirsOnly.sort(sortFunctions.name).sort(sortFunctions[sortType]);
    filesOnly.sort(sortFunctions.name).sort(sortFunctions[sortType]);

    // Reverse files if requested
    if (sortOrder === 'desc') {
        dirsOnly.reverse();
        filesOnly.reverse();
    }

    // Combine directories and files
    const files = [ ...dirsOnly, ...filesOnly ];

    // Add parent directory
    if (pathRel !== '/') {
        const pathRelParent = path.join(pathRel, './..');
        const pathAbsParent = path.join(pathAbs, './..');
        const parentFileData = await getFileData(pathAbsParent, pathRelParent, false);
        parentFileData.name = '..';
        parentFileData.nameAlias = '..';
        parentFileData.icon = 'drive_folder_upload';
        files.unshift(parentFileData);
    }

    log(`Processed ${dirsOnly.length} subdirs and ${filesOnly.length} files in directory: ${pathAbs}`);

    // Finalize index data
    renderData.dir = ancestors.pop();
    renderData.files = files;
    renderData.sortType = sortType;
    renderData.sortOrder = sortOrder;
    renderData.processTimeMs = Date.now() - renderStartTime

    // Return data as JSON if requested
    if (req.query.format == 'json') {
        if (!opts.allowJsonRequests) {
            log(`Sending JSON disabled message for directory: ${pathAbs}`);
            return res.status(403).json({
                error: `JSON requests are disabled.`
            });
        }
        log(`Sending JSON data for directory: ${pathAbs}`);
        return res.json({ data: renderData });
    }

    // Render index
    log(`Rendering file index for directory: ${pathAbs}`);
    const html = await ejs.renderFile(opts.indexEjsPath, { data: renderData });

    // Respond
    res.setHeader('Content-Type', 'text/html');
    return res.end(html);

};