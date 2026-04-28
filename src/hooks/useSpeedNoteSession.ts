import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createNoteGenerator,
  DIFFICULTY_CONFIGS,
  midiToSharpLabel,
  noteLabelToMidi,
  type ClefMode,
  type DifficultyTier,
  type GeneratedNote,
  type NoteLetter,
  type PracticeMode
} from "../lib/noteGenerator";
import { playPianoNote, warmPianoSamples } from "../lib/pianoPlayer";

export type FeedbackState = {
  revealAnswer: boolean;
  lastGuess: NoteLetter | null;
  message: string;
};

export type SpeedNoteSessionState = {
  mode: ClefMode;
  difficulty: DifficultyTier;
  practiceMode: PracticeMode;
  notesPerSet: number;
  numberOfSets: number;
  gameRunning: boolean;
  completedSets: number;
  currentNotes: GeneratedNote[];
  currentNoteIndex: number;
  currentTargetNote: GeneratedNote;
  locked: boolean;
  streak: number;
  correct: number;
  incorrect: number;
  currentNoteElapsedMs: number;
  averageResponseMs: number;
  feedback: FeedbackState;
  feedbackClass: "neutral" | "success" | "error";
  roundEnded: boolean;
  leaderboardEligible: boolean;
  remainingSprintMs: number;
};

const DEFAULT_MODE: ClefMode = "treble";
const DEFAULT_DIFFICULTY: DifficultyTier = "beginner";
const DEFAULT_PRACTICE_MODE: PracticeMode = "classic";
const DEFAULT_NOTES_PER_SET = 4;
const DEFAULT_NUMBER_OF_SETS = 5;
const SPRINT_DURATION_MS = 60_000;

function isCorrectGuess(inputLabel: string, expectedLabel: string, exactPitch: boolean) {
  if (!exactPitch) {
    return inputLabel[0] === expectedLabel[0];
  }
  const inputMidi = noteLabelToMidi(inputLabel);
  const expectedMidi = noteLabelToMidi(expectedLabel);
  if (inputMidi === null || expectedMidi === null) {
    return inputLabel === expectedLabel;
  }
  return inputMidi === expectedMidi;
}

