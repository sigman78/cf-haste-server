import type { Page } from '@playwright/test';

export interface MockStore {
  get(key: string): string | undefined;
  set(key: string, content: string): void;
  lastKey(): string | undefined;
  failNextSave(): void;
  failNextLoad(): void;
}

/**
 * Creates an in-memory store and wires up page.route() interceptors
 * for POST /documents and GET /documents/:key.
 *
 * Call this before page.goto(). The returned store can be used in
 * assertions to verify what was saved.
 *
 * Key generation: sequential testkey0, testkey1, ... for predictability.
 */
export async function setupMockApi(page: Page): Promise<MockStore> {
  // Make view transitions synchronous so the callback runs immediately rather
  // than being scheduled before the next frame. Without this, Playwright can
  // send fill()/click() commands before the transition callback fires, which
  // clears the editor and disables the save button.
  await page.addInitScript(() => {
    if ('startViewTransition' in document) {
      document.startViewTransition = (callback?: () => void | Promise<void>) => {
        if (callback) callback();
        const p = Promise.resolve() as Promise<undefined>;
        return {
          ready: p,
          finished: p,
          updateCallbackDone: p,
          skipTransition: () => {},
        } as ViewTransition;
      };
    }
  });

  const docs = new Map<string, string>();
  let counter = 0;
  let lastSavedKey: string | undefined;
  let saveShouldFail = false;
  let loadShouldFail = false;

  const store: MockStore = {
    get: (key) => docs.get(key),
    set: (key, content) => docs.set(key, content),
    lastKey: () => lastSavedKey,
    failNextSave: () => {
      saveShouldFail = true;
    },
    failNextLoad: () => {
      loadShouldFail = true;
    },
  };

  // POST /documents -- create new paste
  await page.route('**/documents', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (saveShouldFail) {
      saveShouldFail = false;
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
      return;
    }
    const content = route.request().postData() ?? '';
    const key = `testkey${counter++}`;
    docs.set(key, content);
    lastSavedKey = key;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ key }),
    });
  });

  // GET /documents/:id -- retrieve paste
  await page.route('**/documents/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    if (loadShouldFail) {
      loadShouldFail = false;
      await route.fulfill({ status: 500, body: 'Server Error' });
      return;
    }
    const url = new URL(route.request().url());
    const key = url.pathname.split('/').pop() ?? '';
    const content = docs.get(key);
    if (content !== undefined) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content, key }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Document not found' }),
      });
    }
  });

  return store;
}
