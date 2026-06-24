# Cron Setup Guide

---

## 1. Auto Salary Generation (har mahine ek baar)

### Cron URL
```
https://app.dynacleanindustries.com/api/cron/salary-generate
```
Agar `CRON_SECRET` set hai:
```
https://app.dynacleanindustries.com/api/cron/salary-generate?secret=YOUR_CRON_SECRET
```

### Schedule: Daily chalao (cron khud check karega ki aaj ka din match karta hai ya nahi)
```
0 8 * * * curl -s "https://app.dynacleanindustries.com/api/cron/salary-generate?secret=YOUR_SECRET"
```
Matlab: Roz suba 8 baje hit hoga, lekin sirf configured date par (Salary Management → Auto Payroll Settings) actually run karega.

---

## 2. Meta Leads Auto-Fetch – Cron Setup (har 10 min)

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

## 3. Delivery Email Cron – Automatic delivery reminders (daily)

Har roz expected delivery date ke din customers ko automatic email jayega (sirf COD orders par).

### Cron URL

```
https://app.dynacleanindustries.com/api/cron/delivery-email
```

Agar CRON_SECRET .env me set hai: `https://app.dynacleanindustries.com/api/cron/delivery-email?secret=YOUR_SECRET`

### Schedule: Daily (any time, e.g., 8am)

**Option 1: Vercel**
```
vercel.json me already configured hai
```

**Option 2: Hostinger VPS (crontab)**
```bash
crontab -e
```
Add:
```
0 8 * * * curl -s "https://app.dynacleanindustries.com/api/cron/delivery-email?secret=YOUR_CRON_SECRET"
```

**Option 3: Hostinger Shared (hPanel)**
- **Advanced** → **Cron Jobs**
- Schedule: `0 8 * * *` (daily 8am)
- Command: `curl -s "https://app.dynacleanindustries.com/api/cron/delivery-email?secret=YOUR_SECRET"`

**Option 4: cron-job.org**
1. https://cron-job.org → **Create Cronjob**
2. URL: `https://app.dynacleanindustries.com/api/cron/delivery-email`
3. Schedule: **Daily** (any time)
4. Add query param: `?secret=YOUR_CRON_SECRET` (if CRON_SECRET set)

### Kya Email Mein Jayega:
- Order ID
- Delivery Date (Today)
- Pending Amount (COD)
- "Ready for Delivery" checklist
- Contact information

### Notes:
- Email sirf COD orders (payment_term_days = 9) par jayegi
- Sirf un orders ke liye email jayega jinke `booking_id` set hai (booking already uploaded)
- Email address valid hona chahiye

---
