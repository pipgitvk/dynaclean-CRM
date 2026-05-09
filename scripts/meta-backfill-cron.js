/**
 * Meta Backfill Cron Script
 * Runs meta-backfill API calls in background
 * Usage: node scripts/meta-backfill-cron.js
 * Can be scheduled via Windows Task Scheduler or cron
 */

const fs = require('fs');
const path = require('path');

// Read .env file directly
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      line = line.trim();
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;
      
      // Handle KEY=VALUE format
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  } catch (err) {
    console.warn('Could not load .env file:', err.message);
  }
}

loadEnv();

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

async function callMetaBackfill() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting meta-backfill...`);
  
  try {
    let url = `${API_BASE}/api/cron/meta-backfill`;
    if (CRON_SECRET) {
      url += `?secret=${encodeURIComponent(CRON_SECRET)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`[${timestamp}] ✓ Meta backfill success:`, data);
    } else {
      console.error(`[${timestamp}] ✗ Meta backfill failed:`, data);
    }
  } catch (error) {
    console.error(`[${timestamp}] ✗ Meta backfill error:`, error.message);
  }
}

async function callTamilBackfill() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting Tamil meta-backfill...`);
  
  try {
    let url = `${API_BASE}/api/cron/meta-backfill-tamil`;
    if (CRON_SECRET) {
      url += `?secret=${encodeURIComponent(CRON_SECRET)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`[${timestamp}] ✓ Tamil backfill success:`, data);
    } else {
      console.error(`[${timestamp}] ✗ Tamil backfill failed:`, data);
    }
  } catch (error) {
    console.error(`[${timestamp}] ✗ Tamil backfill error:`, error.message);
  }
}

// Run both backfills
async function main() {
  await callMetaBackfill();
  await callTamilBackfill();
  console.log(`[${new Date().toISOString()}] Cron run completed\n`);
}

// Run immediately if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
