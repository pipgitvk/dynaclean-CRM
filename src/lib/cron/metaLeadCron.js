const cron = require('node-cron');
const { syncAllActiveCredentials } = require('../services/metaLeadFetchService');

let cronJob = null;

/**
 * Start the automatic cron job for Meta lead sync
 * Runs every 1 minute
 */
function startMetaLeadCron() {
  if (cronJob) {
    console.log('⚠️ Meta lead cron job is already running');
    return;
  }
  
  console.log('🚀 Starting Meta lead cron job (every 1 minute)...');
  
  // Run every 1 minute
  cronJob = cron.schedule('* * * * *', async () => {
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
 * Get cron job status
 */
function getCronStatus() {
  return {
    isRunning: cronJob !== null,
    schedule: '*/10 * * * *' // Every 10 minutes
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
  getCronStatus,
  manualSync
};
