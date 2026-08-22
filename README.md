# NITI Aayog Readiness Tracker — Calendar Edition

This version puts a **large current-month calendar directly on the home dashboard**.

## Home dashboard
- Large month calendar with dates.
- Tasks listed inside each day cell.
- Today is highlighted.
- Click any task to update progress.
- Click any date cell to add a task.
- Drag a task from one day to another.
- Month navigation: previous / current / next.
- Next Action card stays above the calendar.
- Progress, remaining days, remaining work and deadline health stay visible.

## Smart rescheduling
If you miss several days:
- do **not** stack all missed work onto the next day;
- click **Smart rebalance**;
- the tracker redistributes unfinished work over the remaining calendar;
- your weekday/weekend study capacity is respected;
- the target date stays fixed at 31 Dec 2026;
- if the remaining work exceeds remaining capacity, the dashboard shows deadline risk.

Default study capacity:
- Sunday: 180 minutes
- Monday: 10 minutes
- Tuesday: 0
- Wednesday: 15 minutes
- Thursday: 15 minutes
- Friday: 10 minutes
- Saturday: 180 minutes

You can change these in Settings.

## ChatGPT support
Every task can generate a ChatGPT coaching prompt.
Interview Practice can generate a full NITI mock-interview prompt.
The app also stores your NotebookLM prompts.

## Deploy to Netlify
1. Unzip the package.
2. Drag the folder into Netlify manual deploy, or push it to GitHub and connect the repo to Netlify.
3. No build command is required.
4. Publish directory is the project root.

## Data
V2 requires a private Netlify Identity login and stores each authenticated user's tracker state in Netlify Blobs. localStorage is retained only as a cache and one-time migration fallback. Export JSON backups from Progress Log / Settings.

## Files
- index.html
- styles.css
- app.js
- data/roadmap.json
- netlify.toml
