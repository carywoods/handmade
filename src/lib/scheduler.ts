import { checkAndRunScheduledMaintenance } from './maintenance.js';

let schedulerStarted = false;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the autonomous maintenance background scheduler.
 * Runs hourly checks and startup maintenance evaluation.
 */
export function startMaintenanceScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log('[SCHEDULER] Autonomous maintenance scheduler started (Checking hourly).');

  // Staggered startup check (15 seconds after container / server launch)
  setTimeout(async () => {
    try {
      console.log('[SCHEDULER] Executing startup maintenance evaluation...');
      await checkAndRunScheduledMaintenance();
    } catch (err) {
      console.error('[SCHEDULER] Startup maintenance evaluation error:', err);
    }
  }, 15000);

  // Hourly recurring check
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndRunScheduledMaintenance();
    } catch (err) {
      console.error('[SCHEDULER] Periodic hourly maintenance check error:', err);
    }
  }, 60 * 60 * 1000);

  if (typeof process !== 'undefined') {
    process.on('SIGTERM', stopMaintenanceScheduler);
    process.on('SIGINT', stopMaintenanceScheduler);
  }
}

/**
 * Stops the autonomous scheduler
 */
export function stopMaintenanceScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  schedulerStarted = false;
  console.log('[SCHEDULER] Autonomous maintenance scheduler stopped.');
}
