import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for the hello world application
 *
 * These tests verify the complete user flow through a real browser.
 */

test('user can log in and see hello message', async ({ page }) => {
  // Navigate to home page
  await page.goto('/');

  // Should redirect to login page
  await expect(page).toHaveURL('/login');
  await expect(page.locator('h1')).toContainText('Login');

  // Fill in login form
  await page.fill('input[type="text"]', 'testuser');
  await page.fill('input[type="password"]', 'password123');

  // Submit form
  await page.click('button[type="submit"]');

  // Should redirect to home page
  await expect(page).toHaveURL('/');

  // Should see hello message
  await expect(page.locator('.greeting h2')).toContainText('Hello, testuser!');
  await expect(page.locator('.greeting p')).toContainText('Logged in as: testuser');
});

test('login fails with invalid credentials', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in wrong credentials
  await page.fill('input[type="text"]', 'testuser');
  await page.fill('input[type="password"]', 'wrongpassword');

  // Submit form
  await page.click('button[type="submit"]');

  // Should show error message
  await expect(page.locator('.error')).toContainText('Invalid username or password');

  // Should still be on login page
  await expect(page).toHaveURL('/login');
});

test('unauthenticated access redirects to login', async ({ page }) => {
  // Clear any existing auth
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  // Try to access home page
  await page.goto('/');

  // Should redirect to login
  await expect(page).toHaveURL('/login');
});

test('user can logout', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[type="text"]', 'testuser');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for redirect to home
  await expect(page).toHaveURL('/');

  // Click logout button
  await page.click('button.secondary');

  // Should redirect to login
  await expect(page).toHaveURL('/login');

  // Try to go back to home - should redirect to login
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('loading state displays correctly', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="text"]', 'testuser');
  await page.fill('input[type="password"]', 'password123');

  // Start login
  const loginPromise = page.click('button[type="submit"]');

  // Should show loading state
  await expect(page.locator('button[type="submit"]')).toContainText('Logging in...');

  await loginPromise;

  // After redirect, should briefly show loading
  // (This might be too fast to catch reliably, so we just verify it succeeds)
  await expect(page).toHaveURL('/');
});

test('test credentials are displayed', async ({ page }) => {
  await page.goto('/login');

  // Should show test credentials
  await expect(page.locator('text=Test credentials')).toBeVisible();
  await expect(page.locator('text=testuser')).toBeVisible();
  await expect(page.locator('text=password123')).toBeVisible();
});

test('about section is displayed on home page', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="text"]', 'testuser');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for home page
  await expect(page).toHaveURL('/');

  // Should show about section
  await expect(page.locator('text=About This Example')).toBeVisible();
  await expect(page.locator('text=Authentication with username/password')).toBeVisible();
});
