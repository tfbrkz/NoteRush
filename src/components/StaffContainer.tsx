import { StaffDisplay } from "./StaffDisplay";
import type { GeneratedNote } from "../lib/noteGenerator";
import type { NoteResultState } from "../hooks/useSpeedNoteSession";

type StaffContainerProps = {
  notes: GeneratedNote[];
  activeNoteIndex: number;
  feedbackMessage: string;
  feedbackClass: "neutral" | "success" | "error";
  showGrandStaff?: boolean;
  noteResults?: NoteResultState[];
  rhythmModeEnabled?: boolean;
  scanProgress?: number;
  scanWindowWidth?: number;
  countdownValue?: number | null;
};

export function StaffContainer({
  notes,
  activeNoteIndex,
  feedbackMessage,
  feedbackClass,
  showGrandStaff = false,
  noteResults = [],
  rhythmModeEnabled = false,
  scanProgress = 0,
  scanWindowWidth = 0.16,
  countdownValue = null
}: StaffContainerProps) {
  return (
    <>
      <div className="note-focus">
        <StaffDisplay
          notes={notes}
          activeNoteIndex={activeNoteIndex}
          showGrandStaff={showGrandStaff}
          noteResults={noteResults}
          rhythmModeEnabled={rhythmModeEnabled}
          scanProgress={scanProgress}
          scanWindowWidth={scanWindowWidth}
          countdownValue={countdownValue}
        />
      </div>
      <p className={`feedback ${feedbackClass}`}>{feedbackMessage}</p>
    </>
  );
}
