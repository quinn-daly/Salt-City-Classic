(function () {
  const CFG = window.SCC_CONFIG || {};
  const PAGE = document.body.dataset.page || "overview";
  const REFRESH_MS = 60000;
  const DEFAULTS = {
    teams: ["Cornell", "Syracuse", "Dhill", "Binghamton", "RIT", "Yale", "TULA", "Buffalo", "Boomers"],
    sat: { start: 540, brk: 10, soft: 75, hard: 85, gameTo: 13 },
    scores: {},
    posts: [],
    comments: [],
    info: [],
    teamInfo: [["Buds", "Cornell University"], ["Doom", "Syracuse University"], ["Dhill", "University of Vermont B"], ["Big Bear", "Binghamton University"], ["Spudheds", "RIT"], ["Superfly", "Yale University"], ["TULA Open", "University of Toronto"], ["GEH", "University at Buffalo"], ["Boomers", "Doom Alumni"]]
  };
  let S = loadCache() || DEFAULTS;
  let status = { kind: CFG.sheetId ? "wait" : "off", text: CFG.sheetId ? "Loading scores…" : (CFG.offText || "Score sheet not connected yet") };

  const N = 9;
  const POOLS = { A: [1, 6, 7], B: [2, 5, 8], C: [3, 4, 9] };
  const POOL_OF = {}; Object.entries(POOLS).forEach(([p, l]) => l.forEach(n => POOL_OF[n] = p));
  const SAT = [
    [[6, 7], [2, 8], [9, 3]],
    [[1, 7], [2, 5], [4, 9]],
    [[1, 6], [8, 5], [4, 3]]
  ];
  const CROSS = [[2, 3], [4, 5], [6, 7], [8, 9]];
  const ROUNDS = SAT.length + 1;
  const satId = (r, f) => `SAT-R${r + 1}-F${f}`;
  const SEEDS = Array.from({ length: N }, (_, i) => i + 1);

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const teamOf = n => S.teams[n - 1];
  const fmt = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM"); };
  const fmtS = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0"); };
  const step = () => S.sat.hard + S.sat.brk;
  const satStart = r => S.sat.start + r * step();

  function result(id) {
    const sc = S.scores[id];
    if (!sc) return null;
    const a = sc[0], b = sc[1];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
    return { a, b, aw: a > b };
  }
  const poolGames = () => SAT.flatMap((rd, r) => rd.map((g, i) => ({ id: satId(r, i + 1), a: g[0], b: g[1], p: POOL_OF[g[0]], r, f: i + 1 })));
  function records(games) {
    const rec = {};
    SEEDS.forEach(n => rec[n] = { n, w: 0, l: 0, pd: 0, played: 0 });
    games.forEach(g => {
      const r = result(g.id); if (!r || !g.a || !g.b) return;
      const A = rec[g.a], B = rec[g.b];
      A.played++; B.played++; A.pd += r.a - r.b; B.pd += r.b - r.a;
      if (r.aw) { A.w++; B.l++; } else { B.w++; A.l++; }
    });
    return rec;
  }
  const rankList = rec => SEEDS.map(n => rec[n]).sort((x, y) => (y.w - x.w) || (y.pd - x.pd) || (x.n - y.n));
  function crossSeeds() {
    const games = poolGames(), done = games.filter(g => result(g.id)).length;
    return { list: rankList(records(games)), complete: done === games.length, done, total: games.length };
  }
  function crossGames() {
    const cs = crossSeeds();
    return CROSS.map(([x, y], i) => ({ id: satId(SAT.length, i + 1), r: SAT.length, f: i + 1, x, y, a: cs.complete ? cs.list[x - 1].n : null, b: cs.complete ? cs.list[y - 1].n : null }));
  }
  const allSatGames = () => poolGames().concat(crossGames());
  function byes(r) {
    if (r < SAT.length) return SEEDS.filter(n => !SAT[r].some(g => g.includes(n)));
    const cs = crossSeeds(); return cs.complete ? [cs.list[0].n] : [];
  }
  const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

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
  function myGames(t) {
    const out = [];
    allSatGames().forEach(g => {
      const lab = g.r < SAT.length ? "Pool " + g.p : "Crossover";
      if (g.a && (teamOf(g.a) === t || teamOf(g.b) === t)) {
        const me = teamOf(g.a) === t ? 0 : 1;
        out.push({ t: satStart(g.r), f: g.f, lab, opp: teamOf(me ? g.a : g.b), id: g.id, me });
      }
    });
    const sits = [...Array(ROUNDS).keys()].filter(r => byes(r).some(n => teamOf(n) === t));
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
  const tiebreakersList = () => `<ol class="tb"><li><b>Record</b> from the two pool games.</li><li><b>Point differential</b> across those games, compared across all pools.</li><li><b>Original seed.</b></li></ol>`;
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
        return `<div class="mg${g === next ? " next" : ""}"><div class="when">Sat ${fmt(g.t)}<small>FIELD ${g.f}</small></div><div class="vs"><b>vs ${esc(g.opp)}</b><span>${esc(g.lab)}</span></div><div class="res">${res || (g === next ? "<small>NEXT</small>" : "")}</div></div>`;
      }).join("");
      if (sits.length) body += `<p class="note">Saturday bye: ${sits.map(r => fmt(satStart(r))).join(" and ")}.</p>`;
      if (!crossSeeds().complete) body += `<p class="note">Your 1:45 crossover game shows up once pool play is final.</p>`;
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
    const plist = p => `<div class="plist ${p}"><h3>Pool ${p}<small>Field ${"ABC".indexOf(p) + 1}</small></h3><ol>${POOLS[p].map(rank => { const [nick, school] = S.teamInfo[rank - 1] || ["", ""]; return `<li><span class="no">${rank}</span><div><b>${esc(nick || S.teams[rank - 1])}</b>${school ? `<span>${esc(school)}</span>` : ""}</div></li>`; }).join("")}</ol></div>`;
    const facts = S.info.length ? `<dl class="facts">${S.info.map(i => `<div><dt>${esc(i.item)}</dt><dd>${esc(i.details)}</dd></div>`).join("")}</dl>` : "";
    const sections = [["team", "Your games"], ["venue", "Venue"], ["teams", "Teams"], ["rules", "Rules"], ["safety", "Safety"], ["contacts", "Contacts"], ["onsite", "On site"]];
    return siteHeader(sections) + `<main class="wrap">` + pageHero("Fall 2026 · Lower Hookway · Syracuse, NY", "Salt City Classic", `9 teams, 3 pools, 4 fields. Games to ${S.sat.gameTo} on Saturday.`) + statusHTML() + viewFinder() + rem + `
      <section class="view anchor" id="venue">${band("VENUE", "Lower Hookway, fields 1 to 4", "venue-b")}
        <div class="notes"><span><b>Address:</b> 1799 E Colvin St, Syracuse, NY 13210. <a href="${mapsLink("1799 E Colvin St, Syracuse, NY 13210")}">Open in Maps</a></span>
        <span><b>Parking:</b> the Upper Hookway parking lot, or the adjacent street, Buckingham Ave. Pay attention to street signage.</span>
        <span><b>Saturday:</b> park on the right side of Buckingham Ave (field side). <b>Sunday:</b> park on the left side (opposite side).</span></div>
        ${facts}
        <figure class="map"><img src="map-fields.jpg" alt="Map of fields 1 to 4 at Lower Hookway with HQ, bathroom and parking marked" loading="lazy"></figure>
        <figure class="map"><img src="map-parking.jpg" alt="Parking map showing the Upper Hookway lot and which side of Buckingham Ave to park on each day" loading="lazy"></figure></section>
      <section class="view anchor" id="teams">${band("TEAMS", "Pools and seeds", "teams-b")}<div class="plists">${plist("A")}${plist("B")}${plist("C")}</div>
        <p class="note">Full schedule on the <a href="saturday.html">Saturday</a> page.</p></section>
      <section class="view anchor" id="rules">${band("RULES", "Saturday", "rules-b")}
        <ul class="tb rules"><li>Saturday games are to ${S.sat.gameTo}. 1 timeout per half, with 1 floater.</li><li><b>Soft cap at ${S.sat.soft} minutes:</b> finish the point, then play to the highest score plus 1.</li><li><b>Hard cap at ${S.sat.hard} minutes:</b> finish the point. If tied, play one more point; otherwise the leading team wins.</li><li>The caps do not affect timeouts.</li></ul>
        <h3 class="mini-h" id="tiebreakers">Crossover seeding</h3>${tiebreakersList()}</section>
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
    const cross = crossGames(), cs = crossSeeds();
    const rounds = [...Array(ROUNDS).keys()].map(r => {
      const s = satStart(r), isX = r === SAT.length;
      const games = isX
        ? cross.map(g => gameCard(g.id, "X", "Crossover · " + g.x + " v " + g.y, "Field " + g.f, { name: g.a && teamOf(g.a), ph: ORD[g.x] + " seed" }, { name: g.b && teamOf(g.b), ph: ORD[g.y] + " seed" })).join("")
        : SAT[r].map((g, i) => gameCard(satId(r, i + 1), POOL_OF[g[0]], "Pool " + POOL_OF[g[0]], "Field " + (i + 1), { name: teamOf(g[0]) }, { name: teamOf(g[1]) })).join("");
      const b = byes(r).map(teamOf).map(esc).join(", ");
      const rest = isX ? (b ? `Bye: <b>${b}</b>` : "Bye: the 1 seed after pool play") : `Bye: <b>${b}</b> · Field 4 open`;
      return `<div class="round"><div class="rhead"><h3>${isX ? "Crossover" : "Round " + (r + 1)}</h3><span class="t">${fmt(s)}</span><span class="cap">Soft cap ${fmtS(s + S.sat.soft)} · Hard cap ${fmtS(s + S.sat.hard)}</span></div>${isX && !cs.complete ? `<p class="note">Matchups fill in once all ${cs.total} pool games are in (${cs.done} so far).</p>` : ""}<div class="games">${games}</div><div class="rest">${rest}</div></div>`;
    }).join("");
    return `<section class="view">${band("SCHEDULE", "3 pool rounds, then the crossover", "schedule")}${rounds}</section>`;
  }
  function viewStandings() {
    const cs = crossSeeds(), all = rankList(records(allSatGames().filter(g => g.a)));
    const list = cs.complete ? all : cs.list;
    const rows = list.map((x, i) => `<tr><td class="tm"><span class="sd">${i + 1}</span><b>${esc(teamOf(x.n))}</b></td><td>${POOL_OF[x.n]}</td><td>${x.w}-${x.l}</td><td>${x.pd > 0 ? "+" : ""}${x.pd}</td><td>#${x.n}</td></tr>`).join("");
    const head = cs.complete ? "Saturday" : "Crossover seeding";
    const sub = cs.complete ? "All games" : cs.done + " of " + cs.total + " pool games in";
    return `<section class="view">${band("STANDINGS", "Live from Saturday's scores", "standings")}<div class="pools"><div class="table X"><h3>${head}<span>${sub}</span></h3><table><thead><tr><th class="tm">Team</th><th>Pool</th><th>W-L</th><th title="Point differential">+/-</th><th>Seed</th></tr></thead><tbody>${rows}</tbody></table></div></div><p class="foot">Pool play sets the crossover: 2 v 3, 4 v 5, 6 v 7 and 8 v 9. The 1 seed gets the bye.</p></section>`;
  }
  function renderSaturday() {
    return siteHeader([["schedule", "Schedule"], ["standings", "Standings"], ["format", "Format"]]) + `<main class="wrap">` + dayHero("Saturday") + viewSat() + viewStandings() + `
      <section class="view anchor" id="format">${band("FORMAT", "How Saturday works", "format-b")}
        <div class="notes"><span>Three pools of 3, one field per pool. Each team plays both pool opponents and sits out one round.</span>
        <span>At ${fmt(satStart(SAT.length))} everyone is reseeded across all pools and plays a crossover game. The top seed gets the bye.</span>
        <span>Seeding for the crossover:</span></div>${tiebreakersList()}</section></main>` + siteFooter();
  }

  function renderSunday() {
    return siteHeader([]) + `<main class="wrap">` + dayHero("Sunday") + `
      <section class="view">${band("COMING SOON", "Sunday format", "sunday")}
        <div class="notes"><span>Sunday's schedule will be posted here once it's set.</span>
        <span>Watch <a href="announcements.html">News</a> for the update.</span></div></section></main>` + siteFooter();
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
    objects(tm).forEach(o => { const k = parseInt(o.rank, 10); if (k >= 1 && k <= N && o.team) { next.teams[k - 1] = o.team; if ("team name" in o || "school" in o) next.teamInfo[k - 1] = [o["team name"] || "", o.school || ""]; } });
    const st = objects(se)[0] || {};
    next.sat = { start: parseTime(st.sat_start, 540), brk: num(st.break_min, 10), soft: num(st.soft_cap, 75), hard: num(st.hard_cap, 85), gameTo: num(st.game_to, 13) };
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
  function loadCache() { try { const v = JSON.parse(localStorage.getItem("scc-data-v5") || "null"); return v && v.teams && v.teamInfo && v.posts ? v : null; } catch (e) { return null; } }
  function saveCache(v) { try { localStorage.setItem("scc-data-v5", JSON.stringify(v)); } catch (e) {} }

  document.addEventListener("change", e => { if (e.target.id === "team-pick") { setMyTeam(e.target.value); render(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  if (!CFG.sheetId && CFG.demo) { S.posts = CFG.demo.posts || []; S.comments = CFG.demo.comments || []; }
  render();
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  load();
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  window.SCC_TEST = { crossSeeds, crossGames, teamOf };
})();
