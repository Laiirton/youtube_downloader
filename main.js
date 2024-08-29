const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { PythonShell } = require('python-shell');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    resizable: false,
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenu(null);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('choose-directory', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled) {
    event.reply('directory-selected', result.filePaths[0]);
  }
});

ipcMain.on('get-formats', (event, url) => {
  console.log('Recebida solicitação para obter formatos:', url);
  let options = {
    mode: 'text', // Mudar para 'text' para capturar toda a saída
    pythonPath: 'python',
    pythonOptions: ['-u'],
    scriptPath: path.join(__dirname),
    args: ['get_formats', url],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  };

  let pyshell = new PythonShell('youtube_downloader.py', options);
  let output = ''; // Variável para armazenar a saída

  pyshell.on('message', function (message) {
    output += message; // Concatenar a saída
  });

  pyshell.end(function (err) {
    if (err) {
      console.error('Erro ao obter formatos:', err);
      event.reply('download-error', err.toString());
    } else {
      if (output) { // Verificar se a saída não está vazia
        try {
          const formats = JSON.parse(output.trim()); // Fazer parse após concatenar toda a saída
          console.log('Formatos parseados:', formats);
          event.reply('formats-available', formats);
        } catch (parseError) {
          console.error('Erro ao fazer parse dos formatos:', parseError);
          event.reply('download-error', 'Erro ao processar os formatos do vídeo.');
        }
      } else {
        console.error('Nenhum formato recebido');
        event.reply('download-error', 'Nenhum formato disponível para este vídeo.');
      }
    }
  });
});

ipcMain.on('start-download', (event, { url, formatId, savePath }) => {
  let options = {
    mode: 'text',
    pythonPath: 'python',
    pythonOptions: ['-u'],
    scriptPath: path.join(__dirname),
    args: [url, formatId, savePath],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  };

  let pyshell = new PythonShell('youtube_downloader.py', options);

  pyshell.on('message', function (message) {
    if (message.startsWith('PROGRESS:')) {
      const percent = parseFloat(message.split(':')[1]);
      event.reply('download-progress', percent);
    } else if (message === 'COMPLETE') {
      event.reply('download-complete');
    } else if (message.startsWith('ERROR:')) {
      event.reply('download-error', message);
    } else {
      event.reply('download-status', message);
    }
  });

  pyshell.end(function (err) {
    if (err) {
      console.error('Error:', err);
      event.reply('download-error', err.toString());
    } else {
      event.reply('download-complete');
    }
  });
});

ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  app.quit();
});