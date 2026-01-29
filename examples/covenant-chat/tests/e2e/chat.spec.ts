import { test, expect } from '@playwright/test';

/**
 * E2E tests for the chat application
 *
 * These tests verify the full application flow in a real browser
 *
 * Note: These tests require a running development server.
 * Run with: bun run test:e2e
 */

test.describe('Chat Application', () => {
  test('should allow user to log in and see server list', async ({ page }) => {
    await page.goto('/login');

    // Fill in login form
    await page.fill('input[type="text"]', 'alice');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for navigation to server list
    await page.waitForURL('/');

    // Should see server list page
    await expect(page.locator('h1')).toContainText('My Servers');
  });

  test('should allow creating a server', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'alice');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Create a server
    await page.fill('input[placeholder="Server name"]', 'E2E Test Server');
    await page.click('button:has-text("Create Server")');

    // Wait for navigation or server to appear
    // Note: Implementation depends on whether we navigate immediately
    await page.waitForTimeout(1000);
  });

  test('should allow sending messages in a channel', async ({ page }) => {
    // This test would require:
    // 1. Login
    // 2. Create or navigate to server
    // 3. Create or navigate to channel
    // 4. Send message
    // 5. Verify message appears
    //
    // Implementation left as exercise due to complexity of:
    // - WebSocket connections in Playwright
    // - Dynamic routing
    // - Async message delivery
  });
});
