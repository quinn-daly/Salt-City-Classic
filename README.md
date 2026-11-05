# Salt City Classic

Live schedule, scores and brackets for the Salt City Classic. Phones are the main audience; score reporters update a Google Sheet and the site picks up changes about once a minute.

## How it works

- `index.html`, `styles.css`, `app.js`: the site. No build step.
- The site reads three tabs from the Google Sheet **Salt City Classic Scores**: `Scores`, `Teams`, `Settings`.
- Standings, tiebreakers (wins, head to head, point differential), Sunday seeding, byes and bracket advancement are all calculated on the page from the scores.

## One time setup

1. **Share the sheet for reading.** Open the sheet, click **Share**, set General access to **Anyone with the link: Viewer**. The site can't read it otherwise.
2. **Add score reporters.** In the same Share dialog, add each reporter's email as **Editor**.
3. **Push this folder** to a new GitHub repo (for example `salt-city-classic`).
4. **Turn on Pages.** Repo **Settings > Pages > Deploy from a branch**, branch `main`, folder `/ (root)`.
5. Open `https://<your-username>.github.io/salt-city-classic/` and share that link with teams.

The sheet ID lives in `index.html` (`SCC_CONFIG.sheetId`). Change it there if you ever swap sheets.

## Reporting scores

On the **Scores** tab, find the row by Game ID, then type Score 1 (Team 1) and Score 2 (Team 2). Clear both cells to un-report a game. For Sunday games, Team 1 is the top team shown for that game on the site.

## TD settings

- **Teams** tab: seed order 1 to 10. Renaming a team here renames it everywhere.
- **Settings** tab: `sat_start`, `break_min`, `soft_cap`, `hard_cap`, `game_to`, `sun_start`. Round times are calculated as hard cap + 5 minutes per slot, plus the break.

Keep the tab names and column headers as they are; the site looks them up by name.
