document.addEventListener('DOMContentLoaded', async () => {

    const data = JSON.parse(document.body.dataset.file);

    // Define fallback HTML
    const htmlFallback = /*html*/`
        <div class="card column">
            <div class="body">
                <h3 style="text-align: center; margin: 0;">
                    This file can't be previewed.
                </h3>
                <a href="${data.pathTrue}" download class="btn" onClick="closePreview()">
                    <span class="icon">download</span>
                    Download file - ${data.sizeHuman}
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
    const elPreviewContent = document.querySelector('#content');
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
    const btnFullscreen = document.querySelector('.fullscreen');
    if (btnFullscreen) {
        const isFullscreen = !!document.fullscreenElement;
        btnFullscreen.querySelector('.icon').innerText = isFullscreen ? 'fullscreen_exit' : 'fullscreen';
    }
});