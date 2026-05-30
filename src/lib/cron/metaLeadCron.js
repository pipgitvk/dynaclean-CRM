const cron = require('node-cron');
const { syncAllActiveCredentials } = require('../services/metaLeadFetchService');
const { getSetting, setSetting } = require('../mysql/settingsModel');

let cronJob = null;
let currentInterval = 1; // Default 1 minute

/**
 * Load cron interval from database
 */
async function loadCronInterval() {
  try {
    const savedInterval = await getSetting('meta_cron_interval');
    if (savedInterval) {
      currentInterval = parseInt(savedInterval);
      console.log(`📊 Loaded cron interval from database: ${currentInterval} minute(s)`);
    }
  } catch (error) {
    console.error('Failed to load cron interval from database:', error);
  }
}

/**
 * Convert minutes to cron expression
 * For example: 1 minute runs every minute, 2 minutes runs every 2 minutes
 */
function minutesToCron(minutes) {
  if (minutes === 1) return '* * * * *';
  return `*/${minutes} * * * *`;
}

/**
 * Start the automatic cron job for Meta lead sync
 * @param {number} interval - Interval in minutes (default: 1)
 */
async function startMetaLeadCron(interval = 1) {
  if (cronJob) {
    console.log('⚠️ Meta lead cron job is already running');
    return;
  }

  // Load interval from database if not provided
  if (interval === 1) {
    await loadCronInterval();
  } else {
    currentInterval = interval;
    // Save to database
    try {
      await setSetting('meta_cron_interval', interval.toString());
      console.log(`💾 Saved cron interval to database: ${interval} minute(s)`);
    } catch (error) {
      console.error('Failed to save cron interval to database:', error);
    }
  }

  const cronExpression = minutesToCron(currentInterval);

  console.log(`🚀 Starting Meta lead cron job (every ${currentInterval} minute(s))...`);

  // Run with custom interval
  cronJob = cron.schedule(cronExpression, async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🔄 Running Meta lead sync cron...`);
    
    try {
      // Calculate date range: last 7 days
      const until = new Date();
      const since = new Date(until);
      since.setDate(since.getDate() - 7);
      
      const sinceStr = since.toISOString().split('T')[0];
      const untilStr = until.toISOString().split('T')[0];
      
      console.log(`📅 Syncing leads from ${sinceStr} to ${untilStr}`);
      
      const results = await syncAllActiveCredentials({
        since: sinceStr,
        until: untilStr,
        autoImport: true
      });
      
      const totalFetched = results.reduce((sum, r) => sum + r.leadsFetched, 0);
      const totalImported = results.reduce((sum, r) => sum + r.leadsImported, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.leadsSkipped, 0);
      
      console.log(`✅ Cron sync completed: Fetched ${totalFetched}, Imported ${totalImported}, Skipped ${totalSkipped}`);
    } catch (error) {
      console.error('❌ Error in Meta lead cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  console.log('✅ Meta lead cron job started');
}

/**
 * Stop the automatic cron job
 */
function stopMetaLeadCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 Meta lead cron job stopped');
  } else {
    console.log('⚠️ Meta lead cron job is not running');
  }
}

/**
 * Restart the cron job with a new interval
 * @param {number} interval - New interval in minutes
 */
async function restartMetaLeadCron(interval = 1) {
  stopMetaLeadCron();
  await startMetaLeadCron(interval);
  console.log(`🔄 Cron job restarted with ${interval} minute interval`);
}

/**
 * Get cron job status
 */
function getCronStatus() {
  return {
    isRunning: cronJob !== null,
    interval: currentInterval,
    schedule: minutesToCron(currentInterval)
  };
}

/**
 * Manually trigger a sync (for testing)
 */
async function manualSync(options = {}) {
  console.log('🔄 Running manual sync...');
  
  const since = options.since || (() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  })();
  
  const until = options.until || new Date().toISOString().split('T')[0];
  
  const results = await syncAllActiveCredentials({
    since,
    until,
    autoImport: options.autoImport !== false
  });
  
  return results;
}

module.exports = {
  startMetaLeadCron,
  stopMetaLeadCron,
  restartMetaLeadCron,
  getCronStatus,
  manualSync
};
