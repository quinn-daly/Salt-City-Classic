# Salt City Classic

Live site for the Salt City Classic: saltcityclassic.com

## Pages

- `index.html`: Overview. Find your team, latest announcement, venue and maps, teams, rules and tiebreakers, safety, contacts, on site info.
- `saturday.html`: pool play schedule, live standings, format, tiebreakers.
- `sunday.html`: championship bracket, 5th place bracket, 7inals and 9th place.
- `announcements.html`: TD announcements with comments and replies (the "News" tab).
- `info.html`: redirects to the Overview.

`app.js` builds every page; `styles.css` styles them. No build step.

## Data: the Salt City Classic Scores Google Sheet

The sheet ID and comment URL live in `SCC_CONFIG` at the top of each HTML page.

| Tab | What it does |
|---|---|
| Scores | Reporters type Score 1 and Score 2. The site updates within about a minute. |
| Teams | Seeds 1 to 10, display name, team name, school. |
| Settings | Start times, break, soft and hard caps, game to. |
| Announcements | Tick Show to post. Give each post the next Post ID. |
| Comments | Filled in by the site. Tick Hide to take a comment down. |
| Info | Optional extra venue details shown on the Overview. |

The sheet must be shared as "Anyone with the link: Viewer".

## Comments

`sheet-script/Code.gs` is the Apps Script deployed from the sheet (Extensions > Apps Script, deployed as a web app: execute as me, access anyone). If you redeploy it as a new deployment, update `commentsUrl` in the HTML pages.
