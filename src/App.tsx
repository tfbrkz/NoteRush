import { useCallback, useEffect, useMemo, useState } from "react";
import { Profanity } from "@2toad/profanity";
import { InputController } from "./components/InputController";
import { StaffContainer } from "./components/StaffContainer";
import { StatDashboard } from "./components/StatDashboard";
import { useMidi } from "./providers/midiContext";
import { useSpeedNoteSession } from "./hooks/useSpeedNoteSession";
import { type ClefMode, type DifficultyTier, type NoteLetter } from "./lib/noteGenerator";

const LEADERBOARD_MAX_ENTRIES = 10;
const LEADERBOARD_NAME_MAX_LENGTH = 24;
const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const ADSENSE_LEFT_SLOT_ID = import.meta.env.VITE_ADSENSE_LEFT_SLOT_ID as string | undefined;
const ADSENSE_RIGHT_SLOT_ID = import.meta.env.VITE_ADSENSE_RIGHT_SLOT_ID as string | undefined;

type AdRailProps = {
  slotId?: string;
  label: string;
};

function AdRail({ slotId, label }: AdRailProps) {
  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId) {
      return;
    }

    try {
      const ads = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle ?? [];
      ads.push({});
      (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = ads;
    } catch {
      // Ad blockers and script-loading failures are non-fatal.
    }
  }, [slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) {
    return (
      <aside className="ad-rail ad-placeholder" aria-label={`${label} ad space`}>
        <span>{label} ad space</span>
      </aside>
    );
  }

  return (
    <aside className="ad-rail" aria-label={`${label} advertisement`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "160px", height: "600px" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="false"
      />
    </aside>
  );
}

const profanity = new Profanity();

function validateLeaderboardName(rawName: string) {
  const name = rawName.trim();
  if (!name) {
    return "Please enter a name.";
  }

  if (name.length > LEADERBOARD_NAME_MAX_LENGTH) {
    return `Name must be ${LEADERBOARD_NAME_MAX_LENGTH} characters or less.`;
  }

  const hasUrlPattern =
    /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|gg|app|dev|me|tv|xyz|uk|us|ca|de|fr|jp|au|nl|ru|ch|it|es|in)\b)/i.test(
      name
    );
  if (hasUrlPattern) {
    return "Names cannot contain links or website addresses.";
  }

  if (profanity.exists(name)) {
    return "Please choose a cleaner name.";
  }

  return null;
}

