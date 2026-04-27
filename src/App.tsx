import { useCallback, useMemo, useState } from "react";
import { AnswerButtons } from "./components/AnswerButtons";
import { ScoreTracker } from "./components/ScoreTracker";
import { StaffDisplay } from "./components/StaffDisplay";
import { generateNote, type ClefMode, type GeneratedNote, type NoteLetter } from "./lib/noteGenerator";

type FeedbackState = {
  revealAnswer: boolean;
  lastGuess: NoteLetter | null;
  message: string;
};

function App() {
  const [mode, setMode] = useState<ClefMode>("mixed");
  const [currentNote, setCurrentNote] = useState<GeneratedNote>(() => generateNote("mixed"));
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    revealAnswer: false,
    lastGuess: null,
    message: "Pick the letter name for this note."
  });

  const nextNote = useCallback((currentMode: ClefMode) => {
    setCurrentNote(generateNote(currentMode));
    setLocked(false);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, []);

  const onModeChange = useCallback(
    (nextMode: ClefMode) => {
      setMode(nextMode);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setLocked(false);
      setCurrentNote(generateNote(nextMode));
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Mode updated. Identify the new note."
      });
    },
    []
  );

  const handleAnswer = useCallback(
    (letter: NoteLetter) => {
      if (locked) {
        return;
      }

      const isCorrect = letter === currentNote.letter;
      setLocked(true);
      setFeedback({
        revealAnswer: true,
        lastGuess: letter,
        message: isCorrect
          ? `Correct! ${currentNote.label} is ${currentNote.letter}.`
          : `Not quite. ${currentNote.label} is ${currentNote.letter}.`
      });

      if (isCorrect) {
        setCorrect((value) => value + 1);
        setStreak((value) => value + 1);
      } else {
        setIncorrect((value) => value + 1);
        setStreak(0);
      }

      window.setTimeout(() => {
        nextNote(mode);
      }, 1000);
    },
    [currentNote, locked, mode, nextNote]
  );

  const feedbackClass = useMemo(() => {
    if (!feedback.revealAnswer) {
      return "neutral";
    }
    return feedback.lastGuess === currentNote.letter ? "success" : "error";
  }, [feedback, currentNote.letter]);

  return (
    <main className="app-shell">
      <h1>Piano Sight-Reading Trainer</h1>
      <ScoreTracker streak={streak} correct={correct} incorrect={incorrect} />

      <nav className="mode-row" aria-label="Clef mode">
        <button type="button" onClick={() => onModeChange("treble")} className={mode === "treble" ? "active" : ""}>
          Treble
        </button>
        <button type="button" onClick={() => onModeChange("bass")} className={mode === "bass" ? "active" : ""}>
          Bass
        </button>
        <button type="button" onClick={() => onModeChange("mixed")} className={mode === "mixed" ? "active" : ""}>
          Mixed
        </button>
      </nav>

      <section className="trainer-grid">
        <StaffDisplay note={currentNote} />
        <AnswerButtons
          disabled={locked}
          lastGuess={feedback.lastGuess}
          correctLetter={currentNote.letter}
          revealAnswer={feedback.revealAnswer}
          onAnswer={handleAnswer}
        />
      </section>

      <p className={`feedback ${feedbackClass}`}>{feedback.message}</p>
    </main>
  );
}

export default App;
