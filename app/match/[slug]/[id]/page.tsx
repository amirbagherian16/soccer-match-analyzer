import Link from "next/link";
import TeamPanel from "@/components/TeamPanel";
import PredictionPanel from "@/components/PredictionPanel";
import { getSummary } from "@/lib/espn";
import { compName } from "@/lib/leagues";
import { chicagoLabel } from "@/lib/time";

export const revalidate = 60;

export default async function MatchPage({ params, searchParams }: { params: { slug: string; id: string }; searchParams: { comp?: string } }) {
  const sum = await getSummary(params.slug, params.id);
  const comp = searchParams.comp ?? params.slug;
  const c = sum?.header?.competitions?.[0];
  const home = c?.competitors?.find((x: { homeAway: string }) => x.homeAway === "home");
  const away = c?.competitors?.find((x: { homeAway: string }) => x.homeAway === "away");
  if (!home || !away) return <div className="card">Match not found. <Link href="/">Back</Link></div>;
  const base = `/match/${params.slug}/${params.id}`;

  return (
    <>
      <div className="card">
        <div className="mut">{compName(params.slug)} · {chicagoLabel(c.date)} · {c.status?.type?.detail}</div>
        <h1>{home.team.displayName} {c.status?.type?.state === "pre" ? "vs" : `${home.score}-${away.score}`} {away.team.displayName}</h1>
        <div className="note">Click a club name for its full page. Use the chips to switch between this tournament and all tournaments.</div>
      </div>
      <PredictionPanel
        matchId={params.id}
        comp={compName(params.slug)}
        homeLogo={home.team.logo ?? home.team.logos?.[0]?.href}
        awayLogo={away.team.logo ?? away.team.logos?.[0]?.href}
        slug={params.slug}
        date={c.date}
        homeId={String(home.team.id)}
        homeName={home.team.displayName}
        awayId={String(away.team.id)}
        awayName={away.team.displayName}
        finished={c.status?.type?.completed === true}
      />
      <div className="grid2">
        <TeamPanel teamId={String(home.team.id)} comp={comp} basePath={base} />
        <TeamPanel teamId={String(away.team.id)} comp={comp} basePath={base} />
      </div>
    </>
  );
}
