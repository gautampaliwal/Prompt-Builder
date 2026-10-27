// VIOLATION ui-does-not-touch-storage: UI imports storage directly.
import { db } from '../storage/db';
export const page = db;
