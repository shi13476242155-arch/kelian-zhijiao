import { app, BrowserWindow, Menu, net, protocol, screen } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const windowWidth = 400;
  const windowHeight = Math.round(screenHeight * 0.92);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth,
    y: Math.round((screenHeight - windowHeight) / 2),
    resizable: true,
    frame: true,
    titleBarStyle: "default",
    title: "课链智教学生端",
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL("app://index.html");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register custom protocol for ES module support (must be after ready event)
const distDir = join(dirname(fileURLToPath(import.meta.url)), "../dist");
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("app", (request) => {
    const pathname = request.url.slice("app://".length);
    const filePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const fullPath = join(distDir, filePath || "index.html");
    const fileUrl = pathToFileURL(fullPath).href;
    return net.fetch(fileUrl);
  });
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
