# PRD — Athlete Wellness & Load Check-In

## Original Problem Statement
"Build me a web app and connect it with my gmail - disharthjain98@gmail.com". User uploaded a Google Apps Script (Code.gs) for an "Athlete Wellness & Load Check-In" system backed by a Google Sheet. Rebuild as a full-stack web app; connect Gmail = email alerts + daily reports to disharthjain98@gmail.com.

## Architecture
- Frontend: React (CRA/craco), Tailwind + shadcn/ui, framer-motion, sonner, react-router. JWT bearer token in localStorage.
- Backend: FastAPI + Motor (MongoDB). JWT auth (bcrypt), Resend email, openpyxl Excel export.
- Collections: users, roster, checkins, sessions.

## User Personas
- Athlete (public, mobile): submits a daily readiness check-in in <60s.
- Coach (private, disharthjain98@gmail.com): views squad status, manages roster, exports/emails reports.

## Core Requirements (static)
- Public athlete check-in: sleep/hydration/motivation (1-5), illness details, soreness (areas + severity), optional RPE session with auto training load (RPE x duration).
- Password-protected coach dashboard with traffic-light squad status table, summary counters, filters, search.
- Roster management (add/remove athletes).
- Email wellness alerts (illness / high soreness) + on-demand daily report with Excel attachment to coach Gmail via Resend.
- Excel export/download.

## Implemented (2026-09-18)
- JWT coach auth (login/me), coach seeded from env; 35 default athletes seeded.
- POST /api/checkin logs daily + optional session, triggers Resend alert email on illness / soreness>=4.
- GET /api/dashboard aggregation (latest per athlete, today's load sum, summary).
- Roster CRUD, GET /api/checkins, GET /api/export/excel (xlsx), POST /api/reports/send-now (email + xlsx attachment).
- Full frontend: CheckIn page, CoachLogin, CoachDashboard with colored cells, roster chips, export/email buttons, theme toggle.
- Colored Excel: export now leads with a traffic-light color-coded "Dashboard" sheet (green/amber/red/grey).
- Load Trends: GET /api/trends?name= + AthleteTrendsDialog (recharts) — 7-day load area chart + readiness line chart, click athlete name to open.
- Auto Daily Email: GET/POST /api/settings/daily-email + APScheduler hourly cron (gated by enabled flag, hour, last_sent) sends the Excel report ~8 PM; dashboard toggle card.
- Coach password updated to `PunjabFC10@` (env ADMIN_PASSWORD, re-seeded on startup).
- Load Spikes (ACWR): compute_acwr_map() (7d acute / 28d chronic avg daily load); dashboard exposes acwr + acwrRisk per athlete + summary.loadSpikes. UI: ACWR column with colored badge, Load Spikes summary card, "Load Spike" filter tab. >1.5=red, 1.3-1.5 or <0.8=amber, 0.8-1.3=green.
- Weekly Digest: compute_weekly_summary() + send_weekly_digest_email() (HTML table + Excel attachment); GET/POST /api/settings/weekly-digest, POST /api/reports/weekly-now; scheduled_weekly_digest() runs Monday morning. UI: Weekly Digest card with toggle + "Send now" button.
- Verified: iteration_1 16/16 + iteration_2 22/22 + iteration_3 28/28 backend pytest, 100% frontend E2E.

## Backlog / Remaining
- P1: Athlete history/trends charts (7-day load, ACWR ratio).
- P1: Scheduled automatic daily report email (cron/scheduler).
- P2: Verify a custom sender domain in Resend to email addresses beyond the account owner.
- P2: Per-cell colored Excel formatting to mirror the dashboard traffic lights.
- P2: Brute-force lockout on login.

## Next Tasks
- Add trends view; add scheduled daily email; optional multi-team support.
