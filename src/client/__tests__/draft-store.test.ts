import { DraftStore } from '../draft-store';

describe('DraftStore', () => {
  let store: DraftStore;

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    store = new DraftStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists content after the debounce interval', () => {
    store.schedule('hello world');
    expect(store.load()).toBeNull();

    jest.advanceTimersByTime(500);
    expect(store.load()).toBe('hello world');
  });

  it('debounces rapid writes, keeping only the latest', () => {
    store.schedule('first');
    jest.advanceTimersByTime(100);
    store.schedule('second');
    jest.advanceTimersByTime(500);

    expect(store.load()).toBe('second');
  });

  it('removes the draft when content becomes empty', () => {
    store.schedule('something');
    jest.advanceTimersByTime(500);
    expect(store.load()).toBe('something');

    store.schedule('   ');
    jest.advanceTimersByTime(500);
    expect(store.load()).toBeNull();
  });

  it('clear() removes stored draft and cancels pending writes', () => {
    store.schedule('kept');
    jest.advanceTimersByTime(500);

    store.schedule('pending');
    store.clear();
    jest.advanceTimersByTime(500);

    expect(store.load()).toBeNull();
  });
});
