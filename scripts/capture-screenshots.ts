import puppeteer from "puppeteer";
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputDir = path.join(__dirname, "..", "docs", "screenshots");

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(baseUrl);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function capture() {
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`Using base URL: ${baseUrl}`);
  console.log(`Saving screenshots to: ${outputDir}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const routes = [
    { name: "review", path: "/review" },
    { name: "sources", path: "/sources" },
    { name: "alerts", path: "/alerts" },
    { name: "law-firm", path: "/law-firm" },
  ];

  for (const route of routes) {
    const url = `${baseUrl}${route.path}`;
    console.log(`Capturing ${url}...`);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const screenshotPath = path.join(outputDir, `${route.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved screenshot to ${screenshotPath}`);
    } catch (err) {
      console.error(`Failed to capture ${route.name}:`, err);
    }
  }

  await browser.close();
}

async function main() {
  let serverProcess: any = null;
  const alreadyRunning = await isServerRunning();

  if (!alreadyRunning) {
    console.log("Server not running. Starting next dev server...");
    serverProcess = exec("npm run dev", { cwd: path.join(__dirname, "..") });

    // Wait for server to start
    let retries = 30;
    while (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (await isServerRunning()) {
        console.log("Server is up!");
        break;
      }
      retries--;
    }

    if (retries === 0) {
      console.error("Server failed to start in time.");
      serverProcess.kill();
      process.exit(1);
    }
  } else {
    console.log("Server is already running.");
  }

  try {
    await capture();
  } finally {
    if (serverProcess) {
      console.log("Stopping local server...");
      serverProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
