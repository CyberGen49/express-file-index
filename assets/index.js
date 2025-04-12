document.addEventListener('DOMContentLoaded', async () => {

    // Loop through files to add context menus, click actions, and find readme
    const fileEntryElements = document.querySelectorAll('#fileEntries .entry');
    let readmePath = null;
    for (const entry of fileEntryElements) {
        const data = JSON.parse(entry.dataset.json);
        if (data.name.toLowerCase() == 'readme.md' && !readmePath) {
            readmePath = data.pathTrue;
        }
        const fileViewUrl = window.location.origin + data.path + '?format=render';
        // Handle context menus
        entry.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const items = [];
            const elFile = document.createElement('div');
            elFile.classList.add('file');
            elFile.innerHTML = /*html*/`
                <div class="icon ${data.type}"></div>
                <div class="details">
                    <div class="name"></div>
                    <div class="modified"></div>
                    <div class="size"></div>
                </div>
            `;
            const elIcon = elFile.querySelector('.icon');
            const elName = elFile.querySelector('.name');
            const elModified = elFile.querySelector('.modified');
            const elSize = elFile.querySelector('.size');
            elIcon.innerText = data.icon;
            elName.innerText = data.name == '..' ? 'Parent directory' : data.name;
            elModified.innerText = data.modifiedHuman;
            elSize.innerText = data.sizeHuman;
            elModified.style.display = !data.modified ? 'none' : '';
            elSize.style.display = !data.size ? 'none' : '';
            items.push({ type: 'element', element: elFile });
            items.push({ type: 'separator' });
            if (data.type != 'folder' && data.size > 0) {
                items.push({
                    type: 'item',
                    icon: 'visibility',
                    label: 'View file',
                    tooltip: `View this file in the current tab.`,
                    onClick: () => window.location.href = fileViewUrl
                });
                items.push({
                    type: 'item',
                    icon: 'visibility',
                    label: 'View file in new tab...',
                    tooltip: `View this file in a new tab.`,
                    onClick: () => window.open(fileViewUrl, '_blank')
                });
                items.push({ type: 'separator' });
            }
            items.push({
                type: 'item',
                icon: 'open_in_new',
                label: 'Open file',
                tooltip: `Open the file in the current tab and let your browser figure out what to do with it.`,
                onClick: () => window.location.href = entry.href
            });
            items.push({
                type: 'item',
                icon: 'open_in_new',
                label: 'Open file in new tab...',
                tooltip: `Open the file in a new tab and let your browser figure out what to do with it.`,
                onClick: () => window.open(entry.href, '_blank')
            });
            items.push({ type: 'separator' });
            const canFoldersDownload = document.body.dataset.canFoldersDownload === 'true';
            const fileName = entry.querySelector('.name').title;
            if (data.type == 'folder' && canFoldersDownload && fileName !== '..') {
                items.push({
                    type: 'item',
                    icon: 'download',
                    label: `Download folder as zip`,
                    tooltip: `Download this folder as a zip file, including all files in all subfolders.`,
                    onClick: () => {
                        window.location.href = entry.href + '?format=zip';
                    }
                });
                items.push({ type: 'separator' });
            } else if (data.type != 'folder') {
                items.push({
                    type: 'item',
                    icon: 'download',
                    label: `Download file`,
                    onClick: () => {
                        const a = document.createElement('a');
                        a.href = entry.href;
                        a.download = fileName;
                        a.click();
                    }
                });
                items.push({ type: 'separator' });
            }
            if (data.type != 'folder' && data.size > 0) {
                items.push({
                    type: 'item',
                    icon: 'link',
                    label: 'Copy file viewer link',
                    tooltip: `This link is ideal for sharing, allowing anyone to easily view the file in their browser without downloading it. It also includes metadata that produces a nice looking embed on social media.`,
                    onClick: () => {
                        navigator.clipboard.writeText(fileViewUrl);
                    }
                });
            }
            if (data.pathAlias) {
                items.push({
                    type: 'item',
                    icon: 'link',
                    label: 'Copy raw file link (clean)',
                    tooltip: `This link points directly to the file and does not include any metadata. It is suitable for embedding in other applications or for sharing with others.\n\nUnlike the default raw file link, this one has been sanitized of encoded characters to look more presentable.`,
                    onClick: () => {
                        navigator.clipboard.writeText(window.location.origin + data.pathAlias);
                    }
                });
            }
            items.push({
                type: 'item',
                icon: 'link',
                label: 'Copy raw file link',
                tooltip: `This link points directly to the file and does not include any metadata. It is suitable for embedding in other applications or for sharing with others.`,
                onClick: () => {
                    navigator.clipboard.writeText(window.location.origin + data.pathTrue);
                }
            });
            showContextMenu({ items });
        });
    }

    // Add button listeners
    const btnShareDir = document.getElementById('btnShareDir');
    if (btnShareDir) {
        btnShareDir.addEventListener('click', () => {
            const urlWithoutQuery = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(urlWithoutQuery);
        });
    }
    const btnSort = document.getElementById('btnSort');
    if (btnSort) {
        btnSort.addEventListener('click', () => {
            const url = new URL(window.location.href);
            const defaultSortType = document.body.dataset.defaultSortType;
            const defaultSortOrder = document.body.dataset.defaultSortOrder;
            const currentSortType = url.searchParams.get('sortType') || defaultSortType;
            const currentSortOrder = url.searchParams.get('sortOrder') || defaultSortOrder;
            const currentSort = `${currentSortType}-${currentSortOrder}`;
            const setSort = (type, order) => {
                if (defaultSortType == type) {
                    url.searchParams.delete('sortType');
                } else {
                    url.searchParams.set('sortType', type);
                }
                if (defaultSortOrder == order) {
                    url.searchParams.delete('sortOrder');
                } else {
                    url.searchParams.set('sortOrder', order);
                }
                window.location.href = url.toString();
            }
            const items = [
                {
                    type: 'item',
                    label: 'Sort by name A-Z',
                    icon: currentSort == 'name-asc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => setSort('name', 'asc')
                },
                {
                    type: 'item',
                    label: 'Sort by name Z-A',
                    icon: currentSort == 'name-desc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => setSort('name', 'desc')
                },
                {
                    type: 'item',
                    label: 'Sort oldest to newest',
                    icon: currentSort == 'modified-asc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => setSort('modified', 'asc')
                },
                {
                    type: 'item',
                    label: 'Sort newest to oldest',
                    icon: currentSort == 'modified-desc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => setSort('modified', 'desc')
                },
                {
                    type: 'item',
                    label: 'Sort smallest to largest',
                    icon: currentSort == 'size-asc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => setSort('size', 'asc')
                },
                {
                    type: 'item',
                    label: 'Sort largest to smallest',
                    icon: currentSort == 'size-desc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => setSort('size', 'desc')
                }
            ];
            showContextMenu({ items });
        });
    }

    // Load readme
    if (readmePath) {
        const elReadme = document.querySelector('#readme');
        const elReadmeBody = document.querySelector('#readme > .body');
        elReadmeBody.innerHTML = '<p><em>Loading readme...</em></p>';
        elReadme.style.display = '';
        const res = await axios.get(readmePath);
        const markdown = res.data;
        const html = markdownToSafeHTML(markdown);
        elReadmeBody.innerHTML = html;
        Prism.highlightAll(elReadmeBody);
    }

});