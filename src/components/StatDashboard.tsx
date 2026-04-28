import { ScoreTracker } from "./ScoreTracker";

type StatDashboardProps = {
  streak: number;
  correct: number;
  incorrect: number;
  currentNoteElapsedMs: number;
  averageResponseMs: number;
  gameRunning: boolean;
  completedSets: number;
  numberOfSets: number;
  onStartStop: () => void;
};

export function StatDashboard({
  streak,
  correct,
  incorrect,
  currentNoteElapsedMs,
  averageResponseMs,
  gameRunning,
  completedSets,
  numberOfSets,
  onStartStop
}: StatDashboardProps) {
  return (
    <>
      <header className="app-topbar">
        <div className="app-heading">
          <p className="app-kicker">SpeedNote</p>
          <h1>Learn to read sheet music at speed</h1>
        </div>
        <div className="session-row">
          <button type="button" className="session-btn" onClick={onStartStop}>
            {gameRunning ? "Stop Session" : "Start Session"}
          </button>
          <span>
            Sets: {completedSets}/{numberOfSets}
          </span>
        </div>
      </header>

      <ScoreTracker
        streak={streak}
        correct={correct}
        incorrect={incorrect}
        currentNoteElapsedMs={currentNoteElapsedMs}
        averageResponseMs={averageResponseMs}
      />
    </>
  );
}
