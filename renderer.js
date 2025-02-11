const { ipcRenderer } = require('electron');

const urlInput = document.getElementById('url-input');
const pathButton = document.getElementById('path-button');
const downloadButton = document.getElementById('download-button');
const progressBar = document.getElementById('progress-bar');
const statusLabel = document.getElementById('status-label');
const minimizeButton = document.getElementById('minimize-button');
const closeButton = document.getElementById('close-button');
const videoInfoContainer = document.getElementById('video-info');

let savePath = '';

pathButton.addEventListener('click', () => {
    ipcRenderer.send('choose-directory');
});

ipcRenderer.on('directory-selected', (event, path) => {
    savePath = path;
    statusLabel.textContent = `Pasta de destino: ${path}`;
    statusLabel.classList.add('fade-in');
});

downloadButton.addEventListener('click', () => {
    const url = urlInput.value;

    if (!url || !savePath) {
        showStatus('Por favor, insira a URL e escolha a pasta de destino.', 'error');
        return;
    }

    if (!isValidUrl(url)) {
        showStatus('URL inválida. Por favor, insira uma URL válida.', 'error');
        return;
    }

    showStatus('Carregando formatos disponíveis...', 'info');
    downloadButton.disabled = true;

    console.log('Solicitando formatos para:', url);
    ipcRenderer.send('get-formats', url);
});

ipcRenderer.on('formats-available', (event, formats) => {
    console.log('Formatos recebidos:', formats);
    downloadButton.disabled = false;
    if (formats && formats.length > 0) {
        showFormatSelection(formats);
    } else {
        showStatus('Nenhum formato disponível para este vídeo.', 'error');
    }
});

ipcRenderer.on('download-progress', (event, percent) => {
    progressBar.style.width = `${percent}%`;
});

ipcRenderer.on('download-complete', () => {
    showStatus('Download concluído!', 'success');
    downloadButton.disabled = false;
    progressBar.style.width = '100%';
    urlInput.value = '';
});

ipcRenderer.on('download-error', (event, error) => {
    showStatus(`Erro: ${error}`, 'error');
    downloadButton.disabled = false;
});

ipcRenderer.on('download-status', (event, message) => {
    showStatus(message, 'info');
});

minimizeButton.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

closeButton.addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

urlInput.addEventListener('input', debounce(() => {
    const url = urlInput.value.trim();
    if (url) {
        if (!isValidUrl(url)) {
            videoInfoContainer.innerHTML = `<p class="error">URL inválida. Por favor, insira uma URL válida.</p>`;
            return;
        }
        ipcRenderer.send('get-video-info', url);
    } else {
        videoInfoContainer.innerHTML = '';
    }
}, 500));

ipcRenderer.on('video-info-available', (event, videoInfo) => {
    videoInfoContainer.innerHTML = `
        <img src="${videoInfo.thumbnail}" alt="Thumbnail" style="width: 120px; height: auto;">
        <h3>${videoInfo.title}</h3>
        <p>Canal: ${videoInfo.channel}</p>
        <p>Duração: ${formatDuration(videoInfo.duration)}</p>
        <p>Visualizações: ${formatNumber(videoInfo.view_count)}</p>
    `;
});

ipcRenderer.on('video-info-error', (event, error) => {
    videoInfoContainer.innerHTML = `<p class="error">Erro ao carregar informações do vídeo: ${error}</p>`;
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function showStatus(message, type) {
    statusLabel.textContent = message;
    statusLabel.className = `fade-in ${type}`;
}

function showFormatSelection(formats) {
    console.log('Exibindo seleção de formatos');
    
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    
    const formatList = document.createElement('div');
    formatList.className = 'format-list';
    
    const title = document.createElement('h3');
    title.textContent = 'Selecione a resolução';
    formatList.appendChild(title);
    
    // Filtrar formatos únicos baseados na resolução
    const uniqueFormats = formats.reduce((acc, current) => {
        const x = acc.find(item => item.resolution === current.resolution);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);
    
    // Ordenar formatos do maior para o menor
    uniqueFormats.sort((a, b) => {
        return parseInt(b.resolution) - parseInt(a.resolution);
    });
    
    uniqueFormats.forEach(format => {
        const button = document.createElement('button');
        
        const resolutionSpan = document.createElement('span');
        resolutionSpan.className = 'resolution';
        resolutionSpan.textContent = format.resolution;
        
        const formatSpan = document.createElement('span');
        formatSpan.className = 'format';
        formatSpan.textContent = format.ext.toUpperCase();
        
        button.appendChild(resolutionSpan);
        button.appendChild(formatSpan);
        
        button.addEventListener('click', () => {
            console.log('Formato selecionado:', format);
            ipcRenderer.send('start-download', {
                url: urlInput.value,
                formatId: format.format_id,
                savePath: savePath
            });
            formatList.remove();
            overlay.remove();
        });
        formatList.appendChild(button);
    });
    
    document.body.appendChild(formatList);
    
    overlay.addEventListener('click', () => {
        formatList.remove();
        overlay.remove();
    });
}

function isValidUrl(url) {
    const urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // validate domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR validate ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
        '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
    return !!urlPattern.test(url);
}
