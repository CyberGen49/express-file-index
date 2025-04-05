const closePreview = () => {
    const elPreview = document.querySelector('#preview');
    elPreview.classList.remove('visible');
    setTimeout(() => {
        elPreview.style.display = 'none';
        const elPreviewContent = document.querySelector('#previewContent');
        elPreviewContent.innerHTML = '';
    }, 100);
    // Remove query string
    const url = new URL(window.location.href);
    url.searchParams.delete('preview');
    history.pushState({}, '', url.toString());
}

const openPreview = () => {
    const elPreview = document.querySelector('#preview');
    elPreview.style.display = '';
    setTimeout(() => {
        elPreview.classList.add('visible');
    }, 10);
}

const previewFile = async data => {
    // Get elements
    const elPreviewName = document.querySelector('#previewFileName');
    const elPreviewFileSize = document.querySelector('#previewFileSize');
    const elPreviewFileModified = document.querySelector('#previewFileModified');
    const elPreviewContent = document.querySelector('#previewContent');
    const elPreviewDownload = document.querySelector('#previewDownload');
    // Update elements
    elPreviewName.innerText = data.name;
    elPreviewName.title = data.name;
    elPreviewFileSize.innerText = formatBytes(data.size);
    elPreviewFileSize.title = data.size + ' bytes';
    elPreviewFileModified.innerText = dayjs(data.modified).format(document.body.dataset.fileTimeFormat);
    elPreviewFileModified.title = dayjs(data.modified).format('YYYY-MM-DD HH:mm:ss');
    elPreviewDownload.href = data.pathTrue;
    // Define all web browser supported file types
    const maxTextSize = 1024 * 1024 * 1; // 1 MiB
    const ext = data.name.split('.').pop().toLowerCase();
    const types = {
        image: [ 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg' ],
        video: [ 'mp4', 'webm' ],
        audio: [ 'mp3', 'wav', 'ogg', 'aac' ],
        md: [ 'md', 'markdown' ],
        html: [ 'html', 'htm' ]
    }
    // Show preview according to the file type
    if (types.image.includes(ext)) {
        // Show image preview
        elPreviewContent.innerHTML = `<img src="${data.pathTrue}" alt="${data.name}" />`;
    } else if (types.video.includes(ext)) {
        // Show video preview
        elPreviewContent.innerHTML = `
            <video controls autoplay>
                <source src="${data.pathTrue}">
            </video>
        `;
    } else if (types.audio.includes(ext)) {
        // Show audio preview
        elPreviewContent.innerHTML = `
            <audio controls autoplay>
                <source src="${data.pathTrue}">
            </audio>
        `;
    } else {
        // Attempt to download file as text
        let text;
        if (data.size < maxTextSize) {
            text = await fetchTextFile(data.pathTrue);
        }
        // If the file was too big or not text, prompt to download
        if (!text) {
            elPreviewContent.innerHTML = /*html*/`
                <div class="card">
                    <div class="body col">
                        <h3 style="text-align: center; margin: 0;">
                            This file can't be previewed.
                        </h3>
                        <a href="${data.pathTrue}" download class="btn" onClick="closePreview()">
                            <span class="icon">download</span>
                            Download file - ${formatBytes(data.size)}
                        </a>
                    </div>
                </div>
            `;
        // Show markdown preview
        } else if (types.md.includes(ext)) {
            const html = markdownToSafeHTML(text);
            elPreviewContent.innerHTML = /*html*/`
                <div class="card">
                    <div class="body">${html}</div>
                </div>
            `;
            Prism.highlightAll(elPreviewContent);
        // Show text preview
        } else {
            elPreviewContent.innerHTML = /*html*/`
                <div class="card">
                    <pre class="body"><code class="language-${ext}"></code></pre>
                </div>
            `;
            const elCode = elPreviewContent.querySelector('code');
            let highlightedHtml = text;
            try {
                highlightedHtml = Prism.highlight(text, Prism.languages[ext], ext);
            } catch (error) {}
            elCode.innerHTML = highlightedHtml;
        }
    }
    // Set query string
    const url = new URL(window.location.href);
    url.searchParams.set('preview', data.name);
    history.pushState({}, '', url.toString());
    // Show preview dialog
    openPreview();
}

document.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        closePreview();
    }
});

