import { useEffect, useRef, useState, type ReactNode } from "react";
import { midiContext, type MidiConnectionStatus } from "./midiContext";

const SUPPORTS_MIDI = typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";

type MidiProviderProps = {
  children: ReactNode;
};

export function MidiProvider({ children }: MidiProviderProps) {
  const [status, setStatus] = useState<MidiConnectionStatus>(SUPPORTS_MIDI ? "requesting" : "unsupported");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const listenersRef = useRef(new Set<(midiNote: number) => void>());
  const inputRefs = useRef<MIDIInput[]>([]);

  useEffect(() => {
    if (!SUPPORTS_MIDI || !navigator.requestMIDIAccess) {
      return;
    }

    void navigator
      .requestMIDIAccess()
      .then((access: MIDIAccess) => {
        const handleMessage = (event: MIDIMessageEvent) => {
          if (!event.data) {
            return;
          }
          const [statusByte, note, velocity] = event.data;
          const isNoteOn = (statusByte & 0xf0) === 0x90 && velocity > 0;
          if (!isNoteOn) {
            return;
          }
          listenersRef.current.forEach((listener) => listener(note));
        };

        const attachInputs = () => {
          inputRefs.current.forEach((input) => {
            input.onmidimessage = null;
          });
          inputRefs.current = [];
          access.inputs.forEach((input) => {
            input.onmidimessage = handleMessage;
            inputRefs.current.push(input);
          });
          setStatus(inputRefs.current.length > 0 ? "connected" : "idle");
        };

        attachInputs();
        access.onstatechange = attachInputs;
      })
      .catch((error: unknown) => {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "MIDI access failed.");
      });

    return () => {
      inputRefs.current.forEach((input) => {
        input.onmidimessage = null;
      });
      inputRefs.current = [];
    };
  }, []);

  return (
    <midiContext.Provider
      value={{
        status,
        errorMessage,
        subscribeNoteOn: (listener) => {
          listenersRef.current.add(listener);
          return () => {
            listenersRef.current.delete(listener);
          };
        }
      }}
    >
      {children}
    </midiContext.Provider>
  );
}
