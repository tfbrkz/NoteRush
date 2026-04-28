import { createContext, useContext } from "react";

export type MidiConnectionStatus = "unsupported" | "idle" | "requesting" | "connected" | "error";

export type MidiContextValue = {
  status: MidiConnectionStatus;
  errorMessage: string | null;
  subscribeNoteOn: (listener: (midiNote: number) => void) => () => void;
};

export const midiContext = createContext<MidiContextValue | null>(null);

export function useMidi() {
  const context = useContext(midiContext);
  if (!context) {
    throw new Error("useMidi must be used within MidiProvider.");
  }
  return context;
}
