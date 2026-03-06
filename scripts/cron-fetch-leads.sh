#!/bin/bash
# Auto-fetch Meta leads every 10 min (run via Hostinger Cron)
# Replace with your production URL
URL="${CRON_BASE_URL:-https://app.dynacleanindustries.com}/api/meta-backfill?mode=all&autoImport=1"
curl -s -o /dev/null -w "%{http_code}" "$URL"
