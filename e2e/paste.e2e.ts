import { test, expect, type Page } from '@playwright/test';
import { setupMockApi } from './helpers/mock-api';
import { S } from './helpers/selectors';

// --- helpers -----------------------------------------------------------------

/** Wait for the app to be in editing mode (textarea visible, #box hidden). */
async function waitForEditingMode(page: Page) {
  await expect(page.locator(S.textarea)).toBeVisible();
  await expect(page.locator(S.box)).toBeHidden();
}

/** Wait for the app to be in presenting mode (#box visible, textarea hidden). */
async function waitForPresentingMode(page: Page) {
  await expect(page.locator(S.box)).toBeVisible();
  await expect(page.locator(S.textarea)).toBeHidden();
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
    await expect(page.locator(S.textarea)).toHaveValue('');

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
    await page.locator(S.textarea).fill('hello world');
    await expectEnabled(page, S.saveBtn);

    // Clearing content disables save again
    await page.locator(S.textarea).fill('');
    await expectDisabled(page, S.saveBtn);
  });

  // -- 3. Saving a paste -----------------------------------------------------

  test('3 - saving a paste transitions to presenting mode', async ({ page }) => {
    const store = await setupMockApi(page);
    await page.goto('/');

    const content1 = 'function hello() {\n  return "world";\n}';
    await page.locator(S.textarea).fill(content1);
    await expectEnabled(page, S.saveBtn);

    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);

    await waitForPresentingMode(page);

    await expect(page.locator(S.boxCode)).toContainText('hello');
    await expect(page.locator(S.boxCode)).toContainText('world');

    await expectEnabled(page, S.duplicateBtn);
    await expectDisabled(page, S.saveBtn);

    await expect(page).toHaveTitle(/Haste - testkey0/);

    expect(store.get('testkey0')).toBe(content1);
  });

  // -- 4. Back navigation from presented paste --------------------------------

  test('4 - back from presenting returns to home in editing mode', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).fill('const x = 1;');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.goBack();
    await page.waitForURL('/');

    await waitForEditingMode(page);
    await expectDisabled(page, S.saveBtn);

    // --- Known bug C3 ---
    // Draft content is lost on back because newDocument() does not write
    // the current textarea value into the navigation history state before push.
    // After fix, this assertion should change to: toHaveValue('const x = 1;')
    await expect(page.locator(S.textarea)).toHaveValue('');
    // TODO (Bug C3): After fix, expect textarea to restore draft on back nav
  });

  // -- 5. Forward navigation restores presented paste ------------------------

  test('5 - forward after back restores presenting mode and content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const content1 = 'const greeting = "hello";';
    await page.locator(S.textarea).fill(content1);
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

    await expect(page.locator(S.boxCode)).toContainText('greeting');
    await expect(page.locator(S.boxCode)).toContainText('hello');

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

    await page.locator(S.textarea).fill('let x = 42;');
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
    await page.locator(S.textarea).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await page.waitForURL(/\/testkey0\/edit/);
    await waitForEditingMode(page);

    // Content loaded from history state (fast path)
    await expect(page.locator(S.textarea)).toHaveValue(original);

    await expectEnabled(page, S.saveBtn);
    await expectDisabled(page, S.duplicateBtn);
  });

  // -- 8. Save the fork ------------------------------------------------------

  test('8 - saving a fork creates a new URL with altered content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    const altered = 'const altered = "yes, very much so";';

    await page.locator(S.textarea).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await page.waitForURL(/\/testkey0\/edit/);
    await waitForEditingMode(page);

    await page.locator(S.textarea).fill(altered);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey1/);
    await waitForPresentingMode(page);

    expect(page.url()).toMatch(/testkey1/);
    expect(page.url()).not.toMatch(/testkey0/);

    await expect(page.locator(S.boxCode)).toContainText('altered');
  });

  // -- 9. Back from fork save ------------------------------------------------

  test('9 - back from fork save returns to edit URL with original content', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    const altered = 'const altered = "yes, very much so";';

    await page.locator(S.textarea).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await page.waitForURL(/\/testkey0\/edit/);
    await page.locator(S.textarea).fill(altered);

    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey1/);
    await waitForPresentingMode(page);

    await page.goBack();
    await page.waitForURL(/\/testkey0\/edit/);
    await waitForEditingMode(page);

    // --- Known limitation (Bug C3 variant) ---
    // The textarea shows `original`, not `altered`.
    // The history entry for /testkey0/edit was created by the duplicate push
    // with state = { content: original, key: testkey0 }. The user typed
    // `altered` in the DOM but that was never persisted back to history state.
    // After fixing Bug C3, this assertion should become: toHaveValue(altered)
    await expect(page.locator(S.textarea)).toHaveValue(original);
    // TODO (Bug C3 variant): After fix, expect textarea to contain altered content
  });

  // -- 10. Back to pre-fork state --------------------------------------------

  test('10 - second back from fork returns to pre-fork presented state', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    const original = 'const original = true;';
    const altered = 'const altered = "yes, very much so";';

    await page.locator(S.textarea).fill(original);
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.duplicateBtn).click();
    await page.waitForURL(/\/testkey0\/edit/);
    await page.locator(S.textarea).fill(altered);

    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey1/);
    await waitForPresentingMode(page);

    // Back once: editing mode at /testkey0/edit
    await page.goBack();
    await page.waitForURL(/\/testkey0\/edit/);
    await waitForEditingMode(page);

    // Back twice: presenting mode at /testkey0
    await page.goBack();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await expect(page.locator(S.boxCode)).toContainText('original');

    expect(page.url()).toMatch(/testkey0/);
    expect(page.url()).not.toMatch(/testkey1/);
  });

  // -- 11. New from presenting -----------------------------------------------

  test('11 - New button from presenting state returns to empty editor', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).fill('some content');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.locator(S.newBtn).click();
    await page.waitForURL('/');
    await waitForEditingMode(page);

    await expect(page.locator(S.textarea)).toHaveValue('');
    await expectDisabled(page, S.saveBtn);
    await expectDisabled(page, S.duplicateBtn);
    await expectEnabled(page, S.newBtn);
  });

  // -- 12. New from editing --------------------------------------------------

  test('12 - New button from editing state clears content and resets URL', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).fill('draft content not saved');
    await page.locator(S.newBtn).click();

    await page.waitForURL('/');
    await waitForEditingMode(page);
    await expect(page.locator(S.textarea)).toHaveValue('');
  });

  // -- 13. Keyboard shortcut: Ctrl+S saves -----------------------------------

  test('13 - Ctrl+S triggers save', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).fill('shortcut test');
    await page.locator(S.textarea).press('Control+s');

    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);
  });

  // -- 14. Keyboard shortcut: Ctrl+N for new ---------------------------------

  test('14 - Ctrl+N from presenting creates new document', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).fill('content');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.keyboard.press('Control+n');
    await page.waitForURL('/');
    await waitForEditingMode(page);
    await expect(page.locator(S.textarea)).toHaveValue('');
  });

  // -- 15. Keyboard shortcut: Ctrl+D for duplicate ---------------------------

  test('15 - Ctrl+D from presenting duplicates to editor', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).fill('to be forked');
    await page.locator(S.saveBtn).click();
    await page.waitForURL(/\/testkey0/);
    await waitForPresentingMode(page);

    await page.keyboard.press('Control+d');
    await page.waitForURL(/\/testkey0\/edit/);
    await waitForEditingMode(page);
    await expect(page.locator(S.textarea)).toHaveValue('to be forked');
  });

  // -- 16. Tab key inserts spaces in textarea --------------------------------

  test('16 - Tab key inserts two spaces in textarea', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');

    await page.locator(S.textarea).click();
    await page.locator(S.textarea).press('Tab');

    await expect(page.locator(S.textarea)).toHaveValue('  ');
    await expect(page.locator(S.textarea)).toBeFocused();
  });

  // -- 17. 404 / document not found ------------------------------------------

  test('17 - navigating to a missing document redirects to home', async ({ page }) => {
    await setupMockApi(page);
    // Mock store is empty: any GET /documents/* returns 404

    await page.goto('/nosuchdocument');

    // App catches the 404 and navigates to /
    await page.waitForURL('/');
    await waitForEditingMode(page);
    await expect(page.locator(S.textarea)).toHaveValue('');
  });

  // -- 18. Direct URL load of existing document ------------------------------

  test('18 - direct URL navigation loads correct content', async ({ page }) => {
    const store = await setupMockApi(page);
    store.set('directload', 'pre-populated content');

    await page.goto('/directload');

    await waitForPresentingMode(page);
    await expect(page.locator(S.boxCode)).toContainText('pre-populated');
  });
});
