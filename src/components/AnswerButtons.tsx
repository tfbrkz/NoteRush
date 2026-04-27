import type { NoteLetter } from "../lib/noteGenerator";

type AnswerButtonsProps = {
  disabled: boolean;
  lastGuess: NoteLetter | null;
  correctLetter: NoteLetter;
  revealAnswer: boolean;
  onAnswer: (letter: NoteLetter) => void;
};

const LETTERS: NoteLetter[] = ["A", "B", "C", "D", "E", "F", "G"];

export function AnswerButtons({
  disabled,
  lastGuess,
  correctLetter,
  revealAnswer,
  onAnswer
}: AnswerButtonsProps) {
  return (
    <section className="answers-panel" aria-label="Answer buttons">
      {LETTERS.map((letter) => {
        const guessedThis = revealAnswer && lastGuess === letter;
        const isCorrect = revealAnswer && letter === correctLetter;
        const className = guessedThis ? (isCorrect ? "correct" : "wrong") : isCorrect ? "correct" : "";

        return (
          <button
            key={letter}
            type="button"
            onClick={() => onAnswer(letter)}
            disabled={disabled}
            className={`answer-btn ${className}`.trim()}
          >
            {letter}
          </button>
        );
      })}
    </section>
  );
}
