import { useEffect, useRef } from "react";
import { Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import type { Clef, GeneratedNote } from "../lib/noteGenerator";

type StaffDisplayProps = {
  note: GeneratedNote;
};

function renderClefLabel(clef: Clef) {
  return clef === "treble" ? "Treble Clef" : "Bass Clef";
}

export function StaffDisplay({ note }: StaffDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const width = 460;
    const height = 210;
    const container = containerRef.current;
    container.innerHTML = "";

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);

    const context = renderer.getContext();
    context.setFont("Arial", 10);

    const stave = new Stave(20, 40, width - 40);
    stave.addClef(note.clef);
    stave.setContext(context);
    stave.draw();

    const staveNote = new StaveNote({
      clef: note.clef,
      keys: [note.key],
      duration: "q"
    });

    const voice = new Voice({ numBeats: 1, beatValue: 4 });
    voice.addTickables([staveNote]);

    new Formatter().joinVoices([voice]).format([voice], width - 120);
    voice.draw(context, stave);
  }, [note]);

  return (
    <section className="staff-panel" aria-live="polite">
      <div className="staff-header">
        <h2>Identify this note</h2>
        <p>{renderClefLabel(note.clef)}</p>
      </div>
      <div ref={containerRef} className="staff-canvas" aria-label={`Note on ${renderClefLabel(note.clef)}`} />
    </section>
  );
}
