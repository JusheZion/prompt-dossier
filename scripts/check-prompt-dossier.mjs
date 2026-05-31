import { chromium } from "playwright";
import { spawn } from "node:child_process";

const port = 4173;
const url = `http://127.0.0.1:${port}`;
const screenshotPath = "output/playwright/prompt-dossier.png";

const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
  stdio: "pipe",
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Vite server did not become ready. Output:\n${output}`);
}

try {
  await waitForServer();

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(url);

  await page.getByRole("button", { name: "New Prompt", exact: true }).click();
  const editor = page.locator(".editor-panel");
  await editor.getByRole("textbox", { name: "Title", exact: true }).fill("Ocean city establishing shot");
  await editor
    .getByRole("textbox", { name: "Prompt text", exact: true })
    .fill("Wide establishing shot of the hidden ocean city at night.");
  await page.locator(".editor-panel select").first().selectOption("scene");
  await editor.getByRole("textbox", { name: "Tags", exact: true }).fill("ocean city, establishing");
  await editor.getByRole("textbox", { name: "Characters", exact: true }).fill("Kron");
  await editor.getByRole("textbox", { name: "Scenes", exact: true }).fill("Hidden Ocean City");
  await editor.getByRole("textbox", { name: "Variables", exact: true }).fill("camera_angle | aerial wide | required");
  await page.getByRole("button", { name: "Save Prompt" }).click();

  await page
    .getByLabel("Prompt library")
    .getByRole("heading", { name: "Ocean city establishing shot", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  console.log(
    JSON.stringify(
      {
        createdPrompt: true,
        copiedPrompt: true,
        screenshot: screenshotPath,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill("SIGTERM");
}
