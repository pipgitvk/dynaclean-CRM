# Meta Leads Auto-Fetch – Cron Setup (har 10 min)

Har 10 minute par Meta se leads **background mein** automatically fetch aur DB me save honge (page open na ho to bhi).

## Cron URL (use this)

```
https://app.dynacleanindustries.com/api/cron/meta-backfill
```

Agar CRON_SECRET .env me set hai to: `https://app.dynacleanindustries.com/api/cron/meta-backfill?secret=YOUR_SECRET`

---

## Option 1: Vercel (automatic – agar Vercel pe deploy hai)

`vercel.json` already configured hai. Sirf deploy karo:

```bash
vercel deploy --prod
```

Vercel Cron har 10 min par automatically `/api/cron/meta-backfill` call karega. `CRON_SECRET` env variable Vercel dashboard me set karo (optional, security ke liye).

---

## Option 2: Hostinger VPS (crontab)

### 1. SSH se VPS connect karo

```bash
ssh root@your-vps-ip
# ya
ssh username@your-vps-ip
```

### 2. Crontab edit karo

```bash
crontab -e
```

### 3. Ye line add karo (har 10 min)

```
*/10 * * * * curl -s "https://app.dynacleanindustries.com/api/cron/meta-backfill"
```

Agar `CRON_SECRET` set hai:

```
*/10 * * * * curl -s "https://app.dynacleanindustries.com/api/cron/meta-backfill?secret=YOUR_CRON_SECRET"
```

### 4. Save & exit

- nano: `Ctrl+O`, Enter, `Ctrl+X`
- vim: `Esc`, `:wq`, Enter

### 5. Verify

```bash
crontab -l
```

---

## Option 3: Hostinger Shared (hPanel Cron)

- Login → **Websites** → site select → **Advanced** → **Cron Jobs**
- Schedule: `*/10 * * * *`
- Command: `curl -s "https://app.dynacleanindustries.com/api/cron/meta-backfill"`

---

## Option 4: cron-job.org (free, kisi bhi hosting ke saath)

1. https://cron-job.org par sign up (free)
2. **Create Cronjob** → URL: `https://app.dynacleanindustries.com/api/cron/meta-backfill`
3. Schedule: **Every 10 minutes**
4. Save

---

## Option 5: Direct meta-backfill URL (purana)

```
curl -s "https://app.dynacleanindustries.com/api/meta-backfill?mode=all&autoImport=1"
```

---

## Verify

1. **Test Cron Now** button — meta-backfill page par "Automatic Cron" section me click karo
2. Hostinger / cron-job.org par **Last run** check karo
3. Agar fail ho to Error logs / response check karo
