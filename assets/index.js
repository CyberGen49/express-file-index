const roundSmart = (num) => {
    if (num < 1)
        return parseFloat(num.toFixed(3));
    if (num < 10)
        return parseFloat(num.toFixed(2));
    if (num < 100)
        return parseFloat(num.toFixed(1));
    return parseFloat(num.toFixed(0));
};

const formatBytes = bytes => {
    const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB' ];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return `${roundSmart(bytes)} ${units[i]}`;
};

const mouse = { x: 0, y: 0 };
document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

const showContextMenu = (options, shouldPosition = true) => {
    options = options || {};
    options.width = options.width || 'auto';
    options.items = options.items || [];
    options.x = options.x || mouse.x;
    options.y = options.y || mouse.y;
    const elMenu = document.createElement('dialog');
    elMenu.classList.add('contextMenu', 'flex', 'col', 'gap-2');
    for (const item of options.items) {
        switch (item.type) {
            case 'item': {
                const btn = document.createElement('button');
                btn.classList = 'item btn secondary';
                btn.disabled = !!item.disabled;
                btn.innerHTML += `<span class="icon">${item.icon || ''}</span>`;
                btn.innerHTML += `<span class="label grow">${item.label}</span>`;
                if (item.hint) btn.innerHTML += `<span class="hint">${item.hint}</span>`;
                btn.onclick = async () => {
                    if (item.onClick) await item.onClick();
                    elMenu.close();
                };
                elMenu.appendChild(btn);
                break;
            }
            case 'element': {
                elMenu.appendChild(item.element);
                break;
            }
            case 'separator': {
                const el = document.createElement('div');
                el.classList.add('separator');
                elMenu.appendChild(el);
                break;
            }
        }
    }
    elMenu.addEventListener('click', () => {
        elMenu.close();
    });
    elMenu.addEventListener('keydown', (e) => {
        const items = elMenu.querySelectorAll('button.item:not(:disabled)');
        let index = [...items].indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            index = (index + 1) % items.length;
            items[index].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            index = (index - 1 + items.length) % items.length;
            items[index].focus();
        }
    });
    elMenu.addEventListener('close', () => {
        if (!elMenu.classList.contains('visible')) return;
        elMenu.classList.remove('visible');
        setTimeout(() => {
            elMenu.remove();
        }, 300);
    });
    document.body.appendChild(elMenu);
    elMenu.showModal();
    // Position menu
    if (shouldPosition) {
        elMenu.style.transition = 'none';
        setTimeout(() => {
            const rect = elMenu.getBoundingClientRect();
            const menuWidth = rect.width;
            const menuHeight = elMenu.scrollHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            let x = options.x;
            let y = options.y;
            if ((y + menuHeight) > screenHeight) {
                y = Math.max(0, (screenHeight - menuHeight - 8));
            }
            if ((x + menuWidth) > screenWidth) {
                x = Math.max(0, (x - menuWidth));
            }
            elMenu.style.left = `${x}px`;
            elMenu.style.top = `${y}px`;
            elMenu.style.height = `${menuHeight}px`;
        }, 10);
    }
    // Show menu
    setTimeout(() => {
        elMenu.style.transition = '';
        elMenu.classList.add('visible');
    }, 50);
    return elMenu;
};

const setColorMode = () => {
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.colorMode = isDarkMode ? 'dark' : 'light';
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isDarkMode ? '#1a1a1a' : '#f2f2f2');
    }
    const iconMeta = document.querySelector('link[rel="icon"]');
    if (iconMeta) {
        iconMeta.setAttribute('href', isDarkMode ? '?asset=icon-light.png' : '?asset=icon-dark.png');
    }
};

setColorMode();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setColorMode);

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
            if (entry.dataset.type == 'folder' && canFoldersDownload && fileName !== '..') {
                items.push({
                    type: 'item',
                    icon: 'download',
                    label: 'Download folder as zip',
                    onClick: () => {
                        window.location.href = entry.href + '?zip=true';
                    }
                });
                items.push({ type: 'separator' });
            } else if (entry.dataset.type != 'folder') {
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