export type Comp = {
  slug: string;
  name: string;
  kind: "club" | "national";
  group: string;
};

// ESPN league slugs. Slugs that return nothing for a given day are skipped silently.
export const COMPS: Comp[] = [
  // Major club leagues
  { slug: "eng.1", name: "Premier League", kind: "club", group: "League" },
  { slug: "esp.1", name: "La Liga", kind: "club", group: "League" },
  { slug: "ita.1", name: "Serie A", kind: "club", group: "League" },
  { slug: "ger.1", name: "Bundesliga", kind: "club", group: "League" },
  { slug: "fra.1", name: "Ligue 1", kind: "club", group: "League" },
  { slug: "ned.1", name: "Eredivisie", kind: "club", group: "League" },
  { slug: "por.1", name: "Primeira Liga", kind: "club", group: "League" },
  { slug: "tur.1", name: "Super Lig", kind: "club", group: "League" },
  // European competitions
  { slug: "uefa.champions", name: "Champions League", kind: "club", group: "Europe" },
  { slug: "uefa.europa", name: "Europa League", kind: "club", group: "Europe" },
  { slug: "uefa.europa.conf", name: "Conference League", kind: "club", group: "Europe" },
  // Domestic cups
  { slug: "eng.fa", name: "FA Cup", kind: "club", group: "Cup" },
  { slug: "eng.league_cup", name: "EFL Cup", kind: "club", group: "Cup" },
  { slug: "esp.copa_del_rey", name: "Copa del Rey", kind: "club", group: "Cup" },
  { slug: "ger.dfb_pokal", name: "DFB-Pokal", kind: "club", group: "Cup" },
  { slug: "ita.coppa_italia", name: "Coppa Italia", kind: "club", group: "Cup" },
  { slug: "fra.coupe_de_france", name: "Coupe de France", kind: "club", group: "Cup" },
  // National teams
  { slug: "fifa.world", name: "World Cup", kind: "national", group: "National" },
  { slug: "fifa.worldq.uefa", name: "WC Qualifying (UEFA)", kind: "national", group: "National" },
  { slug: "fifa.worldq.conmebol", name: "WC Qualifying (CONMEBOL)", kind: "national", group: "National" },
  { slug: "fifa.worldq.concacaf", name: "WC Qualifying (CONCACAF)", kind: "national", group: "National" },
  { slug: "fifa.worldq.caf", name: "WC Qualifying (CAF)", kind: "national", group: "National" },
  { slug: "fifa.worldq.afc", name: "WC Qualifying (AFC)", kind: "national", group: "National" },
  { slug: "uefa.euro", name: "Euros", kind: "national", group: "National" },
  { slug: "uefa.euroq", name: "Euro Qualifying", kind: "national", group: "National" },
  { slug: "uefa.nations", name: "Nations League", kind: "national", group: "National" },
  { slug: "conmebol.america", name: "Copa America", kind: "national", group: "National" },
  { slug: "fifa.friendly", name: "International Friendly", kind: "national", group: "National" },
];

const pretty = (s: string) =>
  s
    .replace(/_qual$/, " (Qualifying)")
    .split(/[._]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const compName = (slug: string) =>
  COMPS.find((c) => c.slug === slug)?.name ?? pretty(slug);

export const isFriendly = (slug: string) => slug.includes("friendly");

export const isDomesticLeague = (slug: string) =>
  COMPS.find((c) => c.slug === slug)?.group === "League";

export const isNational = (slug: string) =>
  COMPS.find((c) => c.slug === slug)?.kind === "national";
