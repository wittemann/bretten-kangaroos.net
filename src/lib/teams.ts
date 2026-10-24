// Team slugs as used in the `team` field of news and the file names in content/teams.
// The team select in .pages.yml lists the same slugs – keep both in sync.
export const teamSlugs = [
  "herren",
  "jugend",
  "schueler",
  "t-ball",
  "softball",
] as const;

export type TeamSlug = (typeof teamSlugs)[number];

export const teamNames: Record<TeamSlug, string> = {
  herren: "Herren",
  jugend: "Jugend",
  schueler: "Schüler",
  "t-ball": "T-Ball",
  softball: "Softball",
};

// Label shown on a post: the current team, or the name of a team that no longer exists
export const postTeamLabel = (data: { team?: TeamSlug; old_team?: string }) =>
  data.team ? teamNames[data.team] : data.old_team || undefined;

// Filters on Aktuelles: each team, then "Verein" for posts without any team
export const newsFilters = [
  ...teamSlugs.map((slug) => ({ slug, name: teamNames[slug] })),
  { slug: "verein", name: "Verein" },
];

export const matchesNewsFilter = (
  data: { team?: TeamSlug; old_team?: string },
  filter: string,
) => (filter === "verein" ? !data.team && !data.old_team : data.team === filter);
