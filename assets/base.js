const formatSecondsToTimestamp = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Wrap the string to a specific length on word boundaries
// or if the string is too long, wrap it to the next line
// Credit to gpt-4o
function wrapString(input, maxLength) {
    const lines = input.split('\n');
    const wrappedLines = lines.map(line => {
        const words = line.split(' ');
        let currentLine = '';
        let result = [];

        words.forEach(word => {
            while (word.length > maxLength) {
                result.push(word.slice(0, maxLength));
                word = word.slice(maxLength);
            }

            if ((currentLine + word).length > maxLength) {
                result.push(currentLine.trim());
                currentLine = '';
            }
            currentLine += word + ' ';
        });

        result.push(currentLine.trim());
        return result.join('\n');
    });

    return wrappedLines.join('\n');
}

// Returns true if a string is plain text, false if it contains binary data
// This will be used to determine if the contents of a file are text or binary
const isStringPlainText = (str) => {
    if (str.length === 0) return true;
    const regex = /^[\x09\x0A\x0D\x20-\x7E\xA0-\uFFFF]+$/;
    return regex.test(str);
}

// Assuming marked and dompurify are already included in the project
const markdownToSafeHTML = (markdown) => {
    const html = marked.parse(markdown);
    return DOMPurify.sanitize(html);
}

const fetchTextFile = async url => {
    const res = await axios.get(url, {
        responseType: 'text'
    });
    const text = res.data;
    if (isStringPlainText(text)) {
        return text;
    }
    return null;
}

const openWindow = (url, width, height) => {
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    const win = window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
    if (win) {
        win.focus();
    } else {
        alert(`Enable popups for this site to open a new window.`);
    }
}

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
                if (item.tooltip) btn.title = wrapString(item.tooltip, 75);
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
    elMenu.addEventListener('click', (e) => {
        if (e.target !== elMenu) return;
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
    const iconMeta = document.querySelector('link[rel="icon"]');
    if (iconMeta) {
        iconMeta.setAttribute('href', isDarkMode ? '?expressFileIndexAsset=icon-light.png' : '?expressFileIndexAsset=icon-dark.png');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setColorMode();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setColorMode);
});