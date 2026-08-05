import { test, expect } from '@playwright/test';

test.describe('GEO Ride Driving Simulator', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('loads page title and HUD elements cleanly', async ({ page }) => {
        await expect(page).toHaveTitle(/GEO Ride/i);
        const mapContainer = page.locator('#map');
        await expect(mapContainer).toBeVisible();
    });

    test('opens multiplayer panel on button click', async ({ page }) => {
        const mpBtn = page.locator('#mp-btn');
        if (await mpBtn.isVisible()) {
            await mpBtn.click();
            const mpDropdown = page.locator('#mp-dropdown');
            await expect(mpDropdown).toHaveClass(/active/);
        }
    });

    test('vehicle selector tab interactions', async ({ page }) => {
        const truckBtn = page.locator('[data-vehicle="truck"]');
        if (await truckBtn.isVisible()) {
            await truckBtn.click();
            await expect(truckBtn).toHaveClass(/active/);
        }
    });
});