type LeaderboardEntry = {
  id: string;
  user: string;
  score: number;
  difficulty: DifficultyTier;
  mode: ClefMode | "unknown";
  timestamp: number;
};

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { status: midiStatus, errorMessage: midiErrorMessage, subscribeNoteOn } = useMidi();
  const { state, actions } = useSpeedNoteSession();
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardModeFilter, setLeaderboardModeFilter] = useState<ClefMode | "all">("all");
  const [leaderboardName, setLeaderboardName] = useState("");
  const [leaderboardNameError, setLeaderboardNameError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [leaderboardApiError, setLeaderboardApiError] = useState<string | null>(null);
  const [hasSubmittedRound, setHasSubmittedRound] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!state.gameRunning || state.locked) {
        return;
      }

      const letter = event.key.toUpperCase();
      if (!["A", "B", "C", "D", "E", "F", "G"].includes(letter)) {
        return;
      }

      actions.handleAnswer(letter as NoteLetter);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actions, state.gameRunning, state.locked]);

  useEffect(() => {
    return subscribeNoteOn((noteNumber) => {
      if (!state.gameRunning || state.locked) {
        return;
      }
      actions.handleMidiAnswer(noteNumber);
    });
  }, [actions, state.gameRunning, state.locked, subscribeNoteOn]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard");
        }
        const data = (await response.json()) as { entries?: LeaderboardEntry[] };
        if (cancelled) {
          return;
        }
        setLeaderboardEntries(Array.isArray(data.entries) ? data.entries : []);
        setLeaderboardApiError(null);
      } catch {
        if (!cancelled) {
          setLeaderboardApiError("Leaderboard service unavailable.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedLeaderboard = useMemo(
    () =>
      [...leaderboardEntries]
        .sort((left, right) => {
          if (left.score === right.score) {
            return left.timestamp - right.timestamp;
          }
          return right.score - left.score;
        })
        .slice(0, LEADERBOARD_MAX_ENTRIES),
    [leaderboardEntries]
  );
  const filteredLeaderboard = useMemo(
    () =>
      sortedLeaderboard.filter((entry) => leaderboardModeFilter === "all" || entry.mode === leaderboardModeFilter),
    [leaderboardModeFilter, sortedLeaderboard]
  );

  const handleStartStop = useCallback(() => {
    if (state.gameRunning) {
      actions.stop();
      setHasSubmittedRound(false);
      setLeaderboardName("");
      setLeaderboardNameError(null);
      return;
    }
    actions.start();
  }, [actions, state.gameRunning]);

  const leaderboardScore = useMemo(() => {
    if (state.averageResponseMs <= 0) {
      return 0;
    }
    return Math.max(1, Math.round((state.correct / state.averageResponseMs) * 100000));
  }, [state.averageResponseMs, state.correct]);

  const handleLeaderboardSubmit = useCallback(() => {
    const trimmedName = leaderboardName.trim();
    if (!trimmedName || !state.roundEnded || hasSubmittedRound || !state.leaderboardEligible) {
      return;
    }

    const validationError = validateLeaderboardName(trimmedName);
    if (validationError) {
      setLeaderboardNameError(validationError);
      return;
    }

    const entry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user: trimmedName,
      score: leaderboardScore,
      difficulty: state.difficulty,
      mode: state.mode,
      timestamp: Date.now()
    };

    void (async () => {
      try {
        const response = await fetch("/api/leaderboard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(entry)
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          setLeaderboardNameError(errorPayload?.error ?? "Failed to submit score.");
          return;
        }

        const payload = (await response.json()) as { entries?: LeaderboardEntry[] };
        setLeaderboardEntries(Array.isArray(payload.entries) ? payload.entries : []);
        setHasSubmittedRound(true);
        setLeaderboardNameError(null);
        setLeaderboardApiError(null);
      } catch {
        setLeaderboardNameError("Failed to submit score.");
      }
    })();
  }, [hasSubmittedRound, leaderboardName, leaderboardScore, state.difficulty, state.leaderboardEligible, state.mode, state.roundEnded]);

  const handleAdminDelete = useCallback(
    async (entryId: string) => {
      if (!adminKey.trim()) {
        setLeaderboardApiError("Enter admin key to delete entries.");
        return;
      }

      try {
        const response = await fetch(`/api/leaderboard?id=${encodeURIComponent(entryId)}`, {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey.trim()
          }
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          setLeaderboardApiError(errorPayload?.error ?? "Failed to delete entry.");
          return;
        }

        const payload = (await response.json()) as { entries?: LeaderboardEntry[] };
        setLeaderboardEntries(Array.isArray(payload.entries) ? payload.entries : []);
        setLeaderboardApiError(null);
      } catch {
        setLeaderboardApiError("Failed to delete entry.");
      }
    },
    [adminKey]
  );

  return (
    <main className="page-layout">
      <AdRail label="Left" slotId={ADSENSE_LEFT_SLOT_ID} />
      <section className="app-shell">
        <StatDashboard
          streak={state.streak}
          correct={state.correct}
          incorrect={state.incorrect}
          currentNoteElapsedMs={state.currentNoteElapsedMs}
          averageResponseMs={state.averageResponseMs}
          gameRunning={state.gameRunning}
          completedSets={state.completedSets}
          numberOfSets={state.numberOfSets}
          onStartStop={handleStartStop}
        />

        <StaffContainer
          notes={state.currentNotes}
          activeNoteIndex={state.currentNoteIndex}
          feedbackMessage={state.feedback.message}
          feedbackClass={state.feedbackClass}
        />

        <div className="app-lower-grid">
          <section className="control-stack">
            <InputController
              gameRunning={state.gameRunning}
              locked={state.locked}
              lastGuess={state.feedback.lastGuess}
              correctLetter={state.currentTargetNote.letter}
              revealAnswer={state.feedback.revealAnswer}
              mode={state.mode}
              difficulty={state.difficulty}
              practiceMode={state.practiceMode}
              notesPerSet={state.notesPerSet}
              numberOfSets={state.numberOfSets}
              settingsOpen={settingsOpen}
              midiStatus={midiErrorMessage ? `error (${midiErrorMessage})` : midiStatus}
              onAnswer={actions.handleAnswer}
              onModeChange={actions.onModeChange}
              onDifficultyChange={actions.onDifficultyChange}
              onPracticeModeChange={actions.onPracticeModeChange}
              onNotesPerSetChange={actions.onNotesPerSetChange}
              onNumberOfSetsChange={actions.onNumberOfSetsChange}
              onSettingsOpenChange={setSettingsOpen}
            />
          </section>
          <section className="control-stack">
            {state.roundEnded && (
              <section className="leaderboard-submit">
                <h3>Round Complete</h3>
                <p>
                  {state.leaderboardEligible
                    ? "Submit this score to the leaderboard."
                    : "Leaderboard requires at least 5 sets and a perfect run (correct sets must equal total sets)."}
                </p>
                <div className="leaderboard-submit-row">
                  <input
                    type="text"
                    value={leaderboardName}
                    onChange={(event) => {
                      setLeaderboardName(event.target.value);
                      if (leaderboardNameError) {
                        setLeaderboardNameError(null);
                      }
                    }}
                    placeholder="Enter name"
                    maxLength={LEADERBOARD_NAME_MAX_LENGTH}
                    disabled={hasSubmittedRound || !state.leaderboardEligible}
                  />
                  <button
                    type="button"
                    onClick={handleLeaderboardSubmit}
                    disabled={hasSubmittedRound || !state.leaderboardEligible || !leaderboardName.trim()}
                  >
                    {hasSubmittedRound ? "Submitted" : "Submit"}
                  </button>
                </div>
                {leaderboardNameError && <p className="leaderboard-error">{leaderboardNameError}</p>}
              </section>
            )}
            <section className="leaderboard-panel" aria-label="Leaderboard">
              <div className="leaderboard-header-row">
                <h3>Leaderboard</h3>
                <label className="leaderboard-filter">
                  <span>Mode</span>
                  <select
                    value={leaderboardModeFilter}
                    onChange={(event) => setLeaderboardModeFilter(event.target.value as ClefMode | "all")}
                  >
                    <option value="all">All</option>
                    <option value="treble">Treble</option>
                    <option value="bass">Bass</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
              </div>
              <div className="leaderboard-admin-row">
                <input
                  type="password"
                  value={adminKey}
                  onChange={(event) => setAdminKey(event.target.value)}
                  placeholder="Admin key for deletes"
                />
              </div>
              {leaderboardApiError && <p className="leaderboard-error">{leaderboardApiError}</p>}
              {filteredLeaderboard.length === 0 ? (
                <p className="leaderboard-empty">No scores submitted yet.</p>
              ) : (
                <div className="leaderboard-table">
                  <div className="leaderboard-row leaderboard-header">
                    <span>User</span>
                    <span>Mode</span>
                    <span>Difficulty</span>
                    <span>Score</span>
                    <span>Timestamp</span>
                    <span>Admin</span>
                  </div>
                  {filteredLeaderboard.map((entry) => (
                    <div key={entry.id} className="leaderboard-row">
                      <span>{entry.user}</span>
                      <span>{entry.mode === "unknown" ? "-" : entry.mode}</span>
                      <span>{entry.difficulty}</span>
                      <span>{entry.score}</span>
                      <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                      <span>
                        <button
                          type="button"
                          className="leaderboard-delete-btn"
                          onClick={() => void handleAdminDelete(entry.id)}
                          disabled={!adminKey.trim()}
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
      </section>
      <AdRail label="Right" slotId={ADSENSE_RIGHT_SLOT_ID} />
      <footer className="site-footer">Copyright &copy; 2026 SpeedNote Piano</footer>
    </main>
  );
}

export default App;
