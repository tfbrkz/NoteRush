import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerButtons } from "./components/AnswerButtons";
import { ScoreTracker } from "./components/ScoreTracker";
import { StaffDisplay } from "./components/StaffDisplay";
import { generateNote, type ClefMode, type GeneratedNote, type NoteLetter } from "./lib/noteGenerator";
import { playPianoNote } from "./lib/pianoPlayer";

type FeedbackState = {
  revealAnswer: boolean;
  lastGuess: NoteLetter | null;
  message: string;
};

const NOTES_PER_SET_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const DEFAULT_MODE: ClefMode = "treble";
const DEFAULT_NOTES_PER_SET = 4;
const DEFAULT_NUMBER_OF_SETS = 5;

function generateNoteSet(mode: ClefMode, notesPerSet: number): GeneratedNote[] {
  const firstNote = generateNote(mode);
  const notes: GeneratedNote[] = [firstNote];

  for (let index = 1; index < notesPerSet; index += 1) {
    notes.push(generateNote(firstNote.clef));
  }

  return notes;
}

function App() {
  const [mode, setMode] = useState<ClefMode>(DEFAULT_MODE);
  const [gameRunning, setGameRunning] = useState(false);
  const [numberOfSets, setNumberOfSets] = useState<number>(DEFAULT_NUMBER_OF_SETS);
  const [completedSets, setCompletedSets] = useState(0);
  const [notesPerSet, setNotesPerSet] = useState<number>(DEFAULT_NOTES_PER_SET);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentNotes, setCurrentNotes] = useState<GeneratedNote[]>(() =>
    generateNoteSet(DEFAULT_MODE, DEFAULT_NOTES_PER_SET)
  );
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [totalCorrectResponseTimeMs, setTotalCorrectResponseTimeMs] = useState(0);
  const [correctNotesSolved, setCorrectNotesSolved] = useState(0);
  const [pendingFailedTimeMs, setPendingFailedTimeMs] = useState(0);
  const [noteStartedAt, setNoteStartedAt] = useState(() => Date.now());
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [lastResponseTimeMs, setLastResponseTimeMs] = useState(0);
  const [locked, setLocked] = useState(false);
  const nextSetTimeoutRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    revealAnswer: false,
    lastGuess: null,
    message: "Press Start to begin."
  });

  const clearQueuedNextSet = useCallback(() => {
    if (nextSetTimeoutRef.current !== null) {
      window.clearTimeout(nextSetTimeoutRef.current);
      nextSetTimeoutRef.current = null;
    }
  }, []);

  const nextNoteSet = useCallback((currentMode: ClefMode, count: number) => {
    clearQueuedNextSet();
    setCurrentNotes(generateNoteSet(currentMode, count));
    setCurrentNoteIndex(0);
    setNoteStartedAt(Date.now());
    setElapsedNow(Date.now());
    setLastResponseTimeMs(0);
    setLocked(false);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, [clearQueuedNextSet]);

  const onModeChange = useCallback(
    (nextMode: ClefMode) => {
      clearQueuedNextSet();
      setMode(nextMode);
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setCurrentNotes(generateNoteSet(nextMode, notesPerSet));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Mode updated. Press Start to begin."
      });
    },
    [clearQueuedNextSet, notesPerSet]
  );

  const onNotesPerSetChange = useCallback(
    (count: number) => {
      clearQueuedNextSet();
      setNotesPerSet(count);
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setCurrentNotes(generateNoteSet(mode, count));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Set size updated. Press Start to begin."
      });
    },
    [clearQueuedNextSet, mode]
  );

  const onNumberOfSetsChange = useCallback(
    (count: number) => {
      clearQueuedNextSet();
      setNumberOfSets(count);
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setCurrentNotes(generateNoteSet(mode, notesPerSet));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: `Number of sets updated to ${count}. Press Start to begin.`
      });
    },
    [clearQueuedNextSet, mode, notesPerSet]
  );

  const scheduleNextOrStop = useCallback(
    (nextCompletedSets: number) => {
      setCompletedSets(nextCompletedSets);
      if (nextCompletedSets >= numberOfSets) {
        setGameRunning(false);
        clearQueuedNextSet();
        return;
      }

      nextSetTimeoutRef.current = window.setTimeout(() => {
        nextNoteSet(mode, notesPerSet);
      }, 1000);
    },
    [clearQueuedNextSet, mode, nextNoteSet, notesPerSet, numberOfSets]
  );

  const handleStartStop = useCallback(() => {
    if (gameRunning) {
      clearQueuedNextSet();
      setGameRunning(false);
      setFeedback((value) =>
        value.revealAnswer ? value : { ...value, message: "Paused. Press Start to resume." }
      );
      return;
    }

    if (completedSets >= numberOfSets) {
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setCompletedSets(0);
    }

    // Always start from a fresh set so users cannot pre-solve before pressing Start.
    nextNoteSet(mode, notesPerSet);
    setGameRunning(true);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, [
    completedSets,
    gameRunning,
    mode,
    nextNoteSet,
    notesPerSet,
    numberOfSets,
    clearQueuedNextSet
  ]);

  const handleAnswer = useCallback(
    (letter: NoteLetter) => {
      if (locked || !gameRunning) {
        return;
      }

      const targetNote = currentNotes[currentNoteIndex];
      const isCorrect = letter === targetNote.letter;

      if (!isCorrect) {
        const responseTimeMs = Date.now() - noteStartedAt;
        setLastResponseTimeMs(responseTimeMs);
        setLocked(true);
        setFeedback({
          revealAnswer: true,
          lastGuess: letter,
          message: `Set failed. Expected ${targetNote.letter} for note ${currentNoteIndex + 1}.`
        });
        setIncorrect((value) => value + 1);
        setStreak(0);
        setPendingFailedTimeMs((value) => value + responseTimeMs);
        const nextCompletedSets = completedSets + 1;
        scheduleNextOrStop(nextCompletedSets);
        if (nextCompletedSets >= numberOfSets) {
          setFeedback({
            revealAnswer: true,
            lastGuess: letter,
            message: `Set failed. Expected ${targetNote.letter}. Session complete (${nextCompletedSets}/${numberOfSets} sets).`
          });
        }
        return;
      }

      void playPianoNote(targetNote.label).catch(() => {
        // Ignore audio playback failures so quiz flow is never blocked.
      });

      const isLastInSet = currentNoteIndex === currentNotes.length - 1;
      if (!isLastInSet) {
        setCurrentNoteIndex((value) => value + 1);
        setFeedback({
          revealAnswer: false,
          lastGuess: letter,
          message: `Good. Now identify note ${currentNoteIndex + 2} of ${currentNotes.length}.`
        });
        return;
      }

      const responseTimeMs = Date.now() - noteStartedAt;
      setLastResponseTimeMs(responseTimeMs);
      setLocked(true);
      setFeedback({
        revealAnswer: true,
        lastGuess: letter,
        message: `Set complete! All ${currentNotes.length} notes were correct.`
      });
      setCorrect((value) => value + 1);
      setCorrectNotesSolved((value) => value + currentNotes.length);
      setStreak((value) => value + 1);
      setTotalCorrectResponseTimeMs((value) => value + pendingFailedTimeMs + responseTimeMs);
      setPendingFailedTimeMs(0);
      const nextCompletedSets = completedSets + 1;
      scheduleNextOrStop(nextCompletedSets);
      if (nextCompletedSets >= numberOfSets) {
        setFeedback({
          revealAnswer: true,
          lastGuess: letter,
          message: `Set complete! Session complete (${nextCompletedSets}/${numberOfSets} sets).`
        });
      }
    },
    [
      completedSets,
      currentNoteIndex,
      currentNotes,
      gameRunning,
      locked,
      noteStartedAt,
      numberOfSets,
      pendingFailedTimeMs,
      scheduleNextOrStop
    ]
  );

  useEffect(() => {
    if (locked || !gameRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameRunning, locked]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!gameRunning || locked) {
        return;
      }

      const letter = event.key.toUpperCase();
      if (!["A", "B", "C", "D", "E", "F", "G"].includes(letter)) {
        return;
      }

      handleAnswer(letter as NoteLetter);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameRunning, handleAnswer, locked]);

  useEffect(() => {
    return () => {
      clearQueuedNextSet();
    };
  }, [clearQueuedNextSet]);

  const currentTargetNote = currentNotes[currentNoteIndex];

  const feedbackClass = useMemo(() => {
    if (!feedback.revealAnswer) {
      return "neutral";
    }
    return feedback.lastGuess === currentTargetNote.letter ? "success" : "error";
  }, [currentTargetNote.letter, feedback]);

  const currentNoteElapsedMs = useMemo(() => {
    const elapsed = locked ? lastResponseTimeMs : elapsedNow - noteStartedAt;
    return Math.max(0, elapsed);
  }, [elapsedNow, lastResponseTimeMs, locked, noteStartedAt]);

  const averageResponseMs = correctNotesSolved > 0 ? totalCorrectResponseTimeMs / correctNotesSolved : 0;

  return (
    <main className="app-shell">
      <h1>Piano Sight-Reading Trainer</h1>
      <ScoreTracker
        streak={streak}
        correct={correct}
        incorrect={incorrect}
        currentNoteElapsedMs={currentNoteElapsedMs}
        averageResponseMs={averageResponseMs}
      />

      <div className="session-row">
        <button type="button" className="session-btn" onClick={handleStartStop}>
          {gameRunning ? "Stop" : "Start"}
        </button>
        <span>
          Sets: {completedSets}/{numberOfSets}
        </span>
      </div>

      <details className="settings-panel" open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
        <summary>Settings {settingsOpen ? "▼" : "▶"}</summary>

        <nav className="mode-row" aria-label="Clef mode">
          <button type="button" onClick={() => onModeChange("treble")} className={mode === "treble" ? "active" : ""} disabled={gameRunning}>
            Treble
          </button>
          <button type="button" onClick={() => onModeChange("bass")} className={mode === "bass" ? "active" : ""} disabled={gameRunning}>
            Bass
          </button>
          <button type="button" onClick={() => onModeChange("mixed")} className={mode === "mixed" ? "active" : ""} disabled={gameRunning}>
            Mixed
          </button>
        </nav>

        <div className="set-size-row" aria-label="Notes per set">
          <span>Notes per set</span>
          <select
            value={notesPerSet}
            onChange={(event) => onNotesPerSetChange(Number(event.target.value))}
            disabled={gameRunning}
          >
            {NOTES_PER_SET_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>

        <div className="set-size-row slider-row" aria-label="Number of sets">
          <span>Number of sets: {numberOfSets}</span>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={numberOfSets}
            onChange={(event) => onNumberOfSetsChange(Number(event.target.value))}
            disabled={gameRunning}
          />
        </div>
      </details>

      <section className="trainer-grid">
        <StaffDisplay notes={currentNotes} activeNoteIndex={currentNoteIndex} />
        <AnswerButtons
          disabled={locked || !gameRunning}
          lastGuess={feedback.lastGuess}
          correctLetter={currentTargetNote.letter}
          revealAnswer={feedback.revealAnswer}
          onAnswer={handleAnswer}
        />
      </section>

      <p className={`feedback ${feedbackClass}`}>{feedback.message}</p>
    </main>
  );
}

export default App;
