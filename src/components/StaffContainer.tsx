import { StaffDisplay } from "./StaffDisplay";
import type { GeneratedNote } from "../lib/noteGenerator";

type StaffContainerProps = {
  notes: GeneratedNote[];
  activeNoteIndex: number;
  feedbackMessage: string;
  feedbackClass: "neutral" | "success" | "error";
};

export function StaffContainer({ notes, activeNoteIndex, feedbackMessage, feedbackClass }: StaffContainerProps) {
  return (
    <section className="training-stack">
      <div className="note-focus">
        <StaffDisplay notes={notes} activeNoteIndex={activeNoteIndex} />
      </div>
      <p className={`feedback ${feedbackClass}`}>{feedbackMessage}</p>
    </section>
  );
}
