import { AnswerButtons } from "./AnswerButtons";
import type { ClefMode, DifficultyTier, NoteLetter, PracticeMode } from "../lib/noteGenerator";

const NOTES_PER_SET_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type InputControllerProps = {
  gameRunning: boolean;
  locked: boolean;
  lastGuess: NoteLetter | null;
  correctLetter: NoteLetter;
  revealAnswer: boolean;
  mode: ClefMode;
  difficulty: DifficultyTier;
  practiceMode: PracticeMode;
  notesPerSet: number;
  numberOfSets: number;
  settingsOpen: boolean;
  midiStatus: string;
  onAnswer: (letter: NoteLetter) => void;
  onModeChange: (mode: ClefMode) => void;
  onDifficultyChange: (difficulty: DifficultyTier) => void;
  onPracticeModeChange: (practiceMode: PracticeMode) => void;
  onNotesPerSetChange: (count: number) => void;
  onNumberOfSetsChange: (count: number) => void;
  onSettingsOpenChange: (open: boolean) => void;
};

export function InputController({
  gameRunning,
  locked,
  lastGuess,
  correctLetter,
  revealAnswer,
  mode,
  difficulty,
  practiceMode,
  notesPerSet,
  numberOfSets,
  settingsOpen,
  midiStatus,
  onAnswer,
  onModeChange,
  onDifficultyChange,
  onPracticeModeChange,
  onNotesPerSetChange,
  onNumberOfSetsChange,
  onSettingsOpenChange
}: InputControllerProps) {
  return (
    <>
      <AnswerButtons
        disabled={locked || !gameRunning}
        lastGuess={lastGuess}
        correctLetter={correctLetter}
        revealAnswer={revealAnswer}
        onAnswer={onAnswer}
      />

      <details className="settings-panel" open={settingsOpen} onToggle={(event) => onSettingsOpenChange(event.currentTarget.open)}>
        <summary>Training Settings {settingsOpen ? "▼" : "▶"}</summary>

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

        <div className="set-size-row" aria-label="Difficulty tier">
          <span>Difficulty</span>
          <select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as DifficultyTier)} disabled={gameRunning}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="set-size-row" aria-label="Practice mode">
          <span>Practice mode</span>
          <select value={practiceMode} onChange={(event) => onPracticeModeChange(event.target.value as PracticeMode)} disabled={gameRunning}>
            <option value="classic">Classic</option>
            <option value="sprint">Sprint</option>
            <option value="survival">Survival</option>
          </select>
        </div>

        <div className="set-size-row" aria-label="Notes per set">
          <span>Notes per set</span>
          <select value={notesPerSet} onChange={(event) => onNotesPerSetChange(Number(event.target.value))} disabled={gameRunning}>
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

        <p className="midi-status">MIDI: {midiStatus}</p>
      </details>
    </>
  );
}
