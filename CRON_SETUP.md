# Meta Leads Auto-Fetch – Cron Setup (har 10 min)

Har 10 minute par Meta se leads automatically fetch aur DB me save honge.

## Cron URL (use this)

```
https://app.dynacleanindustries.com/api/cron/meta-backfill
```

Agar CRON_SECRET .env me set hai to: `https://app.dynacleanindustries.com/api/cron/meta-backfill?secret=YOUR_SECRET`

---

## Option 1: Hostinger Cron

### 1. Hostinger hPanel kholo

- Login → **Websites** → apna site select karo
- Left sidebar → **Advanced** → **Cron Jobs**

### 2. New Cron Job add karo

| Field | Value |
|-------|-------|
| **Schedule** | Every 10 minutes |
| **Cron expression** | `*/10 * * * *` |
| **Command** | `curl -s "https://app.dynacleanindustries.com/api/cron/meta-backfill"` |

### 3. Save karo

---

## Option 2: cron-job.org (free, agar Hostinger cron nahi chal raha)

1. https://cron-job.org par sign up (free)
2. **Create Cronjob** → URL: `https://app.dynacleanindustries.com/api/cron/meta-backfill`
3. Schedule: **Every 10 minutes**
4. Save

---

## Option 3: Direct meta-backfill URL (purana)

```
curl -s "https://app.dynacleanindustries.com/api/meta-backfill?mode=all&autoImport=1"
```

---

## Verify

1. **Test Cron Now** button — meta-backfill page par "Automatic Cron" section me click karo
2. Hostinger / cron-job.org par **Last run** check karo
3. Agar fail ho to Error logs / response check karo
