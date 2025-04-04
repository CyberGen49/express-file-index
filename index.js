const fs = require('fs').promises; // Use the promise-based fs API
const path = require('path');
const Express = require('express');
const ejs = require('ejs');
const archiver = require('archiver');

/**
 * @typedef {Object} DefaultIndexOptions
 * @property {string} rootDir The root directory of the file index.
 * 
 * Defaults to `./`.
 * @property {string} serverName The name to use for the root directory in the file index.
 * 
 * Defaults to the hostname of the server.
 * @property {string[]} hiddenFilePrefixes A list of file prefixes that should be hidden from the file index.
 * 
 * **IMPORTANT:** This option DOES NOT block access to these files; it only hides them from view in the index. They are still downloadable by path.
 * 
 * Defaults to `[ '.', '_' ]`.
 * @property {string[]} indexFiles A list of file names that should be sent on directory requests instead of the file index.
 * 
 * Defaults to `[ 'index.html' ]`.
 * @property {boolean} statDirs Whether to recursively process directories to calculate accurate sizes and modification times.
 * 
 * This will slow index loading if you have lots of files and/or slow storage.
 * 
 * Defaults to `false`.
 * @property {boolean} handle404 Whether to handle 404 errors by displaying a custom error page.
 * 
 * When set to `false`, `next()` will be called, passing the request to the next middleware.
 * 
 * Defaults to `false`.
 * @property {string} handle404Document The path to a custom 404 error page.
 * 
 * Defaults to the built-in error page matching the style of the file index.
 * @property {boolean} allowZipDownloads Whether to allow downloading directories as (uncompressed) zip archives.
 * 
 * When enabled, users will have the option to download directories (files and subdirectories) as zip archives. These zips are built and streamed to the user in real-time, so no extra space is used, but the CPU and network may be impacted during large zipping operations.
 * 
 * Defaults to `false`.
 * @property {boolean} allowCleanPathAliases Whether to allow clean aliases for files and directories in URLs.
 * 
 * Clean aliases take the file/directory name, convert it to lowercase, replace spaces with dashes, and remove all characters other than a-z, 0-9, dashes, and underscores.
 * 
 * This option is useful for making URLs more readable, but may cause conflicts with existing files and directories. If a file or directory exists with the same name as the alias, the file or directory will take priority. When two files have the same alias in the same directory, the alias will not work and the files will need to be accessed by their original names.
 * 
 * Enabling this option may also impact performance due to the extra processing required to resolve aliases and check for conflicts.
 * 
 * Defaults to `false`.
 * @property {boolean} forceCleanPathAliases Whether to force clean path aliases by using them when navigating the file index. `allowCleanPathAliases` must be `true` for this option to work.
 * 
 * Defaults to `false`.
 * @property {boolean} enableLogging Whether debug/activity logs should be printed to the console.
 * 
 * Defaults to `false`.
 * @property {string[]} ejsFilePath The path to an EJS template file to use for the file index. 
 * 
 * This option is not recommended for most use cases, but can be used to develop your own file index UI. See the project readme for details.
 * 
 * Defaults to the built-in template.
 * @property {'default'|'download'|'preview'} fileSelectAction What should happen when a file is selected in the file index. Can be one of:
 * 
 * - `default`: Leave it up to the browser to either download the file or open it in the same tab, depending on the file type.
 * - `download`: Always download the file, regardless of the file type.
 * - `preview`: Preview the file in a popup within the file index. If the file can't be previewed, the user will be prompted to download it.
 * 
 * Defaults to `'preview'`.
 * @property {string} fileTimeFormat A string representing the format of displayed file modification times using [Day.js format placeholders](https://day.js.org/docs/en/display/format).
 * 
 * Defaults to `'MMM D, YYYY'`.
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

/**
 * @type {DefaultIndexOptions}
 */