export function useSpeedNoteSession() {
  const [mode, setMode] = useState<ClefMode>(DEFAULT_MODE);
  const [difficulty, setDifficulty] = useState<DifficultyTier>(DEFAULT_DIFFICULTY);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(DEFAULT_PRACTICE_MODE);
  const [gameRunning, setGameRunning] = useState(false);
  const [numberOfSets, setNumberOfSets] = useState(DEFAULT_NUMBER_OF_SETS);
  const [completedSets, setCompletedSets] = useState(0);
  const [notesPerSet, setNotesPerSet] = useState(DEFAULT_NOTES_PER_SET);
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
  const [remainingSprintMs, setRemainingSprintMs] = useState(SPRINT_DURATION_MS);
  const [missCountByPitch, setMissCountByPitch] = useState<Map<string, number>>(new Map());
  const nextSetTimeoutRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    revealAnswer: false,
    lastGuess: null,
    message: "Press Start to begin."
  });

  const generator = useMemo(() => createNoteGenerator(DIFFICULTY_CONFIGS[difficulty]), [difficulty]);
  const initialSet = useMemo(
    () =>
      generator.generateNoteSet(DEFAULT_MODE, DEFAULT_NOTES_PER_SET, {
        missCountByPitch
      }),
    [generator, missCountByPitch]
  );
  const [currentNotes, setCurrentNotes] = useState<GeneratedNote[]>(initialSet);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  const clearQueuedNextSet = useCallback(() => {
    if (nextSetTimeoutRef.current !== null) {
      window.clearTimeout(nextSetTimeoutRef.current);
      nextSetTimeoutRef.current = null;
    }
  }, []);

  const nextNoteSet = useCallback(
    (nextMode: ClefMode, nextCount: number) => {
      clearQueuedNextSet();
      setCurrentNotes(
        generator.generateNoteSet(nextMode, nextCount, {
          missCountByPitch
        })
      );
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
    },
    [clearQueuedNextSet, generator, missCountByPitch]
  );

  const resetSessionState = useCallback(
    (message: string) => {
      clearQueuedNextSet();
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setRemainingSprintMs(SPRINT_DURATION_MS);
      setCurrentNotes(
        generator.generateNoteSet(mode, notesPerSet, {
          missCountByPitch
        })
      );
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message
      });
    },
    [clearQueuedNextSet, generator, missCountByPitch, mode, notesPerSet]
  );

  const start = useCallback(() => {
    if (completedSets >= numberOfSets) {
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setCompletedSets(0);
    }
    void warmPianoSamples();
    nextNoteSet(mode, notesPerSet);
    setRemainingSprintMs(SPRINT_DURATION_MS);
    setGameRunning(true);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, [completedSets, mode, nextNoteSet, notesPerSet, numberOfSets]);

  const stop = useCallback(() => {
    resetSessionState("Press Start to begin.");
  }, [resetSessionState]);

  const scheduleNextOrStop = useCallback(
    (nextCompletedSets: number) => {
      setCompletedSets(nextCompletedSets);
      const shouldStopBySets = nextCompletedSets >= numberOfSets;
      const shouldStopBySurvival = practiceMode === "survival" && incorrect >= 2;
      const shouldStopBySprint = practiceMode === "sprint" && remainingSprintMs <= 0;

      if (shouldStopBySets || shouldStopBySurvival || shouldStopBySprint) {
        setGameRunning(false);
        clearQueuedNextSet();
        return;
      }

      const delayMs = practiceMode === "sprint" ? 0 : 1000;
      nextSetTimeoutRef.current = window.setTimeout(() => {
        nextNoteSet(mode, notesPerSet);
      }, delayMs);
    },
    [clearQueuedNextSet, incorrect, mode, nextNoteSet, notesPerSet, numberOfSets, practiceMode, remainingSprintMs]
  );

  const currentTargetNote = currentNotes[currentNoteIndex] ?? currentNotes[0];

  const submitGuess = useCallback(
    (guessLabel: string, lastGuess: NoteLetter | null) => {
      if (locked || !gameRunning || !currentTargetNote) {
        return;
      }
      const exactPitch = DIFFICULTY_CONFIGS[difficulty].exactPitchMatch;
      const isCorrect = isCorrectGuess(guessLabel, currentTargetNote.label, exactPitch);

      if (!isCorrect) {
        const responseTimeMs = Date.now() - noteStartedAt;
        setLastResponseTimeMs(responseTimeMs);
        setLocked(true);
        setFeedback({
          revealAnswer: true,
          lastGuess,
          message: `Set failed. Expected ${currentTargetNote.label} for note ${currentNoteIndex + 1}.`
        });
        setIncorrect((value) => value + 1);
        setStreak(0);
        setPendingFailedTimeMs((value) => value + responseTimeMs);
        setMissCountByPitch((current) => {
          const next = new Map(current);
          next.set(currentTargetNote.label, (next.get(currentTargetNote.label) ?? 0) + 1);
          return next;
        });
        const nextCompletedSets = completedSets + 1;
        scheduleNextOrStop(nextCompletedSets);
        if (nextCompletedSets >= numberOfSets) {
          setFeedback({
            revealAnswer: true,
            lastGuess,
            message: `Set failed. Expected ${currentTargetNote.label}. Session complete (${nextCompletedSets}/${numberOfSets} sets).`
          });
        }
        return;
      }

      void playPianoNote(currentTargetNote.label).catch(() => {
        // Keep gameplay unblocked if audio playback fails.
      });

      const isLastInSet = currentNoteIndex === currentNotes.length - 1;
      if (!isLastInSet) {
        setCurrentNoteIndex((value) => value + 1);
        setFeedback({
          revealAnswer: false,
          lastGuess,
          message: `Good. Now identify note ${currentNoteIndex + 2} of ${currentNotes.length}.`
        });
        return;
      }

      const responseTimeMs = Date.now() - noteStartedAt;
      setLastResponseTimeMs(responseTimeMs);
      setLocked(true);
      setFeedback({
        revealAnswer: true,
        lastGuess,
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
          lastGuess,
          message: `Set complete! Session complete (${nextCompletedSets}/${numberOfSets} sets).`
        });
      }
    },
    [
      completedSets,
      currentNoteIndex,
      currentNotes.length,
      currentTargetNote,
      difficulty,
      gameRunning,
      locked,
      noteStartedAt,
      numberOfSets,
      pendingFailedTimeMs,
      scheduleNextOrStop
    ]
  );

  const handleAnswer = useCallback(
    (letter: NoteLetter) => {
      submitGuess(`${letter}4`, letter);
    },
    [submitGuess]
  );

  const handleMidiAnswer = useCallback(
    (midiNote: number) => {
      const midiLabel = midiToSharpLabel(midiNote);
      submitGuess(midiLabel, midiLabel[0] as NoteLetter);
    },
    [submitGuess]
  );

  const onModeChange = useCallback(
    (nextMode: ClefMode) => {
      setMode(nextMode);
      resetSessionState("Mode updated. Press Start to begin.");
    },
    [resetSessionState]
  );

  const onDifficultyChange = useCallback((nextDifficulty: DifficultyTier) => {
    setDifficulty(nextDifficulty);
    setMissCountByPitch(new Map());
  }, []);

  const onPracticeModeChange = useCallback((nextPracticeMode: PracticeMode) => {
    setPracticeMode(nextPracticeMode);
  }, []);

  const onNotesPerSetChange = useCallback(
    (count: number) => {
      setNotesPerSet(count);
      resetSessionState("Set size updated. Press Start to begin.");
    },
    [resetSessionState]
  );

  const onNumberOfSetsChange = useCallback(
    (count: number) => {
      setNumberOfSets(count);
      resetSessionState(`Number of sets updated to ${count}. Press Start to begin.`);
    },
    [resetSessionState]
  );

  useEffect(() => {
    if (locked || !gameRunning) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedNow(Date.now());
      if (practiceMode === "sprint") {
        setRemainingSprintMs((value) => {
          const next = Math.max(0, value - 100);
          if (next === 0 && gameRunning) {
            clearQueuedNextSet();
            setGameRunning(false);
            setFeedback({
              revealAnswer: true,
              lastGuess: null,
              message: "Sprint complete. Time is up."
            });
          }
          return next;
        });
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, [clearQueuedNextSet, gameRunning, locked, practiceMode]);

  useEffect(() => {
    return () => {
      clearQueuedNextSet();
    };
  }, [clearQueuedNextSet]);

  const currentNoteElapsedMs = useMemo(() => {
    const elapsed = locked ? lastResponseTimeMs : elapsedNow - noteStartedAt;
    return Math.max(0, elapsed);
  }, [elapsedNow, lastResponseTimeMs, locked, noteStartedAt]);

  const averageResponseMs = correctNotesSolved > 0 ? totalCorrectResponseTimeMs / correctNotesSolved : 0;
  const roundEnded = !gameRunning && completedSets >= numberOfSets;
  const leaderboardEligible = completedSets >= 5 && correct === completedSets;
  const feedbackClass: "neutral" | "success" | "error" = !feedback.revealAnswer
    ? "neutral"
    : feedback.lastGuess === currentTargetNote?.letter
      ? "success"
      : "error";

  return {
    state: {
      mode,
      difficulty,
      practiceMode,
      notesPerSet,
      numberOfSets,
      gameRunning,
      completedSets,
      currentNotes,
      currentNoteIndex,
      currentTargetNote,
      locked,
      streak,
      correct,
      incorrect,
      currentNoteElapsedMs,
      averageResponseMs,
      feedback,
      feedbackClass,
      roundEnded,
      leaderboardEligible,
      remainingSprintMs
    } satisfies SpeedNoteSessionState,
    actions: {
      start,
      stop,
      handleAnswer,
      handleMidiAnswer,
      onModeChange,
      onDifficultyChange,
      onPracticeModeChange,
      onNotesPerSetChange,
      onNumberOfSetsChange
    }
  };
}
