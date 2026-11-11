import PredictionsTable from "@/components/PredictionsTable";
import type { Entry } from "@/lib/score";
import data from "@/data/predictions.json";

export const metadata = { title: "Predictions · Soccer Match Analyzer" };

export default function PredictionsPage() {
  const entries = data as unknown as Entry[];
  return (
    <>
      <h1>Predictions tracker</h1>
      <div className="note" style={{ marginBottom: 12 }}>
        The model locks an exact-score pick the day before each match (daily job). You can add your own pick on any match page until kick-off.
        After the match, both are compared with the real score and result.
      </div>
      <PredictionsTable entries={entries} />
    </>
  );
}