const defaultOpts = {
    rootDir: './',
    serverName: '',
    hiddenFilePrefixes: [ '.', '_' ],
    indexFiles: [ 'index.html' ],
    statDirs: false,
    handle404: false,
    handle404Document: path.join(__dirname, '404.html'),
    allowZipDownloads: false,
    ejsFilePath: path.join(__dirname, 'index.ejs'),
    fileTimeFormat: 'MMM D, YYYY',
    enableLogging: false,
    allowCleanPathAliases: false,
    forceCleanPathAliases: false,
    fileSelectAction: 'preview',
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

    // Get requested resource stats
    const stats = await fs.stat(pathAbs);

    // If the requested resource is a file
    if (stats.isFile()) {
        // Serve static file
        log(`Requested static file: ${pathAbs}`);
        return res.sendFile(pathAbs);
    }
    
    // Zip and send if requested and enabled
    if (req.query.zip && opts.allowZipDownloads) {
        log(`Requested zip download of directory: ${pathAbs}`);

        // Process files recursively
        const entryArgs = [];
        let size = 0;
        const recurse = async (dirPath) => {
            const fileNames = await fs.readdir(dirPath);
            for (const fileName of fileNames) {
                if (opts.hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
                    continue;
                const filePathAbs = path.join(dirPath, fileName);
                const filePathRel = path.relative(pathAbs, filePathAbs);
                const stats = await fs.stat(filePathAbs);
                if (stats.isDirectory()) {
                    await recurse(filePathAbs);
                } else {
                    entryArgs.push([ filePathAbs, { name: filePathRel } ]);
                    size += stats.size;
                }
            }
        };
        await recurse(pathAbs);

        // Communicate to the client
        const zipFileName = path.basename(pathAbs) + '.zip';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        res.setHeader('Content-Length', size);

        // Create archive and pipe files to response
        const archive = archiver('zip', {
            zlib: { level: 0 } // No compression
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
    const limit = 1000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    for (let i = 0; i < Math.min(fileNames.length, limit); i++) {
        const fileName = fileNames[i + offset];

        // Skip if the file is hidden
        if (opts.hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
            continue;

        // Get file paths and stats
        const filePathRel = path.join(pathRel, fileName);
        const filePathAbs = path.join(pathAbs, fileName);
        const fileExt = path.extname(fileName).toLowerCase();
        const stats = await fs.stat(filePathAbs);
        const isDirectory = stats.isDirectory();
        let size = isDirectory ? '-' : stats.size;
        let modified = isDirectory ? '-' : stats.mtimeMs;

        // Process directories if enabled
        if (isDirectory && opts.statDirs) {
            size = 0;
            modified = 0;
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
            size = size || '-';
            modified = modified || '-';
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
        const filePathRelAlias = opts.allowCleanPathAliases ? await getPathAlias(filePathRel) : null;
        (isDirectory ? dirsOnly : filesOnly).push({
            name: fileName,
            path: opts.forceCleanPathAliases ? filePathRelAlias : filePathRel,
            pathAlias: filePathRelAlias,
            pathTrue: filePathRel,
            isDirectory,
            size,
            modified,
            type: fileType,
            icon: typeIcons[fileType]
        });

    }

    // Sort and combine files
    const sortType = req.query.sortType || 'name';
    const sortOrder = req.query.sortOrder || 'asc';
    const sortFunctions = {
        name: (a, b) => a.name.localeCompare(b.name, {
            sensitivity: 'base'
        }),
        size: (a, b) => a.size - b.size,
        modified: (a, b) => a.modified - b.modified
    };
    dirsOnly.sort(sortFunctions.name).sort(sortFunctions[sortType]);
    filesOnly.sort(sortFunctions.name).sort(sortFunctions[sortType]);
    if (sortOrder === 'desc') {
        dirsOnly.reverse();
        filesOnly.reverse();
    }

    log(`Processed ${dirsOnly.length} subdirs and ${filesOnly.length} files in directory: ${pathAbs}`);

    // Add parent directory
    const pathParts = pathRel.split('/').filter(Boolean);
    if (pathRel !== '/') {
        const pathRelParent = pathParts[pathParts.length - 1];
        const pathRelParentAlias = await getPathAlias(path.join(pathRel, './..'));
        dirsOnly.unshift({
            name: '..',
            path: opts.allowCleanPathAliases ? pathRelParentAlias : path.join(pathRel, './..'),
            pathAlias: pathRelParentAlias,
            pathTrue: pathRelParent,
            isDirectory: true,
            size: '-',
            modified: '-',
            type: 'folder',
            icon: 'drive_folder_upload'
        });
    }
    const files = [ ...dirsOnly, ...filesOnly ];

    // Get parent directory names and paths
    const ancestorDirs = [
        { name: opts.serverName, path: '/' },
    ];
    for (let i = 0; i < pathParts.length; i++) {
        const ancestorPathRel = '/' + pathParts.slice(0, i + 1).join('/');
        const ancestorPathRelAlias = await getPathAlias(ancestorPathRel);
        const ancestorName = pathParts[i];
        ancestorDirs.push({
            name: ancestorName,
            path: opts.forceCleanPathAliases ? ancestorPathRelAlias : ancestorPathRel,
            pathAlias: ancestorPathRelAlias,
            pathTrue: ancestorPathRel,
        });
    }

    // Finalize index data
    const data = {
        serverName: opts.serverName,
        ancestors: ancestorDirs,
        dir: ancestorDirs.pop(),
        sortType,
        sortOrder,
        files,
        fileTimeFormat: opts.fileTimeFormat,
        allowZipDownloads: opts.allowZipDownloads,
        fileSelectAction: opts.fileSelectAction,
        nodejsVersion: process.version,
        osPlatform: process.platform,
        osArch: process.arch,
        renderStartTime
    };

    // Return data as JSON if requested
    if (req.query.json) {
        log(`Sending JSON data for directory: ${pathAbs}`);
        return res.json({ data });
    }

    // Render index
    log(`Rendering file index for directory: ${pathAbs}`);
    const html = await ejs.renderFile(opts.ejsFilePath, { data });

    // Respond
    res.setHeader('Content-Type', 'text/html');
    return res.end(html);

};