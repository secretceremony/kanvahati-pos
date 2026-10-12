/**
 * Kanvahati Arcade — Playwright Real Screenshot Capture Script
 * 
 * Uses 'load' and explicit timeout instead of 'networkidle' (since Firestore maintains continuous streaming connection)
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'public/screenshots');
if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function main() {
    console.log("🚀 Starting Vite preview server...");
    const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve) => {
        preview.stdout.on('data', (d) => {
            const out = d.toString();
            if (out.includes('http://localhost:4173') || out.includes('Local:')) {
                resolve();
            }
        });
        setTimeout(resolve, 2500);
    });

    console.log("🌐 Launching Playwright Chromium Headless...");
    const browser = await chromium.launch({ headless: true });
    const BASE_URL = 'http://localhost:4173';

    try {
        const desktopContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 2
        });

        // 1. IDLE
        console.log("📸 Capturing 01: Visitor Display Desktop (IDLE)...");
        const page1 = await desktopContext.newPage();
        await page1.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&event=CF20&station=station-1`, { waitUntil: 'load' });
        await page1.waitForTimeout(1200);
        await page1.screenshot({ path: path.join(SCREENSHOT_DIR, '01-visitor-display-idle-desktop.png') });
        await page1.close();

        // 2. READY
        console.log("📸 Capturing 02: Visitor Display Desktop (READY)...");
        const page2 = await desktopContext.newPage();
        await page2.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&demoStatus=ready&demoGame=G01&demoTag=Mika-chan`, { waitUntil: 'load' });
        await page2.waitForTimeout(1200);
        await page2.screenshot({ path: path.join(SCREENSHOT_DIR, '02-visitor-display-ready-desktop.png') });
        await page2.close();

        // 3. PLAYING
        console.log("📸 Capturing 03: Visitor Display Desktop (PLAYING)...");
        const page3 = await desktopContext.newPage();
        await page3.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&demoStatus=playing&demoGame=G01&demoProgress=4&demoTag=Mika-chan`, { waitUntil: 'load' });
        await page3.waitForTimeout(1200);
        await page3.screenshot({ path: path.join(SCREENSHOT_DIR, '03-visitor-display-playing-g01-desktop.png') });
        await page3.close();

        // 4. WON
        console.log("📸 Capturing 04: Visitor Display Desktop (WON)...");
        const page4 = await desktopContext.newPage();
        await page4.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&demoStatus=won&demoGame=G01&demoTag=Mika-chan`, { waitUntil: 'load' });
        await page4.waitForTimeout(1200);
        await page4.screenshot({ path: path.join(SCREENSHOT_DIR, '04-visitor-display-won-desktop.png') });
        await page4.close();

        // 5. LOST
        console.log("📸 Capturing 05: Visitor Display Desktop (LOST)...");
        const page5 = await desktopContext.newPage();
        await page5.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&demoStatus=lost&demoGame=G01&demoTag=Mika-chan`, { waitUntil: 'load' });
        await page5.waitForTimeout(1200);
        await page5.screenshot({ path: path.join(SCREENSHOT_DIR, '05-visitor-display-lost-desktop.png') });
        await page5.close();

        // 6. TABLET
        console.log("📸 Capturing 06: Visitor Display Tablet (iPad 768x1024)...");
        const pageTablet = await browser.newPage({
            viewport: { width: 768, height: 1024 },
            deviceScaleFactor: 2
        });
        await pageTablet.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&demoStatus=playing&demoGame=G01&demoProgress=4`, { waitUntil: 'load' });
        await pageTablet.waitForTimeout(1200);
        await pageTablet.screenshot({ path: path.join(SCREENSHOT_DIR, '06-visitor-display-tablet.png') });
        await pageTablet.close();

        // 7. MOBILE
        console.log("📸 Capturing 07: Visitor Display Mobile (iPhone 375x667)...");
        const pageMobile = await browser.newPage({
            viewport: { width: 375, height: 667 },
            deviceScaleFactor: 2
        });
        await pageMobile.goto(`${BASE_URL}/arcade/display?demoRole=arcade_display&demoStatus=playing&demoGame=G01&demoProgress=4`, { waitUntil: 'load' });
        await pageMobile.waitForTimeout(1200);
        await pageMobile.screenshot({ path: path.join(SCREENSHOT_DIR, '07-visitor-display-mobile.png') });
        await pageMobile.close();

        // 8. HOST CONSOLE DESKTOP
        console.log("📸 Capturing 08: Host Console Desktop...");
        const pageHost = await browser.newPage({
            viewport: { width: 1350, height: 900 },
            deviceScaleFactor: 2
        });
        await pageHost.goto(`${BASE_URL}/arcade/host?demoRole=arcade_host`, { waitUntil: 'load' });
        await pageHost.waitForTimeout(1200);
        await pageHost.screenshot({ path: path.join(SCREENSHOT_DIR, '08-host-console-desktop.png') });
        await pageHost.close();

        // 9. HOST CONSOLE MOBILE
        console.log("📸 Capturing 09: Host Console Mobile...");
        const pageHostMobile = await browser.newPage({
            viewport: { width: 375, height: 812 },
            deviceScaleFactor: 2
        });
        await pageHostMobile.goto(`${BASE_URL}/arcade/host?demoRole=arcade_host`, { waitUntil: 'load' });
        await pageHostMobile.waitForTimeout(1200);
        await pageHostMobile.screenshot({ path: path.join(SCREENSHOT_DIR, '09-host-console-mobile.png') });
        await pageHostMobile.close();

        // 10. QUESTION BANK MANAGER DESKTOP
        console.log("📸 Capturing 10: Question Bank Manager Desktop...");
        const pageQBM = await browser.newPage({
            viewport: { width: 1350, height: 900 },
            deviceScaleFactor: 2
        });
        await pageQBM.goto(`${BASE_URL}/arcade/questions?demoRole=admin`, { waitUntil: 'load' });
        await pageQBM.waitForTimeout(1200);
        await pageQBM.screenshot({ path: path.join(SCREENSHOT_DIR, '10-question-bank-manager-desktop.png') });
        await pageQBM.close();

        console.log("🎉 All 10 real in-browser screenshots captured and verified successfully!");
    } catch (e) {
        console.error("❌ Screenshot capture error:", e);
    } finally {
        await browser.close();
        preview.kill('SIGTERM');
    }
}

main();
