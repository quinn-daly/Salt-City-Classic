(function () {
  const CFG = window.SCC_CONFIG || {};
  const PAGE = document.body.dataset.page || "overview";
  const REFRESH_MS = 60000;
  const DEFAULTS = {
    teams: ["Cornell", "Syracuse", "Bing", "Dihll", "RIT", "Yale", "Tula", "Buffalo", "UofR", "Boomers"],
    sat: { start: 540, brk: 15, soft: 80, hard: 90, gameTo: 15 },
    sun: { start: 540 },
    scores: {},
    posts: [],
    comments: [],
    info: [],
    teamInfo: [["Buds", "Cornell University"], ["Doom", "Syracuse University"], ["Big Bear", "Binghamton University"], ["Dihll", "University of Vermont B"], ["Spudheds", "RIT"], ["Superfly", "Yale University"], ["TULA Open", "University of Toronto"], ["GEH", "University at Buffalo"], ["", "University of Rochester"], ["Boomers", "Doom Alumni"]]
  };
  let S = loadCache() || DEFAULTS;
  let status = { kind: CFG.sheetId ? "wait" : "off", text: CFG.sheetId ? "Loading scores…" : (CFG.offText || "Score sheet not connected yet") };

  const POOLS = { A: [1, 4, 5, 8, 9], B: [2, 3, 6, 7, 10] };
  const SAT = [
    [["A1", "A2", "A"], ["A3", "B3", "X"], ["B1", "B2", "B"], ["B4", "B5", "B"]],
    [["A1", "A4", "A"], ["A2", "A5", "A"], ["B1", "B4", "B"], ["B3", "B5", "B"]],
    [["A2", "A4", "A"], ["A3", "A5", "A"], ["B1", "B3", "B"], ["B2", "B4", "B"]],
    [["A1", "A3", "A"], ["A4", "A5", "A"], ["B2", "B5", "B"], null]
  ];
  const SUN = [
    { id: "SUN-QF1", r: 0, f: 1, lab: "Quarterfinal 1", a: { seed: "A1" }, b: { seed: "B4" } },
    { id: "SUN-QF2", r: 0, f: 2, lab: "Quarterfinal 2", a: { seed: "B2" }, b: { seed: "A3" } },
    { id: "SUN-QF3", r: 0, f: 3, lab: "Quarterfinal 3", a: { seed: "B1" }, b: { seed: "A4" } },
    { id: "SUN-QF4", r: 0, f: 4, lab: "Quarterfinal 4", a: { seed: "A2" }, b: { seed: "B3" } },
    { id: "SUN-SF1", r: 1, f: 1, lab: "Semifinal 1", a: { w: "SUN-QF1" }, b: { w: "SUN-QF2" } },
    { id: "SUN-SF2", r: 1, f: 2, lab: "Semifinal 2", a: { w: "SUN-QF3" }, b: { w: "SUN-QF4" } },
    { id: "SUN-C1", r: 1, f: 3, lab: "5th place semi 1", a: { seed: "A5" }, b: { l: "SUN-QF1" } },
    { id: "SUN-C2", r: 1, f: 4, lab: "5th place semi 2", a: { seed: "B5" }, b: { l: "SUN-QF3" } },
    { id: "SUN-FINAL", r: 2, f: 1, lab: "Final", a: { w: "SUN-SF1" }, b: { w: "SUN-SF2" } },
    { id: "SUN-5TH", r: 2, f: 2, lab: "5th place final", a: { w: "SUN-C1" }, b: { w: "SUN-C2" } },
    { id: "SUN-7TH", r: 2, f: 3, lab: "The 7inals", a: { l: "SUN-QF2" }, b: { l: "SUN-QF4" } },
    { id: "SUN-9TH", r: 2, f: 4, lab: "9th place", a: { l: "SUN-C1" }, b: { l: "SUN-C2" } }
  ];
  const SHORT = { "SUN-QF1": "QF 1", "SUN-QF2": "QF 2", "SUN-QF3": "QF 3", "SUN-QF4": "QF 4", "SUN-SF1": "Semi 1", "SUN-SF2": "Semi 2", "SUN-C1": "5th semi 1", "SUN-C2": "5th semi 2" };
  const ORD = ["", "1st", "2nd", "3rd", "4th", "5th"];
  const satId = (r, f) => `SAT-R${r + 1}-F${f}`;
  const ALL_KEYS = ["A", "B"].flatMap(p => [1, 2, 3, 4, 5].map(i => p + i));

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const teamOf = key => S.teams[POOLS[key[0]][+key[1] - 1] - 1];
  const rankOf = key => POOLS[key[0]][+key[1] - 1];
  const fmt = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM"); };
  const fmtS = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0"); };
  const slot = () => S.sat.hard + 5;
  const step = () => slot() + S.sat.brk;
  const satStart = r => S.sat.start + r * step();
  const sunStart = r => S.sun.start + r * step();

  function result(id) {
    const sc = S.scores[id];
    if (!sc) return null;
    const a = sc[0], b = sc[1];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
    return { a, b, aw: a > b };
  }
  function satGames() {
    const out = [];
    SAT.forEach((rd, r) => rd.forEach((g, i) => { if (g) out.push({ id: satId(r, i + 1), a: g[0], b: g[1], p: g[2], r, f: i + 1 }); }));
    return out;
  }
  const sitting = r => ALL_KEYS.filter(k => !SAT[r].some(g => g && (g[0] === k || g[1] === k)));

  function records() {
    const rec = {};
    ALL_KEYS.forEach(k => rec[k] = { k, w: 0, l: 0, games: [] });
    satGames().forEach(g => {
      const r = result(g.id); if (!r) return;
      rec[g.a].games.push({ opp: g.b, pf: r.a, pa: r.b });
      rec[g.b].games.push({ opp: g.a, pf: r.b, pa: r.a });
      if (r.aw) { rec[g.a].w++; rec[g.b].l++; } else { rec[g.b].w++; rec[g.a].l++; }
    });
    ALL_KEYS.forEach(k => {
      const x = rec[k];
      x.sos = x.games.reduce((n, g) => n + rec[g.opp].games.filter(o => o.opp !== k && o.pf > o.pa).length, 0);
      x.pdCap = x.games.reduce((n, g) => n + Math.max(-5, Math.min(5, g.pf - g.pa)), 0);
    });
    return rec;
  }
  function breakTie(group, rec) {
    if (group.length < 2) return group;
    const ks = group.map(x => x.k);
    const playedAll = ks.every(a => ks.every(b => a === b || rec[a].games.some(g => g.opp === b)));
    const common = ks.length ? ks.map(k => new Set(rec[k].games.map(g => g.opp).filter(o => !ks.includes(o)))).reduce((s, t) => new Set([...s].filter(x => t.has(x)))) : new Set();
    const steps = [
      x => playedAll ? x.games.filter(g => ks.includes(g.opp) && g.pf > g.pa).length : 0,
      x => x.sos,
      x => x.games.filter(g => common.has(g.opp)).reduce((n, g) => n + g.pf - g.pa, 0),
      x => x.pdCap,
      x => -rankOf(x.k)
    ];
    for (const fn of steps) {
      const vals = group.map(fn);
      if (vals.every(v => v === vals[0])) continue;
      const levels = [...new Set(vals)].sort((a, b) => b - a);
      return levels.flatMap(v => breakTie(group.filter((_, i) => vals[i] === v), rec));
    }
    return group;
  }
  function standings(p) {
    const rec = records();
    const list = [1, 2, 3, 4, 5].map(i => rec[p + i]);
    const wins = [...new Set(list.map(x => x.w))].sort((a, b) => b - a);
    const ordered = wins.flatMap(w => breakTie(list.filter(x => x.w === w), rec));
    const games = satGames().filter(g => g.a[0] === p || g.b[0] === p);
    const done = games.filter(g => result(g.id)).length;
    return { list: ordered, complete: done === games.length, done, total: games.length };
  }
  const placed = seed => { const s = standings(seed[0]); return s.complete ? s.list[+seed[1] - 1].k : null; };
  const seedLabel = seed => "Pool " + seed[0] + " " + (seed[1] === "1" ? "winner" : ORD[+seed[1]]);
  function side(sl) {
    if (sl.seed) { const k = placed(sl.seed); return { name: k ? teamOf(k) : null, ph: seedLabel(sl.seed), seed: sl.seed }; }
    const id = sl.w || sl.l, g = SUN.find(x => x.id === id), r = result(id);
    const ph = (sl.w ? "Winner " : "Loser ") + SHORT[id];
    if (!r) return { name: null, ph };
    const A = side(g.a), B = side(g.b);
    const pick = sl.w ? (r.aw ? A : B) : (r.aw ? B : A);
    return { name: pick.name, ph };
  }
  const sunGame = id => SUN.find(x => x.id === id);

  function myTeam() { try { return localStorage.getItem("scc-team") || ""; } catch (e) { return ""; } }
  function setMyTeam(v) { try { localStorage.setItem("scc-team", v); } catch (e) {} }

  function rowHTML(idx, s, r) {
    const cls = r ? ((idx === 0) === r.aw ? "w" : "l") : "";
    const seed = s.seed ? `<em>${esc(s.seed)}</em>` : "";
    return `<div class="row ${cls}"><span class="n${s.name ? "" : " ph"}">${seed}${esc(s.name || s.ph)}</span><span class="s">${r ? (idx === 0 ? r.a : r.b) : ""}</span></div>`;
  }
  function gameCard(id, cls, lab, right, A, B) {
    const t = myTeam(), r = result(id), mine = t && (A.name === t || B.name === t);
    return `<div class="g ${cls}${mine ? " mine-hl" : ""}"><div class="lab"><span class="p">${esc(lab)}</span><span>${esc(right)}</span></div>${rowHTML(0, A, r)}${rowHTML(1, B, r)}</div>`;
  }
  function bracketMatch(id, extraCls) {
    const g = sunGame(id), A = side(g.a), B = side(g.b);
    return `<div class="bm ${extraCls || ""}" style="grid-area:${id.replace("SUN-", "m")}">${gameCard(id, "X", SHORT[id] || g.lab, "Field " + g.f, A, B)}</div>`;
  }

  function myGames(t) {
    const out = [];
    satGames().forEach(g => {
      const A = teamOf(g.a), B = teamOf(g.b);
      if (A === t || B === t) out.push({ day: "Sat", t: satStart(g.r), f: g.f, lab: g.p === "X" ? "Crossover" : "Pool " + g.p + ", Round " + (g.r + 1), opp: A === t ? B : A, id: g.id, me: A === t ? 0 : 1 });
    });
    SUN.forEach(g => {
      const A = side(g.a), B = side(g.b);
      if (A.name === t || B.name === t) { const o = A.name === t ? B : A; out.push({ day: "Sun", t: sunStart(g.r), f: g.f, lab: g.lab, opp: o.name || o.ph, id: g.id, me: A.name === t ? 0 : 1 }); }
    });
    const sits = SAT.map((_, r) => r).filter(r => sitting(r).some(k => teamOf(k) === t));
    return { out, sits };
  }

  const CONTACTS = [
    { role: "Tournament Director · Primary contact", name: "Quinn Daly", phone: "(203) 885-5375", primary: true },
    { role: "Doom President · Secondary contact", name: "Samuel Sutton", email: "doomcaptains@gmail.com", phone: "(360) 932-9751" },
    { role: "Assistant Director for Competitive Club Sports", name: "Chris Jones", email: "cjones73@syr.edu", phone: "(315) 442-5163" },
    { role: "Director for Competitive Club Sports", name: "Peter Way", email: "pway03@syr.edu", phone: "(315) 443-3960" }
  ];
  const TRAINER = { role: "SU Club Sports Athletic Trainer", name: "Chris Zhao", email: "czhao37@syr.edu", phone: "(804) 484-0046" };
  const tel = p => "tel:+1" + p.replace(/\D/g, "");
  const mapsLink = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

  function band(title, sub, id) { return `<div id="${id}" class="anchor bandwrap"><div class="band"><h2>${title}</h2><p>${sub}</p></div><div class="grain"></div></div>`; }
  const statusHTML = () => `<div class="status ${status.kind}"><i></i><span>${esc(status.text)}</span></div>`;

  function siteHeader(sections) {
    const link = (href, page, label) => `<a href="${href}"${PAGE === page ? ' aria-current="page"' : ""}>${label}</a>`;
    const sub = sections && sections.length ? `<nav class="sections" aria-label="On this page"><div class="sections-in">${sections.map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}</div></nav>` : "";
    return `<header class="site"><div class="site-in"><a class="brand" href="index.html"><span class="glyph" aria-hidden="true"></span><span>Salt City Classic</span></a>
      <nav class="primary" aria-label="Main">${link("index.html", "overview", "Overview")}${link("saturday.html", "saturday", "Saturday")}${link("sunday.html", "sunday", "Sunday")}${link("announcements.html", "announcements", "News")}</nav></div>${sub}<div class="grain thin"></div></header>`;
  }
  const tiebreakersList = () => `<ol class="tb"><li><b>Record.</b> Wins out of 3, crossover included.</li><li><b>Head to head.</b> Only if every tied team played each other.</li><li><b>Strength of schedule.</b> Total Saturday wins of your opponents, not counting their games against you.</li><li><b>Common opponent point differential.</b> Margins against opponents all tied teams played. No cap.</li><li><b>Point differential.</b> All 3 games, capped at 5 per game.</li><li><b>Original seed.</b></li></ol>
        <p class="note">With three or more teams tied, apply each step to the whole group. Once a team is separated, start again from head to head with the teams still tied.</p>`;
  function siteFooter() {
    return `<footer class="site-foot"><div class="grain"></div><p><b>Thank you!</b> We look forward to raising your bar for what a great tournament looks like.</p>
      <p>Don't forget to follow and tag us <a href="https://www.instagram.com/doom.ultimate/">@doom.ultimate</a> on Instagram.</p>
      <p class="small">Scores update about once a minute.</p></footer>`;
  }
  function pageHero(eyebrow, title, sub) {
    return `<section class="hero"><div class="mark" aria-hidden="true"></div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="sub">${sub}</p></section>`;
  }
  function dayHero(title) { return `<section class="hero compact"><div class="mark" aria-hidden="true"></div><h1>${title}</h1></section>`; }
  function mineBanner() {
    const t = myTeam();
    if (!t || !S.teams.includes(t)) return `<a class="minechip" href="index.html#team">Pick your team to highlight your games</a>`;
    return `<a class="minechip on" href="index.html#team">Highlighting <b>${esc(t)}</b><span>Change</span></a>`;
  }

  function viewFinder() {
    const t = myTeam();
    const opts = S.teams.map(n => `<option${n === t ? " selected" : ""}>${esc(n)}</option>`).join("");
    let body = `<p class="note">Pick your team to see every game you play this weekend, with times and fields.</p>`;
    if (t && S.teams.includes(t)) {
      const { out, sits } = myGames(t);
      const next = out.find(g => !result(g.id));
      body = out.map(g => {
        const r = result(g.id); let res = "";
        if (r) { const mine = g.me === 0 ? r.a : r.b, opp = g.me === 0 ? r.b : r.a; res = `${mine > opp ? "W" : "L"} ${mine}-${opp}`; }
        return `<div class="mg${g === next ? " next" : ""}"><div class="when">${g.day} ${fmt(g.t)}<small>FIELD ${g.f}</small></div><div class="vs"><b>vs ${esc(g.opp)}</b><span>${esc(g.lab)}</span></div><div class="res">${res || (g === next ? "<small>NEXT</small>" : "")}</div></div>`;
      }).join("");
      if (sits.length) body += `<p class="note">Saturday bye: Round ${sits[0] + 1} (${fmt(satStart(sits[0]))}).</p>`;
      if (!["A", "B"].every(p => standings(p).complete)) body += `<p class="note">Sunday games show up here once pool play is final.</p>`;
    }
    return `<section class="finder anchor" id="team"><label for="team-pick">Find your team</label><select id="team-pick"><option value="">Choose a team</option>${opts}</select><div class="mine">${body}</div></section>`;
  }

  function contactCard(c) {
    return `<div class="contact${c.primary ? " primary" : ""}"><span class="role">${esc(c.role)}</span><b>${esc(c.name)}</b><a href="${tel(c.phone)}">${esc(c.phone)}</a>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}</div>`;
  }

  function renderOverview() {
    const latest = [...S.posts].sort((x, y) => y.id - x.id)[0];
    const nc = latest ? allComments().filter(c => c.post === latest.id).length : 0;
    const rem = latest ? `<a class="teaser anchor" id="latest" href="announcements.html#post-${latest.id}"><span class="kicker">Latest announcement${latest.posted ? " · " + esc(latest.posted) : ""}</span><b>${esc(latest.title)}</b>${latest.message ? `<p>${esc(latest.message)}</p>` : ""}<span class="more">${nc ? nc + (nc === 1 ? " comment" : " comments") + " · " : ""}All announcements</span></a>` : "";
    const plist = p => `<div class="plist ${p}"><h3>Pool ${p}</h3><ol>${[1, 2, 3, 4, 5].map(i => { const rank = rankOf(p + i), [nick, school] = S.teamInfo[rank - 1] || ["", ""]; return `<li><span class="no">${rank}</span><div><b>${esc(nick || S.teams[rank - 1])}</b>${school ? `<span>${esc(school)}</span>` : ""}</div></li>`; }).join("")}</ol></div>`;
    const facts = S.info.length ? `<dl class="facts">${S.info.map(i => `<div><dt>${esc(i.item)}</dt><dd>${esc(i.details)}</dd></div>`).join("")}</dl>` : "";
    const sections = [["team", "Your games"], ["venue", "Venue"], ["teams", "Teams"], ["rules", "Rules"], ["safety", "Safety"], ["contacts", "Contacts"], ["onsite", "On site"]];
    return siteHeader(sections) + `<main class="wrap">` + pageHero("Fall 2026 · Lower Hookway · Syracuse, NY", "Salt City Classic", `10 teams, 2 pools, 4 fields. Games to ${S.sat.gameTo}.`) + statusHTML() + viewFinder() + rem + `
      <section class="view anchor" id="venue">${band("VENUE", "Lower Hookway, fields 1 to 4", "venue-b")}
        <div class="notes"><span><b>Address:</b> 1799 E Colvin St, Syracuse, NY 13210. <a href="${mapsLink("1799 E Colvin St, Syracuse, NY 13210")}">Open in Maps</a></span>
        <span><b>Parking:</b> the Upper Hookway parking lot, or the adjacent street, Buckingham Ave. Pay attention to street signage.</span>
        <span><b>Saturday:</b> park on the right side of Buckingham Ave (field side). <b>Sunday:</b> park on the left side (opposite side).</span></div>
        ${facts}
        <figure class="map"><img src="map-fields.jpg" alt="Map of fields 1 to 4 at Lower Hookway with HQ, bathroom and parking marked" loading="lazy"></figure>
        <figure class="map"><img src="map-parking.jpg" alt="Parking map showing the Upper Hookway lot and which side of Buckingham Ave to park on each day" loading="lazy"></figure></section>
      <section class="view anchor" id="teams">${band("TEAMS", "Pools and seeds", "teams-b")}<div class="plists">${plist("A")}${plist("B")}</div>
        <p class="note">Sunday's bracket is set by where teams finish in their pool. Full schedule on the <a href="saturday.html">Saturday</a> and <a href="sunday.html">Sunday</a> pages.</p></section>
      <section class="view anchor" id="rules">${band("RULES", "Both days", "rules-b")}
        <ul class="tb rules"><li>All games are ${S.sat.hard} minute games to ${S.sat.gameTo}. 1 timeout per half, with 1 floater.</li><li><b>Soft cap at ${S.sat.soft} minutes:</b> finish the point, then play to the highest score plus 1.</li><li><b>Hard cap at ${S.sat.hard} minutes:</b> finish the point. If tied, play one more point; otherwise the leading team wins.</li><li>The caps do not affect timeouts.</li><li>Halftime cap at 45 minutes.</li></ul>
        <h3 class="mini-h" id="tiebreakers">Pool tiebreakers</h3>${tiebreakersList()}</section>
      <section class="view anchor" id="safety">${band("HEALTH AND SAFETY", "Trainer and hospital", "safety-b")}
        <a class="sos" href="tel:911"><b>Emergency? Call 911.</b><span>Then find the trainer or the tournament director, Quinn Daly, (203) 885-5375.</span></a>
        <div class="two">${contactCard(TRAINER)}
        <div class="contact"><span class="role">Nearest hospital, 8 minutes from the fields</span><b>Crouse Hospital</b><span>736 Irving Ave, Syracuse, NY 13210</span><a href="${mapsLink("Crouse Hospital, 736 Irving Ave, Syracuse, NY 13210")}">Directions</a></div></div></section>
      <section class="view anchor" id="contacts">${band("CONTACTS", "Tournament staff", "contacts-b")}<div class="cgrid">${CONTACTS.map(contactCard).join("")}</div></section>
      <section class="view anchor" id="onsite">${band("ON SITE", "Food, water, spirit and trash", "onsite-b")}
        <div class="cgrid">
          <div class="info-card"><h3>Food and water</h3><p>A tournament snack table will be provided at tourney central.</p><p>There will be Gatorade water jugs scattered around the fields.</p></div>
          <div class="info-card"><h3>Spirit</h3><p>Spirit of the Game is an essential part of College Ultimate. Spirit ensures that the game is played with respect, control, intelligence, and energy. Have fun, be loud, be safe.</p><p>For any spirit related questions reach out to vibes captain Christopher Kilbridge (<a href="mailto:ctkilbri@syr.edu">ctkilbri@syr.edu</a>).</p></div>
          <div class="info-card"><h3>Trash and recycling</h3><p>Trash bags will be given to each team. There will be larger trash bins at tournament central. Please ensure there is no trash left behind on the fields so we can continue to use them in years to come.</p></div>
        </div></section></main>` + siteFooter();
  }

  function viewSat() {
    const rounds = SAT.map((rd, r) => {
      const s = satStart(r);
      const games = rd.map((g, i) => g ? gameCard(satId(r, i + 1), g[2], g[2] === "X" ? "Crossover · 3 seeds" : "Pool " + g[2], "Field " + (i + 1), { name: teamOf(g[0]) }, { name: teamOf(g[1]) }) : "").join("");
      return `<div class="round"><div class="rhead"><h3>Round ${r + 1}</h3><span class="t">${fmt(s)} to ${fmtS(s + slot())}</span><span class="cap">Soft cap ${fmtS(s + S.sat.soft)} · Hard cap ${fmtS(s + S.sat.hard)}${rd.includes(null) ? " · Field 4 open" : ""}</span></div><div class="games">${games}</div><div class="rest">Bye: <b>${sitting(r).map(teamOf).map(esc).join(", ")}</b></div></div>`;
    }).join("");
    return `<section class="view">${band("SCHEDULE", "Pool play, 4 rounds", "schedule")}${rounds}</section>`;
  }
  function viewStandings() {
    const pools = ["A", "B"].map(p => {
      const s = standings(p);
      const rows = s.list.map((x, i) => `<tr class="z${i < 4 ? "in" : "out"}"><td class="tm"><span class="sd">${i + 1}</span><b>${esc(teamOf(x.k))}</b></td><td>${x.w}-${x.l}</td><td>${x.sos}</td><td>${x.pdCap > 0 ? "+" : ""}${x.pdCap}</td><td>#${rankOf(x.k)}</td></tr>`).join("");
      return `<div class="table ${p}"><h3>Pool ${p}<span>${s.complete ? "Final" : s.done + " of " + s.total + " games in"}</span></h3><table><thead><tr><th class="tm">Team</th><th>W-L</th><th title="Strength of schedule">SOS</th><th title="Point differential, capped at 5 per game">+/-</th><th>Seed</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");
    return `<section class="view">${band("STANDINGS", "Live from Saturday's scores", "standings")}<div class="pools">${pools}</div><p class="foot">Shaded: top 4 in each pool, headed to the championship bracket. 5th place goes to the 5th place bracket.</p></section>`;
  }
  function renderSaturday() {
    return siteHeader([["schedule", "Schedule"], ["standings", "Standings"], ["format", "Format"], ["tiebreakers", "Tiebreakers"]]) + `<main class="wrap">` + dayHero("Saturday") + viewSat() + viewStandings() + `
      <section class="view anchor" id="format">${band("FORMAT", "How pool play works", "format-b")}
        <div class="notes"><span>Two pools of 5. Every team plays 3 games and has one bye.</span>
        <span>In each pool the 1 and 5 seeds, 2 and 3 seeds, and 3 and 4 seeds don't play each other. Instead, the two 3 seeds play a crossover game that counts on both records.</span>
        <span>Rounds are ${slot()} minute slots with ${S.sat.brk} minutes between rounds.</span></div></section>
      <section class="view anchor" id="tiebreakers">${band("TIEBREAKERS", "How pool ties are broken", "tiebreakers-b")}
        ${tiebreakersList()}</section></main>` + siteFooter();
  }

  function renderSunday() {
    const r = result("SUN-FINAL"); let champ = "";
    if (r) { const g = sunGame("SUN-FINAL"), w = (r.aw ? side(g.a) : side(g.b)).name; if (w) champ = `<div class="champ"><small>SALT CITY CLASSIC CHAMPION</small><b>${esc(w)}</b></div>`; }
    const heads = `<div class="bh" style="grid-area:h1">Quarters <b>${fmtS(sunStart(0))}</b></div><div class="bh" style="grid-area:h2">Semis <b>${fmtS(sunStart(1))}</b></div><div class="bh" style="grid-area:h3">Final <b>${fmtS(sunStart(2))}</b></div>`;
    const gold = `<div class="bracket gold">${heads}${["SUN-QF1", "SUN-QF2", "SUN-QF3", "SUN-QF4", "SUN-SF1", "SUN-SF2", "SUN-FINAL"].map(id => bracketMatch(id)).join("")}<div class="cn" style="grid-area:c1"></div><div class="cn" style="grid-area:c2"></div><div class="cn tall" style="grid-area:c3"></div></div>`;
    const five = `<div class="bracket mini"><div class="bh" style="grid-area:h1">5th place semis <b>${fmtS(sunStart(1))}</b></div><div class="bh" style="grid-area:h2">5th place final <b>${fmtS(sunStart(2))}</b></div>${bracketMatch("SUN-C1")}${bracketMatch("SUN-C2")}${bracketMatch("SUN-5TH")}<div class="cn" style="grid-area:c1"></div></div>`;
    const more = ["SUN-7TH", "SUN-9TH"].map(id => { const g = sunGame(id); return gameCard(id, "X", g.lab, fmtS(sunStart(g.r)) + " · Field " + g.f, side(g.a), side(g.b)); }).join("");
    return siteHeader([["bracket", "Championship"], ["fifth", "5th place"], ["placement", "7th and 9th"], ["format", "Format"]]) + `<main class="wrap">` + dayHero("Sunday") + `
      <section class="view">${band("CHAMPIONSHIP", "Top 4 from each pool", "bracket")}${champ}
        <div class="scroller">${gold}</div><p class="foot">Semifinal losers tie for 3rd. Teams fill in when pool play is final; winners move on as scores come in.</p></section>
      <section class="view">${band("5TH PLACE", "Pool 5th place teams and QF 1 and 3 losers", "fifth")}<p class="keyline">QF 1 and QF 3 are the quarterfinals with the pool winners, so their losers play the pool 5th place teams. Win the 5th place semi and you play for 5th; lose it and you play for 9th.</p><div class="scroller">${five}</div></section>
      <section class="view">${band("PLACEMENT", "The 7inals and 9th place", "placement")}<div class="games">${more}</div></section>
      <section class="view anchor" id="format">${band("FORMAT", "How Sunday works", "format-b")}
        <div class="notes"><span>The top 4 from each pool make an 8 team bracket. Quarterfinals are A1 v B4, B2 v A3, B1 v A4 and A2 v B3. Semifinal losers tie for 3rd.</span>
        <span>The two 5th place teams rest during the quarterfinals, then play the losers of QF 1 and QF 3. Those winners play for 5th; the losers play for 9th.</span>
        <span>The losers of QF 2 and QF 4 play the 7inals for 7th.</span></div></section></main>` + siteFooter();
  }

  let openReply = null, pendingRender = false;
  const normId = v => String(v ?? "").trim().replace(/\.0+$/, "");
  function loadPending() { try { return JSON.parse(localStorage.getItem("scc-pending") || "[]"); } catch (e) { return []; } }
  function savePending(v) { try { localStorage.setItem("scc-pending", JSON.stringify(v)); } catch (e) {} }
  let pending = loadPending();
  function allComments() {
    const have = new Set(S.comments.map(c => c.id));
    pending = pending.filter(c => !have.has(c.id) && Date.now() - c.at < 20 * 60000);
    savePending(pending);
    return S.comments.concat(pending);
  }
  function savedName() { try { return localStorage.getItem("scc-name") || ""; } catch (e) { return ""; } }
  function commentForm(post, reply) {
    if (!CFG.commentsUrl && !CFG.demo) return reply ? "" : `<p class="note">Comments open soon.</p>`;
    return `<form class="cform${reply ? " reply" : ""}" data-post="${post}" data-reply="${reply || ""}">
      <input name="name" aria-label="Your name" placeholder="Your name" maxlength="40" required value="${esc(savedName())}">
      <textarea name="comment" aria-label="${reply ? "Your reply" : "Your comment"}" placeholder="${reply ? "Write a reply" : "Add a comment"}" maxlength="1000" rows="2" required></textarea>
      <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="crow">${reply ? `<button type="button" class="link" data-cancel>Cancel</button>` : ""}<button type="submit" class="post">${reply ? "Reply" : "Post"}</button></div></form>`;
  }
  function commentHTML(c, post, kids) {
    return `<li class="cm${c.pending ? " pending" : ""}" id="c-${esc(c.id)}"><div class="chead"><b>${esc(c.name)}</b><span>${esc(c.time)}${c.pending ? " · posting" : ""}</span></div><p>${esc(c.text)}</p>
      ${kids === null ? "" : `<button type="button" class="link" data-reply-to="${esc(c.id)}" data-post="${post}">Reply</button>`}
      ${kids && kids.length ? `<ul class="replies">${kids.map(k => commentHTML(k, post, null)).join("")}</ul>` : ""}
      ${openReply === c.id ? commentForm(post, c.id) : ""}</li>`;
  }
  function renderAnnouncements() {
    const posts = [...S.posts].sort((x, y) => y.id - x.id);
    const cs = allComments();
    const body = posts.length ? posts.map(pst => {
      const mine = cs.filter(c => c.post === pst.id);
      const ids = new Set(mine.map(c => c.id));
      const top = mine.filter(c => !c.reply || !ids.has(c.reply));
      const kids = id => mine.filter(c => c.reply === id);
      return `<article class="post anchor" id="post-${pst.id}"><div class="phead"><span class="kicker">${pst.posted ? esc(pst.posted) + " · " : ""}Tournament director</span><h2>${esc(pst.title)}</h2>${pst.message ? `<p>${esc(pst.message)}</p>` : ""}</div>
        <div class="thread"><span class="ccount">${mine.length ? mine.length + (mine.length === 1 ? " comment" : " comments") : "No comments yet"}</span>
        <ul class="comments">${top.map(c => commentHTML(c, pst.id, kids(c.id))).join("")}</ul>${commentForm(pst.id, "")}</div></article>`;
    }).join("") : `<p class="note">No announcements yet. Check back closer to the weekend.</p>`;
    return siteHeader([]) + `<main class="wrap">` + dayHero("Announcements") + `<section class="view">${body}</section></main>` + siteFooter();
  }
  function busyTyping() { return [...document.querySelectorAll(".cform textarea")].some(el => el === document.activeElement || el.value.trim()); }
  function nowLabel() { const d = new Date(), m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]; return m + " " + d.getDate() + ", " + fmt(d.getHours() * 60 + d.getMinutes()); }
  function submitComment(form) {
    const name = form.name.value.trim().slice(0, 40), text = form.comment.value.trim().slice(0, 1000);
    if (!name || !text) return;
    try { localStorage.setItem("scc-name", name); } catch (e) {}
    const c = { time: nowLabel(), id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), post: +form.dataset.post, reply: form.dataset.reply, name, text, pending: true, at: Date.now() };
    pending.push(c); savePending(pending);
    if (CFG.commentsUrl) fetch(CFG.commentsUrl, { method: "POST", mode: "no-cors", body: new URLSearchParams({ id: c.id, post: c.post, reply: c.reply, name, comment: text, website: form.website.value }) }).catch(() => {});
    form.comment.value = ""; openReply = null; render();
  }
  document.addEventListener("submit", e => { if (e.target.classList.contains("cform")) { e.preventDefault(); submitComment(e.target); } });
  document.addEventListener("click", e => {
    const r = e.target.closest("[data-reply-to]");
    if (r) { openReply = r.dataset.replyTo; render(); const t = document.querySelector(`.cform.reply textarea`); if (t) t.focus(); return; }
    if (e.target.closest("[data-cancel]")) { openReply = null; render(); }
  });
  document.addEventListener("focusout", () => setTimeout(() => { if (pendingRender && !busyTyping()) { pendingRender = false; render(); } }, 50));

  let spyObs = null;
  function spy() {
    if (spyObs) spyObs.disconnect();
    const links = [...document.querySelectorAll(".sections-in a")];
    if (!links.length || !("IntersectionObserver" in window)) return;
    const mark = id => links.forEach(a => { const on = a.getAttribute("href") === "#" + id; a.classList.toggle("on", on); if (on && a.scrollIntoView) a.parentElement.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" }); });
    const targets = links.map(a => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    spyObs = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) mark(v.target.id); }, { rootMargin: "-120px 0px -60% 0px" });
    targets.forEach(t => spyObs.observe(t));
  }
  function render() {
    const y = window.scrollY;
    document.getElementById("app").innerHTML = PAGE === "saturday" ? renderSaturday() : PAGE === "sunday" ? renderSunday() : PAGE === "announcements" ? renderAnnouncements() : renderOverview();
    window.scrollTo(0, y);
    spy();
  }

  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ""));
  }
  function objects(text) {
    const rows = parseCSV(text); if (!rows.length) return [];
    const head = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }
  function parseTime(v, fallback) {
    const m = String(v || "").match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
    if (!m) return fallback;
    let h = +m[1]; const ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
    return h * 60 + +m[2];
  }
  const num = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; };
  const yes = v => /^(true|yes|y|1|x)$/i.test(String(v || "").trim());
  const sheetUrl = name => `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}&t=${Date.now()}`;
  const getTab = name => fetch(sheetUrl(name), { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });

  async function load() {
    if (!CFG.sheetId) return;
    const tabs = ["Scores", "Teams", "Settings", "Announcements", "Info", "Comments"];
    const res = await Promise.allSettled(tabs.map(getTab));
    const [sc, tm, se, rm, inf, cm] = res.map(r => r.status === "fulfilled" ? r.value : null);
    if (!sc || !tm || !se) {
      status = { kind: "off", text: "Can't reach the score sheet right now. Showing the last scores loaded." };
      render(); return;
    }
    const next = JSON.parse(JSON.stringify(DEFAULTS));
    objects(tm).forEach(o => { const k = parseInt(o.rank, 10); if (k >= 1 && k <= 10 && o.team) { next.teams[k - 1] = o.team; if ("team name" in o || "school" in o) next.teamInfo[k - 1] = [o["team name"] || "", o.school || ""]; } });
    const st = objects(se)[0] || {};
    next.sat = { start: parseTime(st.sat_start, 540), brk: num(st.break_min, 15), soft: num(st.soft_cap, 80), hard: num(st.hard_cap, 90), gameTo: num(st.game_to, 15) };
    next.sun = { start: parseTime(st.sun_start, 540) };
    objects(sc).forEach(o => {
      const id = (o["game id"] || "").toUpperCase(); if (!id) return;
      const a = parseFloat(o["score 1"]), b = parseFloat(o["score 2"]);
      if (Number.isFinite(a) && Number.isFinite(b)) next.scores[id] = [a, b];
    });
    if (rm) next.posts = objects(rm).filter(o => yes(o.show) && o.title).map((o, i) => ({ id: normId(o["post id"]) || String(i + 1), title: o.title, message: o.message || "", posted: o.posted || "" })).map(x => ({ ...x, id: +x.id || 0, key: x.id }));
    if (cm) next.comments = objects(cm).filter(o => !yes(o.hide) && o.name && o.comment && o["comment id"]).map(o => ({ time: o.time, id: o["comment id"], post: +normId(o["post id"]) || 0, reply: o["reply to"] || "", name: o.name.replace(/^'/, ""), text: o.comment.replace(/^'/, "") }));
    if (inf) next.info = objects(inf).filter(o => o.item && o.details).map(o => ({ item: o.item, details: o.details }));
    S = next; saveCache(S);
    const d = new Date();
    status = { kind: "", text: "Live · updated " + fmt(d.getHours() * 60 + d.getMinutes()) };
    if (busyTyping()) pendingRender = true; else render();
  }
  function loadCache() { try { const v = JSON.parse(localStorage.getItem("scc-data-v4") || "null"); return v && v.teams && v.teamInfo && v.posts ? v : null; } catch (e) { return null; } }
  function saveCache(v) { try { localStorage.setItem("scc-data-v4", JSON.stringify(v)); } catch (e) {} }

  document.addEventListener("change", e => { if (e.target.id === "team-pick") { setMyTeam(e.target.value); render(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  if (!CFG.sheetId && CFG.demo) { S.posts = CFG.demo.posts || []; S.comments = CFG.demo.comments || []; }
  render();
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  load();
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  window.SCC_TEST = { standings, side, teamOf, records };
})();
