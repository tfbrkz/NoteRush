type ScoreTrackerProps = {
  streak: number;
  correct: number;
  incorrect: number;
  currentNoteElapsedMs: number;
  averageResponseMs: number;
};

function formatMsAsSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ScoreTracker({
  streak,
  correct,
  incorrect,
  currentNoteElapsedMs,
  averageResponseMs
}: ScoreTrackerProps) {
  const total = correct + incorrect;
  const metrics = [
    { label: "Streak", value: streak, tone: "accent" },
    { label: "Correct", value: correct, tone: "success" },
    { label: "Incorrect", value: incorrect, tone: "danger" },
    { label: "Total", value: total, tone: "neutral" },
    { label: "Current timer", value: formatMsAsSeconds(currentNoteElapsedMs), tone: "neutral" },
    { label: "Average time / note", value: formatMsAsSeconds(averageResponseMs), tone: "neutral" }
  ] as const;

  return (
    <header className="score-panel">
      {metrics.map((metric) => (
        <div key={metric.label} className={`score-card ${metric.tone}`.trim()}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </header>
  );
}
