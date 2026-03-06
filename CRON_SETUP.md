# Meta Leads Auto-Fetch – Hostinger Cron (10 min)

Har 10 minute par Meta se leads automatically fetch aur DB me save honge.

## Setup Steps

### 1. Hostinger hPanel kholo

- Login → **Websites** → apna site select karo
- Left sidebar → **Advanced** → **Cron Jobs**

### 2. New Cron Job add karo

| Field | Value |
|-------|-------|
| **Schedule** | Every 10 minutes |
| **Cron expression** | `*/10 * * * *` |
| **Command** | See below |

### 3. Command (choose one)

**Option A – Direct curl (recommended):**
```
curl -s "https://app.dynacleanindustries.com/api/meta-backfill?mode=all&autoImport=1"
```

**Option B – Agar URL alag hai:**
```
curl -s "https://YOUR-DOMAIN.com/api/meta-backfill?mode=all&autoImport=1"
```

### 4. Save karo

Cron ab har 10 minute par run hoga aur naye Meta leads DB me auto-import honge.

---

## Verify

- Hostinger Cron Jobs page par **Last run** / **Next run** check karo
- Meta backfill page par leads count badhna chahiye
- Agar kuch nahi dikhe to Hostinger **Error logs** check karo
