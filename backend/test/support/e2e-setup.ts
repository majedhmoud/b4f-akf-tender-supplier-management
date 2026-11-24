import { randomUUID } from 'node:crypto';

// Runs before each e2e file. Every file gets its own BullMQ prefix, so one
// file's worker (with its own SMTP settings) never takes another file's
// email jobs. The recovery timer is off; tests call EmailRecovery.sweep().
process.env.QUEUE_PREFIX = `test-${randomUUID().slice(0, 8)}`;
process.env.EMAIL_RECOVERY_INTERVAL_MS = '0';
process.env.LIFECYCLE_INTERVAL_MS = '0';
