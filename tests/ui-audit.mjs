import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/Tenma/kanvahati-pos/tests/artifacts/ui-audit';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runAudit() {
    console.log("🚀 Starting Playwright UI Audit...");
    const browser = await chromium.launch({ headless: true });
    
    const viewports = [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 }
    ];

    const pages = [
        { name: 'register-catalog', url: 'http://localhost:5173/?demoRole=super_admin#/' },
        { name: 'inventory', url: 'http://localhost:5173/stok?demoRole=super_admin' },
        { name: 'bundles', url: 'http://localhost:5173/promo?demoRole=super_admin' },
        { name: 'logs', url: 'http://localhost:5173/riwayat?demoRole=super_admin' },
        { name: 'rekapan', url: 'http://localhost:5173/rekapan?demoRole=super_admin' },
        { name: 'stats', url: 'http://localhost:5173/statistik?demoRole=super_admin' },
        { name: 'drawer', url: 'http://localhost:5173/kas?demoRole=super_admin' },
        { name: 'admin', url: 'http://localhost:5173/admin?demoRole=super_admin' }
    ];

    const issues = [];

    for (const vp of viewports) {
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            userAgent: vp.name === 'mobile' 
                ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
                : undefined
        });

        const page = await context.newPage();

        for (const p of pages) {
            console.log(`Auditing ${p.name} [${vp.name}]...`);
            try {
                await page.goto(p.url, { waitUntil: 'networkidle', timeout: 8000 }).catch(() => {});
                await page.waitForTimeout(1000);

                const screenshotPath = `${outDir}/${vp.name}-${p.name}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });

                // Detect horizontal overflow
                const overflow = await page.evaluate(() => {
                    const docWidth = document.documentElement.clientWidth;
                    const badElements = [];
                    document.querySelectorAll('*').forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > docWidth + 3) {
                            badElements.push({
                                tag: el.tagName,
                                id: el.id,
                                className: el.className ? String(el.className).slice(0, 50) : '',
                                right: rect.right,
                                docWidth
                            });
                        }
                    });
                    return {
                        hasHorizontalScroll: document.documentElement.scrollWidth > docWidth + 1,
                        badElements: badElements.slice(0, 3)
                    };
                });

                if (overflow.hasHorizontalScroll) {
                    issues.push({
                        page: p.name,
                        viewport: vp.name,
                        type: 'Horizontal Overflow',
                        detail: `Page scrollWidth > clientWidth. Elements: ${JSON.stringify(overflow.badElements)}`,
                        screenshot: screenshotPath
                    });
                }

                // If on inventory, test opening Empty Slot and CSV Import preview
                if (p.name === 'inventory') {
                    // Try clicking + Empty Slot button
                    const emptySlotBtn = page.locator('button:has-text("+ Empty Slot")');
                    if (await emptySlotBtn.count() > 0) {
                        await emptySlotBtn.first().click();
                        await page.waitForTimeout(600);
                        await page.screenshot({ path: `${outDir}/${vp.name}-inventory-after-empty-slot.png`, fullPage: true });
                    }
                }

                // If on bundles, test template download button and modal
                if (p.name === 'bundles') {
                    const addBundleBtn = page.locator('button:has-text("Tambah Bundle"), button:has-text("Tambah")');
                    if (await addBundleBtn.count() > 0) {
                        await addBundleBtn.first().click();
                        await page.waitForTimeout(600);
                        await page.screenshot({ path: `${outDir}/${vp.name}-bundles-modal.png`, fullPage: true });
                    }
                }

            } catch (err) {
                console.error(`Error on ${p.name} [${vp.name}]:`, err);
            }
        }
        await context.close();
    }

    await browser.close();
    console.log("UI Audit Finished. Detected Issues count:", issues.length);
    fs.writeFileSync(`${outDir}/issues.json`, JSON.stringify(issues, null, 2));
}

runAudit().catch(console.error);
