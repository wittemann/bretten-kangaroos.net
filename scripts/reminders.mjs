// Opens a GitHub issue for recurring chores that are easy to forget. Run
// weekly by .github/workflows/reminders.yml; each reminder has a fixed title
// per year, so it is opened once and never again after it was closed.
//
// - BSM league IDs: from March on, src/data/bsm-leagues.json should name the
//   new season, otherwise standings and games stay on last year's leagues.
// - Xmas-Ball sign-up mails: the privacy policy promises to delete them three
//   months after the tournament (date from content/xmas-ball.md).
//
// PHPMailer updates come as Dependabot pull requests (.github/dependabot.yml).
//
// `node scripts/reminders.mjs --dry-run` only prints what would be opened.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LEAGUES_PATH = new URL("../src/data/bsm-leagues.json", import.meta.url);
const XMAS_BALL_PATH = new URL("../content/xmas-ball.md", import.meta.url);
const NEW_SEASON_MONTH = 3; // March: BSM has the new leagues, games start in April
const MAIL_RETENTION_MONTHS = 3;

const dryRun = process.argv.includes("--dry-run");
const today = berlinToday();

const reminders = [leagueReminder(), signupMailReminder()].filter(Boolean);
if (!reminders.length) console.log("No reminders due.");

for (const { title, body } of reminders) {
  if (dryRun) {
    console.log(`Would open: ${title}\n${body}\n`);
  } else if (issueExists(title)) {
    console.log(`Already opened: ${title}`);
  } else {
    gh(["issue", "create", "--title", title, "--body", body]);
    console.log(`Opened: ${title}`);
  }
}

function leagueReminder() {
  const { season } = JSON.parse(readFileSync(LEAGUES_PATH, "utf8"));
  if (today.year <= season || today.month < NEW_SEASON_MONTH) return null;
  return {
    title: `BSM league IDs for ${today.year}`,
    body: [
      `\`src/data/bsm-leagues.json\` still has season ${season}, so standings and games show last year's leagues.`,
      "",
      `Look up the ${today.year} leagues of the Kangaroos teams on the BSM and put their IDs and \`"season": ${today.year}\``,
      "into the file, see `docs/bsm-api.md`. Close this issue when it's done.",
    ].join("\n"),
  };
}

function signupMailReminder() {
  const date = frontMatterDate(readFileSync(XMAS_BALL_PATH, "utf8"), "date");
  if (!date) return null;
  const due = new Date(
    Date.UTC(date.year, date.month - 1 + MAIL_RETENTION_MONTHS, date.day),
  );
  if (Date.UTC(today.year, today.month - 1, today.day) < due) return null;
  return {
    title: `Delete the Xmas-Ball ${date.year} sign-up mails`,
    body: [
      `The Xmas-Ball ${date.year} was on ${date.day}.${date.month}.${date.year}. The privacy policy promises to delete`,
      `the sign-up mails three months after the tournament, so they're due now.`,
      "",
      "Delete them in the `xmasball@bretten-kangaroos.net` mailbox (inbox and trash). Close this issue when it's done.",
    ].join("\n"),
  };
}

// `date: 2026-12-12` in the front matter → { year, month, day }
function frontMatterDate(markdown, field) {
  const frontMatter = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? "";
  const m = new RegExp(
    `^${field}:\\s*["']?(\\d{4})-(\\d{2})-(\\d{2})`,
    "m",
  ).exec(frontMatter);
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
}

function berlinToday() {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year, month, day };
}

// Open or closed: a closed reminder counts as done
function issueExists(title) {
  const found = JSON.parse(
    gh([
      "issue",
      "list",
      "--state",
      "all",
      "--search",
      `"${title}" in:title`,
      "--json",
      "title",
    ]),
  );
  return found.some((issue) => issue.title === title);
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}
