const { app, BrowserWindow } = require('electron');
const BackEnd = require('./BackEnd.js');

const {
    Server,
    server_spec
} = require('./UI_BackEnd.js');


const server = new Server(server_spec);

console.log('waiting for server ready event');
server.on('ready', () => {
    console.log('server ready');

    // server start will change to observable?

    server.start(52000, function (err, cb_start) {
        if (err) {
            throw err;
        } else {
            // Should have build it by now...

            //console.log('server started');
            
            async function createMainWindow() {
                try {
                    // Instantiate and start backend, waiting until it's fully started.
                    const backend = new BackEnd();
                    console.log("Starting backend...");
                    await backend.start();
                    console.log("Backend started - creating main window");

                    const mainWindow = new BrowserWindow({
                        width: 1124,
                        height: 868,
                        webPreferences: {
                            nodeIntegration: true
                        }
                    });

                    // Change from loadFile to loadURL to connect to the server
                    mainWindow.loadURL('http://127.0.0.1:52000/');
                } catch (error) {
                    console.error("Error starting app:", error);
                }
            }

            app.whenReady().then(createMainWindow);

            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
            });

            app.on('window-all-closed', () => {
                if (process.platform !== 'darwin') app.quit();
            });
        }
    });
})
