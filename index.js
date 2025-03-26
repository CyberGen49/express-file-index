const Express = require('express');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} DefaultIndexOptions
 * @property {string} rootDir The root directory of the file index. Defaults to `./`.
 * @property {string} serverName The name to use for the root directory in the file index. Defaults to the hostname of the server.
 * @property {string[]} hiddenFilePrefixes A list of file prefixes that should be hidden from the file index. This option DOES NOT block access to these files; it only hides them from the index. Defaults to `[ '.', '_' ]`.
 * @property {string[]} indexFiles A list of file names that should be used as the index file for directories instead of the file list. Defaults to `[ 'index.html', 'index.htm' ]`.
 * @property {string[]} fileIndexEjs The path to an EJS template file to use for the file index. Defaults to the built-in template.
 * 
 * This option is not recommended for most use cases, but can be used to develop your own file index UI. See the project readme for details.
 * @property {string} fileTimeFormat A string representing the format of displayed file modification times. Defaults to `MMM D, YYYY`. See [Day.js formats](https://day.js.org/docs/en/display/format) for more information.
 */

/**
 * @type {DefaultIndexOptions}
 */
const defaultOpts = {
    rootDir: './',
    hiddenFilePrefixes: [ '.', '_' ],
    indexFiles: [ 'index.html', 'index.htm' ],
    serverName: '',
    fileTimeFormat: 'MMM D, YYYY'
};

/**
 * An Express middleware to serve static files and show a navigable file index for directories.
 * @param {DefaultIndexOptions} options Options for controlling this middleware.
 * @returns {Express.Router} An Express router to be used by your app.
 */
module.exports = (options = {}) => async (req, res, next) => {
    // Get paths and options
    const pathRoot = path.resolve(options.rootDir || defaultOpts.rootDir);
    const pathRel = path.normalize(decodeURI(req.path));
    const pathAbs = path.normalize(path.join(pathRoot, pathRel));
    const hiddenFilePrefixes = options.hiddenFilePrefixes || defaultOpts.hiddenFilePrefixes;
    const indexFiles = options.indexFiles || defaultOpts.indexFiles;
    const serverName = options.serverName || req.hostname || 'server';
    const fileTimeFormat = options.fileTimeFormat || defaultOpts.fileTimeFormat;
    // Make sure the file exists
    if (!fs.existsSync(pathAbs))
        return next();
    // Check if the request is a file or directory
    const stats = fs.statSync(pathAbs);
    if (stats.isDirectory()) {
        // Check for index files
        for (const name of indexFiles) {
            const pathIndexFile = path.join(pathAbs, name);
            if (fs.existsSync(pathIndexFile)) {
                return res.sendFile(pathIndexFile);
            }
        }
        // Read directory
        const fileNames = fs.readdirSync(pathAbs);
        const filesOnly = [];
        const dirsOnly = [];
        for (const fileName of fileNames) {
            // Skip if the file is hidden
            if (hiddenFilePrefixes.some(prefix => fileName.startsWith(prefix)))
                continue;
            // Get file paths and stats
            const filePathRel = path.join(pathRel, fileName);
            const filePathAbs = path.join(pathAbs, fileName);
            const fileExt = path.extname(fileName).toLowerCase();
            const stats = fs.statSync(filePathAbs);
            const isDir = stats.isDirectory();
            // Compile type categories with all even remotely common extensions
            const typeExtensions = require(path.join(__dirname, 'type-extensions.json'));
            // Determine file type and icon
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
            const fileType = isDir ? 'folder' : Object.keys(typeExtensions).find(type =>
                typeExtensions[type].includes(fileExt)
            ) || 'file';
            // Add to list
            (isDir ? dirsOnly : filesOnly).push({
                name: fileName,
                path: filePathRel,
                isDirectory: isDir,
                size: isDir ? '-' : stats.size,
                modified: isDir ? '-' : stats.mtimeMs,
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
        const html = await ejs.renderFile(path.join(__dirname, 'index.ejs'), {
            data: {
                serverName,
                ancestors: ancestorDirs,
                dir: ancestorDirs.pop(),
                files,
                fileTimeFormat,
                nodejsVersion: process.version,
                osPlatform: process.platform,
                osArch: process.arch
            }
        });
        // Respond
        res.setHeader('Content-Type', 'text/html');
        return res.end(html);
    } else {
        // Serve static file
        return res.sendFile(pathAbs);
    }
};