document.addEventListener('DOMContentLoaded', () => {

    // Format dates
    const fileTimes = document.querySelectorAll('[data-timestamp]');
    for (const fileTime of fileTimes) {
        if (fileTime.dataset.timestamp == '-')
            continue;
        const value = parseInt(fileTime.dataset.timestamp);
        fileTime.title = dayjs(value).format('YYYY-MM-DD HH:mm:ss');
        fileTime.innerText = dayjs(value).format(document.body.dataset.fileTimeFormat);
    }

    // Format sizes
    const fileSizes = document.querySelectorAll('[data-bytes]');
    for (const fileSize of fileSizes) {
        if (fileSize.dataset.bytes == '-')
            continue;
        const value = parseInt(fileSize.dataset.bytes);
        fileSize.title = value + ' bytes';
        fileSize.innerText = formatBytes(value);
    }

    // Add context menus to items
    const entries = document.querySelectorAll('.files .entry');
    for (const entry of entries) {
        const data = JSON.parse(entry.dataset.json);
        entry.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const items = [
                {
                    type: 'item',
                    icon: 'open_in_new',
                    label: 'Open...',
                    onClick: () => entry.click()
                },
                {
                    type: 'item',
                    icon: 'open_in_new',
                    label: 'Open in new tab...',
                    onClick: () => window.open(entry.href, '_blank')
                },
                { type: 'separator' }
            ];
            const canFoldersDownload = document.body.dataset.canFoldersDownload === 'true';
            const fileName = entry.querySelector('.name').title;
            if (data.type == 'folder' && canFoldersDownload && fileName !== '..') {
                items.push({
                    type: 'item',
                    icon: 'download',
                    label: 'Download folder as zip',
                    onClick: () => {
                        window.location.href = entry.href + '?zip=true';
                    }
                });
                items.push({ type: 'separator' });
            } else if (data.type != 'folder') {
                items.push({
                    type: 'item',
                    icon: 'download',
                    label: 'Download file',
                    onClick: () => {
                        const a = document.createElement('a');
                        a.href = entry.href;
                        a.download = fileName;
                        a.click();
                    }
                });
                items.push({ type: 'separator' });
            }
            items.push({
                type: 'item',
                icon: 'link',
                label: 'Copy link',
                onClick: () => {
                    navigator.clipboard.writeText(entry.href);
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
            const currentSortType = url.searchParams.get('sortType') || 'name';
            const currentSortOrder = url.searchParams.get('sortOrder') || 'asc';
            const currentSort = `${currentSortType}-${currentSortOrder}`;
            const items = [
                {
                    type: 'item',
                    label: 'Sort by name A-Z',
                    icon: currentSort == 'name-asc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => {
                        url.searchParams.delete('sortType');
                        url.searchParams.delete('sortOrder');
                        window.location.href = url.toString();
                    }
                },
                {
                    type: 'item',
                    label: 'Sort by name Z-A',
                    icon: currentSort == 'name-desc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => {
                        url.searchParams.delete('sortType');
                        url.searchParams.set('sortOrder', 'desc');
                        window.location.href = url.toString();
                    }
                },
                {
                    type: 'item',
                    label: 'Sort oldest to newest',
                    icon: currentSort == 'modified-asc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => {
                        url.searchParams.set('sortType', 'modified');
                        url.searchParams.delete('sortOrder');
                        window.location.href = url.toString();
                    }
                },
                {
                    type: 'item',
                    label: 'Sort newest to oldest',
                    icon: currentSort == 'modified-desc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => {
                        url.searchParams.set('sortType', 'modified');
                        url.searchParams.set('sortOrder', 'desc');
                        window.location.href = url.toString();
                    }
                },
                {
                    type: 'item',
                    label: 'Sort smallest to largest',
                    icon: currentSort == 'size-asc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => {
                        url.searchParams.set('sortType', 'size');
                        url.searchParams.delete('sortOrder');
                        window.location.href = url.toString();
                    }
                },
                {
                    type: 'item',
                    label: 'Sort largest to smallest',
                    icon: currentSort == 'size-desc' ? 'radio_button_checked' : 'radio_button_unchecked',
                    onClick: () => {
                        url.searchParams.set('sortType', 'size');
                        url.searchParams.set('sortOrder', 'desc');
                        window.location.href = url.toString();
                    }
                }
            ];
            showContextMenu({ items });
        });
    }

});