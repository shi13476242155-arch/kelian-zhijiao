import { app, BrowserWindow, Menu, screen } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let mainWindow: BrowserWindow | null = null;

const distDir = join(dirname(fileURLToPath(import.meta.url)), "../dist");

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const windowWidth = Math.min(1280, Math.round(screenWidth * 0.85));
  const windowHeight = Math.min(800, Math.round(screenHeight * 0.85));

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    minWidth: 960,
    minHeight: 600,
    resizable: true,
    frame: true,
    titleBarStyle: "default",
    title: "课链智教教师工作台",
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(distDir, "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
