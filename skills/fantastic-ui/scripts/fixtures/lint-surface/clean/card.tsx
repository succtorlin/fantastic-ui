import "./styles.css";

type Props = { ticker: string; weight: number };

export function PositionCard({ ticker, weight }: Props) {
  const label = weight > 0.05 ? "Over the five percent limit" : "Within limits";
  return (
    <article className="grid grid-cols-2 gap-3 rounded-sm border border-[color:var(--hair)] text-[color:var(--ink)]">
      <h3 className="font-semibold tracking-tight">{ticker}</h3>
      <p className="text-[color:var(--muted)]">{label}</p>
      <button type="button" className="rounded-sm px-3 py-2 hover:opacity-90 disabled:opacity-50">Trim the position</button>
    </article>
  );
}
