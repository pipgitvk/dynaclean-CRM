/**
 * Initialize Meta Lead Cron Service
 * This file should be imported in your application startup (e.g., layout.js or server entry point)
 * to automatically start the cron job when the server starts.
 */

import { startMetaLeadCron } from './cron/metaLeadCron';

// Only start cron on server side, not in browser
if (typeof window === 'undefined') {
  try {
    console.log('🚀 Initializing Meta Lead Cron Service (MySQL)...');
    startMetaLeadCron();
  } catch (error) {
    console.error('❌ Failed to initialize Meta Lead Cron Service:', error);
  }
}

export { startMetaLeadCron };
