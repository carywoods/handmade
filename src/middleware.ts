import { defineMiddleware } from 'astro:middleware';
import { startMaintenanceScheduler } from './lib/scheduler.js';

// Automatically activate autonomous background scheduler on server startup
if (typeof process !== 'undefined' && !process.env.DISABLE_SCHEDULER) {
  try {
    startMaintenanceScheduler();
  } catch (err) {
    console.error('[MIDDLEWARE] Failed to start maintenance scheduler:', err);
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  return next();
});
