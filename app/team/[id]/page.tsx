import TeamPanel from "@/components/TeamPanel";

export const revalidate = 300;

export default function TeamPage({ params, searchParams }: { params: { id: string }; searchParams: { comp?: string } }) {
  return <TeamPanel teamId={params.id} comp={searchParams.comp ?? "all"} basePath={`/team/${params.id}`} />;
}