document.addEventListener('DOMContentLoaded', async () => {

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

    // Loop through files to add context menus, click actions, and find readme
    const fileEntryElements = document.querySelectorAll('#fileEntries .entry');
    const fileSelectAction = document.body.dataset.fileSelectAction;
    let readmePath = null;
    for (const entry of fileEntryElements) {
        const data = JSON.parse(entry.dataset.json);
        if (data.name.toLowerCase() == 'readme.md' && !readmePath) {
            readmePath = data.pathTrue;
        }
        // Handle click actions
        entry.addEventListener('click', (e) => {
            switch (fileSelectAction) {
                case 'preview': {
                    if (data.type != 'folder' && data.size !== '-') {
                        e.preventDefault();
                        previewFile(data);
                    }
                    break;
                }
                case 'download': {
                    if (data.type != 'folder') {
                        e.preventDefault();
                        const a = document.createElement('a');
                        a.href = data.pathTrue;
                        a.download = data.name;
                        a.click();
                    }
                    break;
                }
            }
        });
        // Handle context menus
        entry.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const items = [];
            if (data.type != 'folder' && data.size > 0) {
                items.push({
                    type: 'item',
                    icon: 'visibility',
                    label: 'Preview file',
                    onClick: () => previewFile(data)
                });
                items.push({ type: 'separator' });
            }
            items.push({
                type: 'item',
                icon: 'open_in_new',
                label: 'Open file in this tab',
                onClick: () => entry.click()
            });
            items.push({
                type: 'item',
                icon: 'open_in_new',
                label: 'Open in new tab...',
                onClick: () => window.open(entry.href, '_blank')
            });
            items.push({ type: 'separator' });
            const canFoldersDownload = document.body.dataset.canFoldersDownload === 'true';
            const fileName = entry.querySelector('.name').title;
            if (data.type == 'folder' && canFoldersDownload && fileName !== '..') {
                items.push({
                    type: 'item',
                    icon: 'download',
                    label: 'Download folder as zip',
                    onClick: () => {
                        window.location.href = entry.href + '?format=zip';
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
            if (data.path == data.pathAlias) {
                items.push({
                    type: 'item',
                    icon: 'link',
                    label: 'Copy default file link',
                    onClick: () => {
                        navigator.clipboard.writeText(window.location.origin + data.pathTrue);
                    }
                });
                items.push({
                    type: 'item',
                    icon: 'link',
                    label: 'Copy clean alias file link',
                    onClick: () => {
                        navigator.clipboard.writeText(window.location.origin + data.pathAlias);
                    }
                });
            } else {
                items.push({
                    type: 'item',
                    icon: 'link',
                    label: 'Copy link',
                    onClick: () => {
                        navigator.clipboard.writeText(entry.href);
                    }
                });
            }
            showContextMenu({ items });
        });
        // Show preview if query string matches file name
        const url = new URL(window.location.href);
        const previewFileName = url.searchParams.get('preview');
        if (previewFileName && (data.name == previewFileName || data.path.split('/').pop() == previewFileName)) {
            previewFile(data);
        }
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

    // Close preview when background is clicked
    // But not when the buttons or the preview itself are clicked
    const elPreview = document.querySelector('#preview');
    const elPreviewTopbar = elPreview.querySelector('.topbar');
    const elPreviewContent = document.querySelector('#previewContent');
    elPreview.addEventListener('click', (e) => {
        if ([ elPreview, elPreviewTopbar, elPreviewContent ].includes(e.target)) {
            closePreview();
        }
    });

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

window.addEventListener('popstate', () => {
    closePreview();
});