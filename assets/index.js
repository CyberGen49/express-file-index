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
    history.replaceState({}, '', url.toString());
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
    const htmlFallback = /*html*/`
        <div class="card column">
            <div class="body">
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
    // Define all web browser supported file types
    const maxTextSize = 1024 * 1024 * 1; // 1 MiB
    const ext = data.name.split('.').pop().toLowerCase();
    const types = {
        image: [ 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg' ],
        video: [ 'mp4', 'webm' ],
        audio: [ 'mp3', 'wav', 'ogg', 'aac', 'wav' ],
        md: [ 'md', 'markdown' ],
        html: [ 'html', 'htm' ]
    }
    // Show preview according to the file type
    if (types.image.includes(ext)) {
        // Show image preview
        elPreviewContent.innerHTML = /*html*/`
            <div class="card image">
                <div class="body">
                    <img src="${data.pathTrue}" alt="${data.name}" />
                </div>
            </div>
        `;
        const img = elPreviewContent.querySelector('img');
        img.addEventListener('error', () => {
            elPreviewContent.innerHTML = htmlFallback;
        });
    } else if (types.video.includes(ext)) {

        // Show video preview
        elPreviewContent.innerHTML = /*html*/`
            <div class="card video">
                <div class="body" data-color-mode="dark">
                    <video autoplay src="${data.pathTrue}"></video>
                    <div class="overlay visible">
                        <div class="controls">
                            <button class="btn secondary square playPause">
                                <span class="icon">play_arrow</span>
                            </button>
                            <div class="progress">
                                <div class="current">0:00</div>
                                <input type="range" min="0" max="100" value="0" step="0.001" style="--value: 0;" />
                                <div class="duration">0:00</div>
                            </div>
                            <button class="btn secondary square fullscreen">
                                <span class="icon">fullscreen</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const video = elPreviewContent.querySelector('video');
        const btnPlayPause = elPreviewContent.querySelector('.playPause');
        const btnFullscreen = elPreviewContent.querySelector('.fullscreen');
        const elProgress = elPreviewContent.querySelector('.progress input[type="range"]');
        const elTsCurrent = elPreviewContent.querySelector('.progress .current');
        const elTsDuration = elPreviewContent.querySelector('.progress .duration');
        const overlay = elPreviewContent.querySelector('.overlay');

        video.addEventListener('error', () => {
            elPreviewContent.innerHTML = htmlFallback;
        });

        let controlsTimeout;
        const showControls = () => {
            overlay.classList.add('visible');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                hideControls();
            }, 3000);
        };
        const hideControls = () => {
            if (!video.paused) {
                overlay.classList.remove('visible');
            } else {
                showControls();
            }
        };
        const toggleControls = () => {
            if (overlay.classList.contains('visible')) {
                hideControls();
            } else {
                showControls();
            }
        };

        overlay.addEventListener('mousemove', () => {
            if (matchMedia('(hover: none)').matches) return;
            showControls();
        });
        overlay.addEventListener('mouseleave', () => {
            if (matchMedia('(hover: none)').matches) return;
            hideControls();
        });

        btnPlayPause.addEventListener('click', () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });
        video.addEventListener('play', () => {
            btnPlayPause.querySelector('.icon').innerText = 'pause';
            showControls();
        });
        video.addEventListener('pause', () => {
            btnPlayPause.querySelector('.icon').innerText = 'play_arrow';
            showControls();
        });

        video.addEventListener('timeupdate', () => {
            const percent = (video.currentTime / video.duration) * 100;
            const tsCurrent = formatSecondsToTimestamp(video.currentTime);
            const tsDuration = formatSecondsToTimestamp(video.duration);
            elProgress.value = percent;
            elProgress.style.setProperty('--value', percent);
            elTsCurrent.innerText = tsCurrent;
            elTsDuration.innerText = tsDuration;
        });
        elProgress.addEventListener('input', () => {
            const percent = elProgress.value;
            elProgress.style.setProperty('--value', percent);
            video.currentTime = video.duration * (percent / 100);
        });

        btnFullscreen.addEventListener('click', () => {
            const container = elPreviewContent.querySelector('.card.video .body');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                const canHover = !matchMedia('(hover: none)').matches;
                if (canHover) {
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                } else {
                    toggleControls();
                }
            }
        });

    } else if (types.audio.includes(ext)) {

        // Show audio preview
        elPreviewContent.innerHTML = /*html*/`
            <div class="card audio">
                <div class="body">
                    <audio autoplay src="${data.pathTrue}" style="display: none"></audio>
                    <div class="times">
                        <div class="current">0:00</div>
                        <div class="grow"></div>
                        <div class="duration">0:00</div>
                    </div>
                    <div class="progress">
                        <input type="range" min="0" max="100" value="0" step="0.001" style="--value: 0;" />
                    </div>
                    <div class="controls">
                        <button class="btn secondary square backward">
                            <span class="icon">replay_10</span>
                        </button>
                        <button class="btn square playPause">
                            <span class="icon">play_arrow</span>
                        </button>
                        <button class="btn secondary square forward">
                            <span class="icon">forward_10</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const audio = elPreviewContent.querySelector('audio');
        const btnPlayPause = elPreviewContent.querySelector('.playPause');
        const btnBackward = elPreviewContent.querySelector('.backward');
        const btnForward = elPreviewContent.querySelector('.forward');
        const elProgress = elPreviewContent.querySelector('.progress input[type="range"]');
        const elTsCurrent = elPreviewContent.querySelector('.current');
        const elTsDuration = elPreviewContent.querySelector('.duration');

        audio.addEventListener('error', () => {
            elPreviewContent.innerHTML = htmlFallback;
        });

        btnPlayPause.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
            } else {
                audio.pause();
            }
        });

        btnBackward.addEventListener('click', () => {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
        });
        btnForward.addEventListener('click', () => {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        });
        
        audio.addEventListener('play', () => {
            btnPlayPause.querySelector('.icon').innerText = 'pause';
        });
        audio.addEventListener('pause', () => {
            btnPlayPause.querySelector('.icon').innerText = 'play_arrow';
        });

        audio.addEventListener('timeupdate', () => {
            const percent = (audio.currentTime / audio.duration) * 100;
            const tsCurrent = formatSecondsToTimestamp(audio.currentTime);
            const tsDuration = formatSecondsToTimestamp(audio.duration);
            elProgress.value = percent;
            elProgress.style.setProperty('--value', percent);
            elTsCurrent.innerText = tsCurrent;
            elTsDuration.innerText = tsDuration;
        });
        elProgress.addEventListener('input', () => {
            const percent = elProgress.value;
            elProgress.style.setProperty('--value', percent);
            audio.currentTime = audio.duration * (percent / 100);
        });

    } else {
        // Attempt to download file as text
        let text;
        if (data.size < maxTextSize) {
            text = await fetchTextFile(data.pathTrue);
        }
        // If the file was too big or not text, prompt to download
        if (!text) {
            elPreviewContent.innerHTML = htmlFallback;
        // Show markdown preview
        } else if (types.md.includes(ext)) {
            const html = markdownToSafeHTML(text);
            elPreviewContent.innerHTML = /*html*/`
                <div class="card html">
                    <div class="body">${html}</div>
                </div>
            `;
            Prism.highlightAll(elPreviewContent);
        // Show text preview
        } else {
            elPreviewContent.innerHTML = /*html*/`
                <div class="card text">
                    <pre class="body"><code class="language-${ext}"></code></pre>
                </div>
            `;
            const elCode = elPreviewContent.querySelector('code');
            let htmlHighlighted = text;
            try {
                htmlHighlighted = Prism.highlight(text, Prism.languages[ext], ext);
            } catch (error) {}
            elCode.innerHTML = htmlHighlighted;
        }
    }
    // Set query string
    const url = new URL(window.location.href);
    url.searchParams.set('preview', data.path.split('/').pop());
    history.pushState({}, '', url.toString());
    // Show preview dialog
    openPreview();
}

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
            elName.innerText = data.name;
            if (data.modified == '-')
                elModified.style.display = 'none';
            else
                elModified.innerText = dayjs(data.modified).format(document.body.dataset.fileTimeFormat);
            if (data.size == '-')
                elSize.style.display = 'none';
            else
                elSize.innerText = formatBytes(data.size);
            items.push({ type: 'element', element: elFile });
            items.push({ type: 'separator' });
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
                label: 'Open file',
                onClick: () => window.location.href = entry.href
            });
            items.push({
                type: 'item',
                icon: 'open_in_new',
                label: 'Open file in new tab...',
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
            items.push({
                type: 'item',
                icon: 'link',
                label: 'Copy file preview link',
                onClick: () => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('preview', data.path.split('/').pop());
                    navigator.clipboard.writeText(url.toString());
                }
            });
            if (data.pathAlias) {
                items.push({
                    type: 'item',
                    icon: 'link',
                    label: 'Copy file link (clean)',
                    onClick: () => {
                        navigator.clipboard.writeText(window.location.origin + data.pathAlias);
                    }
                });
            }
            items.push({
                type: 'item',
                icon: 'link',
                label: 'Copy file link',
                onClick: () => {
                    navigator.clipboard.writeText(window.location.origin + data.pathTrue);
                }
            });
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

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    const elPreviewContent = document.querySelector('#previewContent');
    const media = elPreviewContent.querySelector('video') || elPreviewContent.querySelector('audio');
    switch (e.key) {
        case ' ':
            if (!media) break;
            e.preventDefault();
            if (media.paused) {
                media.play();
            } else {
                media.pause();
            }
            break;
        case 'ArrowRight':
            if (!media) break;
            media.currentTime = Math.min(media.duration, media.currentTime + 10);
            break;
        case 'ArrowLeft':
            if (!media) break;
            media.currentTime = Math.max(0, media.currentTime - 10);
            break;
        case 'Escape':
            closePreview();
            break;
    }
});

document.addEventListener('fullscreenchange', () => {
    const elPreview = document.querySelector('#preview');
    const btnFullscreen = elPreview.querySelector('.fullscreen');
    if (btnFullscreen) {
        const isFullscreen = !!document.fullscreenElement;
        btnFullscreen.querySelector('.icon').innerText = isFullscreen ? 'fullscreen_exit' : 'fullscreen';
    }
});