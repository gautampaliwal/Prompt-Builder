import '@testing-library/jest-dom/vitest';
// Component tests use the real services and Dexie on an in-memory IndexedDB.
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
