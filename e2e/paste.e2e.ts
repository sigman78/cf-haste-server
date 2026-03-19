import { test, expect, type Page } from '@playwright/test';
import { setupMockApi } from './helpers/mock-api';
import { S } from './helpers/selectors';

// --- helpers -----------------------------------------------------------------

/** Wait for the app to be in editing mode (#editor without hljs class). */
async function waitForEditingMode(page: Page) {
  await expect(page.locator(S.editor)).not.toHaveClass(/hljs/);
}

/** Wait for the app to be in presenting mode (#editor with hljs class). */
async function waitForPresentingMode(page: Page) {
  await expect(page.locator(S.editor)).toHaveClass(/hljs/);
}

/** Check that a button element has the `enabled` CSS class. */
async function expectEnabled(page: Page, selector: string) {
  await expect(page.locator(selector)).toHaveClass(/enabled/);
}

/** Check that a button element does NOT have the `enabled` CSS class. */
async function expectDisabled(page: Page, selector: string) {
  await expect(page.locator(selector)).not.toHaveClass(/enabled/);
}

// --- Suite -------------------------------------------------------------------

test.describe('Paste lifecycle', () => {
  // -- 1. Initial page state --------------------------------------------------

  test('1 - initial page load shows empty editor', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await waitForEditingMode(page);
    await expect(page.locator(S.editor)).toHaveText('');

    await expectEnabled(page, S.newBtn);
    await expectDisabled(page, S.saveBtn);
    await expectDisabled(page, S.duplicateBtn);

    await expect(page).toHaveTitle('Haste');
  });

  // -- 2. Typing enables the Save button -------------------------------------

  test('2 - typing content enables the Save button', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await expectDisabled(page, S.saveBtn);
    await page.locator(S.editor).fill('hello world');
    await expectEnabled(page, S.saveBtn);

    // Clearing content disables save again
    await page.locator(S.editor).fill('');
    await expectDisabled(page, S.saveBtn);
  });

  // -- 3. Saving a paste -----------------------------------------------------

  test('3 - saving a paste transitions to presenting mode', async ({ page }) => {
    const store = await setupMockApi(page);
    await page.goto('/');

    const content1 = 'function hello() {\n  return "world";\n}';
    await page.locator(S.editor).fill(content1);
    await expectEnabled(page, S.saveBtn);

    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);

    await waitForPresentingMode(page);

    await expect(page.locator(S.editor)).toContainText('hello');
    await expect(page.locator(S.editor)).toContainText('world');

    await expectEnabled(page, S.duplicateBtn);
    await expectDisabled(page, S.saveBtn);

    await expect(page).toHaveTitle(/Haste - testkey0/);

    expect(store.get('testkey0')).toBe(content1);
  });

  // -- 4. Back navigation from presented paste --------------------------------

  test('4 - back from presenting returns to home in editing mode', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('const x = 1;');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.goBack();
    await page.waitForURL('/');

    await waitForEditingMode(page);
    await expectEnabled(page, S.saveBtn);

    await expect(page.locator(S.editor)).toHaveText('const x = 1;');
  });

  // -- 5. Forward navigation restores presented paste ------------------------

  test('5 - forward after back restores presenting mode and content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const content1 = 'const greeting = "hello";';
    await page.locator(S.editor).fill(content1);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    const docUrl = page.url();
    await waitForPresentingMode(page);

    await page.goBack();
    await page.waitForURL('/');
    await waitForEditingMode(page);

    await page.goForward();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await expect(page.locator(S.editor)).toContainText('greeting');
    await expect(page.locator(S.editor)).toContainText('hello');

    expect(page.url()).toBe(docUrl);

    // --- Known bug C2 / Q4 ---
    // After goForward(), the app fires a GET /documents/testkey0 even though
    // the content could be restored from history state. The mock intercept
    // handles it, so the test passes, but a network round-trip occurs where
    // none should be needed.
  });

  // -- 6. Full back/forward cycle --------------------------------------------

  test('6 - full back/forward cycle preserves URL and content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('let x = 42;');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    const presentUrl = page.url();
    await waitForPresentingMode(page);

    await page.goBack();
    await expect(page).toHaveURL('/');

    await page.goForward();
    await expect(page).toHaveURL(presentUrl);
    await waitForPresentingMode(page);

    expect(page.url()).toBe(presentUrl);
  });

  // -- 7. Duplicate (fork) flow ----------------------------------------------

  test('7 - duplicate transitions to editing with original content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    await page.locator(S.editor).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await waitForEditingMode(page);
    await expect(page).toHaveURL(/\/testkey0/); // no /edit suffix

    await expect(page.locator(S.editor)).toHaveText(original);

    await expectEnabled(page, S.saveBtn);
    await expectDisabled(page, S.duplicateBtn);
  });

  // -- 8. Save the fork ------------------------------------------------------

  test('8 - saving a fork creates a new URL with altered content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    const altered = 'const altered = "yes, very much so";';

    await page.locator(S.editor).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await waitForEditingMode(page);
    await expect(page).toHaveURL(/\/testkey0/);

    await page.locator(S.editor).fill(altered);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey1/);
    await waitForPresentingMode(page);

    expect(page.url()).toMatch(/testkey1/);
    expect(page.url()).not.toMatch(/testkey0/);

    await expect(page.locator(S.editor)).toContainText('altered');
  });

  // -- 9. Back from fork save ------------------------------------------------

  test('9 - back from fork save returns to presenting view of source doc', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    const altered = 'const altered = "yes, very much so";';

    await page.locator(S.editor).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await waitForEditingMode(page);
    await page.locator(S.editor).fill(altered);

    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey1/);
    await waitForPresentingMode(page);

    await page.goBack();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await expect(page.locator(S.editor)).toContainText('original');
  });

  // -- 10. Back to pre-fork state --------------------------------------------

  test('10 - back from fork returns to presenting source doc, second back to home', async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    const altered = 'const altered = "yes, very much so";';

    await page.locator(S.editor).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await waitForEditingMode(page);
    await page.locator(S.editor).fill(altered);

    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey1/);
    await waitForPresentingMode(page);

    // Back once: presenting mode at /testkey0 (source doc)
    await page.goBack();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);
    await expect(page.locator(S.editor)).toContainText('original');

    // Back twice: new editor at /
    await page.goBack();
    await page.waitForURL('/');
    await waitForEditingMode(page);
  });

  // -- 11. New from presenting -----------------------------------------------

  test('11 - New button from presenting state returns to empty editor', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('some content');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.newBtn).click();
    await page.waitForURL('/');
    await waitForEditingMode(page);

    await expect(page.locator(S.editor)).toHaveText('');
    await expectDisabled(page, S.saveBtn);
    await expectDisabled(page, S.duplicateBtn);
    await expectEnabled(page, S.newBtn);
  });

  // -- 12. New from editing --------------------------------------------------

  test('12 - New button from editing state clears content and resets URL', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('draft content not saved');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(S.newBtn).click();

    await page.waitForURL('/');
    await waitForEditingMode(page);
    await expect(page.locator(S.editor)).toHaveText('');
  });

  // -- 13. Keyboard shortcut: Ctrl+S saves -----------------------------------

  test('13 - Ctrl+S triggers save', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('shortcut test');
    await page.locator(S.editor).press('Control+s');

    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);
  });

  // -- 14. Keyboard shortcut: Ctrl+N for new ---------------------------------

  test('14 - Ctrl+N from presenting creates new document', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('content');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.keyboard.press('Control+n');
    await page.waitForURL('/');
    await waitForEditingMode(page);
    await expect(page.locator(S.editor)).toHaveText('');
  });

  // -- 15. Keyboard shortcut: Ctrl+D for duplicate ---------------------------

  test('15 - Ctrl+D from presenting duplicates to editor', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('to be forked');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.keyboard.press('Control+d');
    await waitForEditingMode(page);
    await expect(page).toHaveURL(/\/testkey0/); // no /edit suffix
    await expect(page.locator(S.editor)).toHaveText('to be forked');
  });

  // -- 16. Tab key inserts spaces in textarea --------------------------------

  test('16 - Tab key inserts two spaces in textarea', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).click();
    await page.locator(S.editor).press('Tab');

    await expect(page.locator(S.editor)).toHaveText('  ');
    await expect(page.locator(S.editor)).toBeFocused();
  });

  // -- 17. 404 / document not found ------------------------------------------

  test('17 - navigating to a missing document redirects to home', async ({ page }) => {
    await setupMockApi(page);
    // Mock store is empty: any GET /documents/* returns 404

    await page.goto('/nosuchdocument');

    // App catches the 404 and navigates to /
    await page.waitForURL('/');
    await waitForEditingMode(page);
    await expect(page.locator(S.editor)).toHaveText('');
  });

  // -- 18. Direct URL load of existing document ------------------------------

  test('18 - direct URL navigation loads correct content', async ({ page }) => {
    const store = await setupMockApi(page);
    store.set('directload', 'pre-populated content');

    await page.goto('/directload');

    await waitForPresentingMode(page);
    await expect(page.locator(S.editor)).toContainText('pre-populated');
  });

  // -- 19. Save failure shows toast ------------------------------------------

  test('19 - save failure shows error toast and stays in editing mode', async ({ page }) => {
    const store = await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.editor).fill('some content');
    store.failNextSave();
    await page.locator(S.saveBtn).click();

    await expect(page).toHaveURL('/');
    await waitForEditingMode(page);

    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('Failed to save');
  });

  // -- 20. Load failure shows toast and redirects to home --------------------

  test('20 - load failure shows error toast and redirects to home', async ({ page }) => {
    const store = await setupMockApi(page);
    store.failNextLoad();

    await page.goto('/somedocument');

    await page.waitForURL('/');
    await waitForEditingMode(page);

    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('Document not found');
  });

  // -- 21. Back after missing-doc redirect returns to previous paste ----------

  test('21 - back after missing-doc redirect returns to saved paste', async ({ page }) => {
    const store = await setupMockApi(page);
    store.set('gooddoc', 'hello world');

    // Start at a valid document
    await page.goto('/gooddoc');
    await waitForPresentingMode(page);

    // Navigate to a non-existent document (simulates user typing a bad URL)
    await page.goto('/notexist');
    await page.waitForURL('/');
    await waitForEditingMode(page);

    // Toast shown
    await expect(page.locator('#toast')).toBeVisible();

    // Back should return to the good doc, not loop
    await page.goBack();
    await page.waitForURL(/\/gooddoc/);
    await waitForPresentingMode(page);
    await expect(page.locator(S.editor)).toContainText('hello world');
  });
});
