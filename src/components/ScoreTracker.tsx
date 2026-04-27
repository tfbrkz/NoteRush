type ScoreTrackerProps = {
  streak: number;
  correct: number;
  incorrect: number;
};

export function ScoreTracker({ streak, correct, incorrect }: ScoreTrackerProps) {
  const total = correct + incorrect;

  return (
    <header className="score-panel">
      <div className="score-card">
        <span>Streak</span>
        <strong>{streak}</strong>
      </div>
      <div className="score-card">
        <span>Correct</span>
        <strong>{correct}</strong>
      </div>
      <div className="score-card">
        <span>Incorrect</span>
        <strong>{incorrect}</strong>
      </div>
      <div className="score-card">
        <span>Total</span>
        <strong>{total}</strong>
      </div>
    </header>
  );
}
