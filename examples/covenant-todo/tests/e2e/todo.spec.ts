import { test, expect } from '@playwright/test';

/**
 * E2E tests for the todo application
 *
 * These tests verify that the UI works correctly and that
 * automatic cache invalidation happens in the browser
 */

test.describe('Todo App', () => {
  test('login flow', async ({ page }) => {
    await page.goto('/login');

    // Fill in login form
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');

    // Click login button
    await page.click('button[type="submit"]');

    // Should redirect to main page
    await page.waitForURL('/');

    // Should see the todo list
    await expect(page.locator('h1')).toContainText('My Todos');
  });

  test('create todo', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Wait for initial load
    await expect(page.locator('h1')).toContainText('My Todos');

    // Create a new todo
    const todoTitle = `E2E Test Todo ${Date.now()}`;
    await page.fill('.todo-form input', todoTitle);
    await page.click('.todo-form button');

    // Wait a bit for the mutation to complete and refetch to happen
    await page.waitForTimeout(500);

    // Should see the new todo in the list
    await expect(page.locator('.todo-list')).toContainText(todoTitle);
  });

  test('toggle todo completed', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Create a new todo
    const todoTitle = `Toggle Test ${Date.now()}`;
    await page.fill('.todo-form input', todoTitle);
    await page.click('.todo-form button');
    await page.waitForTimeout(500);

    // Find the todo item
    const todoItem = page.locator('.todo-item', { hasText: todoTitle });
    await expect(todoItem).toBeVisible();

    // Should not have completed class initially
    await expect(todoItem).not.toHaveClass(/completed/);

    // Click the checkbox
    await todoItem.locator('.checkbox').check();
    await page.waitForTimeout(500);

    // Should now have completed class (automatic refetch!)
    await expect(todoItem).toHaveClass(/completed/);

    // Uncheck it
    await todoItem.locator('.checkbox').uncheck();
    await page.waitForTimeout(500);

    // Should no longer have completed class
    await expect(todoItem).not.toHaveClass(/completed/);
  });

  test('delete todo', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Create a new todo
    const todoTitle = `Delete Test ${Date.now()}`;
    await page.fill('.todo-form input', todoTitle);
    await page.click('.todo-form button');
    await page.waitForTimeout(500);

    // Find the todo item
    const todoItem = page.locator('.todo-item', { hasText: todoTitle });
    await expect(todoItem).toBeVisible();

    // Click delete button
    await todoItem.locator('.delete-button').click();
    await page.waitForTimeout(500);

    // Todo should be removed from the list (automatic refetch!)
    await expect(page.locator('.todo-item', { hasText: todoTitle })).not.toBeVisible();
  });

  test('filter todos', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Create two todos
    const activeTodo = `Active ${Date.now()}`;
    const completedTodo = `Completed ${Date.now()}`;

    await page.fill('.todo-form input', activeTodo);
    await page.click('.todo-form button');
    await page.waitForTimeout(500);

    await page.fill('.todo-form input', completedTodo);
    await page.click('.todo-form button');
    await page.waitForTimeout(500);

    // Complete one of them
    const completedItem = page.locator('.todo-item', { hasText: completedTodo });
    await completedItem.locator('.checkbox').check();
    await page.waitForTimeout(500);

    // Test "All" filter (default)
    await page.click('.filter-button', { hasText: 'All' });
    await expect(page.locator('.todo-item', { hasText: activeTodo })).toBeVisible();
    await expect(page.locator('.todo-item', { hasText: completedTodo })).toBeVisible();

    // Test "Active" filter
    await page.click('.filter-button', { hasText: 'Active' });
    await expect(page.locator('.todo-item', { hasText: activeTodo })).toBeVisible();
    await expect(page.locator('.todo-item', { hasText: completedTodo })).not.toBeVisible();

    // Test "Completed" filter
    await page.click('.filter-button', { hasText: 'Completed' });
    await expect(page.locator('.todo-item', { hasText: activeTodo })).not.toBeVisible();
    await expect(page.locator('.todo-item', { hasText: completedTodo })).toBeVisible();
  });

  test('logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Click logout button
    await page.click('button', { hasText: 'Logout' });

    // Should redirect to login page
    await page.waitForURL('/login');
    await expect(page.locator('h1')).toContainText('Login');
  });

  test('empty state', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // If there are any todos, delete them all
    const deleteButtons = await page.locator('.delete-button').all();
    for (const button of deleteButtons) {
      await button.click();
      await page.waitForTimeout(300);
    }

    // Should see empty state message
    await expect(page.locator('.empty-state')).toContainText('No todos yet');
  });

  test('unauthenticated redirect', async ({ page }) => {
    // Clear any existing auth
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Try to access main page without auth
    await page.goto('/');

    // Should redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('h1')).toContainText('Login');
  });
});
