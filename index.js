const fs = require('fs').promises; // Use the promise-based fs API
const path = require('path');
const Express = require('express');
const ejs = require('ejs');
const archiver = require('archiver');
const { marked } = require('marked');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

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
 * **IMPORTANT:** This option DOES NOT block access to these files; it only hides them from view in the index. They are still downloadable by path and in zip archives.
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
 * @property {string[]} ejsFilePath The path to an EJS template file to use for the file index. 
 * 
 * This option is not recommended for most use cases, but can be used to develop your own file index UI. See the project readme for details.
 * 
 * Defaults to the built-in template.
 * @property {string} fileTimeFormat A string representing the format of displayed file modification times using [Day.js format placeholders](https://day.js.org/docs/en/display/format).
 * 
 * Defaults to `MMM D, YYYY`.
 * @property {string} enableReadmes Whether readme.md files should be parsed and displayed in the file index.
 * 
 * Defaults to `true`.
 * @property {boolean} enableLogging Whether debug/activity logs should be printed to the console.
 * 
 * Defaults to `false`.
 */

const window = new JSDOM('').window;
const purify = DOMPurify(window);
const mdToHtml = md => {
    const dirtyHtml = marked(md);
    const cleanHtml = purify.sanitize(dirtyHtml);
    return cleanHtml;
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
    enableReadmes: true,
    enableLogging: false
};

/**
 * An Express middleware to serve static files and show a navigable file index for directories.
 * @param {DefaultIndexOptions} options Options for controlling this middleware.
 * @returns {Express.Router} An Express router to be used by your app.
 */
module.exports = (options = {}) => async (req, res, next) => {

    // Get paths and options
    const renderStartTime = Date.now();
    const pathRoot = path.resolve(options.rootDir || defaultOpts.rootDir);
    const pathRel = path.normalize('/' + decodeURI(req.path));
    const pathAbs = path.normalize(path.join(pathRoot, pathRel));
    const serverName = options.serverName || req.hostname || 'server';
    const hiddenFilePrefixes = options.hiddenFilePrefixes || defaultOpts.hiddenFilePrefixes;
    const indexFiles = options.indexFiles || defaultOpts.indexFiles;
    const handle404s = options.handle404 || defaultOpts.handle404;
    const handle404Document = options.handle404Document || defaultOpts.handle404Document;
    const statDirs = options.statDirs || defaultOpts.statDirs;
    const allowZipDownloads = options.allowZipDownloads || defaultOpts.allowZipDownloads;
    const ejsFilePath = options.ejsFilePath || defaultOpts.ejsFilePath;
    const fileTimeFormat = options.fileTimeFormat || defaultOpts.fileTimeFormat;
    const enableReadmes = options.enableReadmes || defaultOpts.enableReadmes;
    const enableLogging = options.enableLogging || defaultOpts.enableLogging;

    // Logging function
    const log = (message) => {
        if (!enableLogging) return;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`[${ip}] ${message}`);
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

    // Make sure the file exists
    try {
        await fs.access(pathAbs);
    } catch {
        // Handle error 404 if enabled
        if (handle404s) {
            log(`Handling 404 for file: ${pathAbs}`);
            return res.status(404).sendFile(handle404Document);
        } else {
            return next();
        }
    }

    // Check if the request is a file or directory
    const stats = await fs.stat(pathAbs);
    if (stats.isDirectory()) {

        // Zip and send if requested and enabled
        if (req.query.zip && allowZipDownloads) {
            log(`Requested zip download of directory: ${pathAbs}`);
            // Process files recursively
            const entryArgs = [];
            let size = 0;
            const recurse = async (dirPath) => {
                const fileNames = await fs.readdir(dirPath);
                for (const fileName of fileNames) {
                    if (hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
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
            archive.on('error', (err) => res.status(500).send({ error: err.message }));
            archive.on('entry', entry => {
                log(`Added file to zip: ${entry.name}`);
            })
            archive.on('close', entry => {
                log(`Finished zip download of directory: ${pathAbs}`);
            })
            archive.pipe(res);
            for (const args of entryArgs) {
                archive.file(...args);
            }
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
        for (const name of indexFiles) {
            const pathIndexFile = path.join(pathAbs, name);
            try {
                await fs.access(pathIndexFile);
                log(`Requested index file: ${pathIndexFile}`);
                return res.sendFile(pathIndexFile);
            } catch {
                // Continue to the next index file
            }
        }

        // Read directory
        const fileNames = await fs.readdir(pathAbs);
        const filesOnly = [];
        const dirsOnly = [];
        let readmeHtml = null;
        let readmePath = null;
        for (const fileName of fileNames) {

            // Skip if the file is hidden
            if (hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
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
            if (isDirectory && statDirs) {
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

            // Process readme if enabled
            const fileNameLower = fileName.toLowerCase();
            if (!isDirectory && enableReadmes && fileNameLower === 'readme.md' && !readmeHtml) {
                log(`Processing readme file: ${filePathAbs}`);
                const md = await fs.readFile(filePathAbs, 'utf8');
                readmeHtml = mdToHtml(md);
                readmePath = filePathRel;
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
            (isDirectory ? dirsOnly : filesOnly).push({
                name: fileName,
                path: filePathRel,
                isDirectory,
                size,
                modified,
                type: fileType,
                icon: typeIcons[fileType]
            });

        }
        log(`Read directory containing ${dirsOnly.length} subdirs and ${filesOnly.length} files: ${pathAbs}`);

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

        // Add parent directory
        if (pathRel !== '/') {
            dirsOnly.unshift({
                name: '..',
                path: path.join(pathRel, '..'),
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
            { name: serverName, path: '/' },
        ];
        const pathParts = pathRel.split('/').filter(Boolean);
        for (let i = 0; i < pathParts.length; i++) {
            const parentPath = '/' + pathParts.slice(0, i + 1).join('/');
            const parentName = pathParts[i];
            ancestorDirs.push({ name: parentName, path: parentPath });
        }

        // Render index
        log(`Rendering file index for directory: ${pathAbs}`);
        const html = await ejs.renderFile(ejsFilePath, {
            data: {
                serverName,
                ancestors: ancestorDirs,
                dir: ancestorDirs.pop(),
                sortType,
                sortOrder,
                files,
                fileTimeFormat,
                allowZipDownloads,
                readmeHtml,
                readmePath,
                nodejsVersion: process.version,
                osPlatform: process.platform,
                osArch: process.arch,
                renderStartTime
            }
        });

        // Respond
        res.setHeader('Content-Type', 'text/html');
        return res.end(html);

    } else {

        // Serve static file
        log(`Requested static file: ${pathAbs}`);
        return res.sendFile(pathAbs);

    }
};