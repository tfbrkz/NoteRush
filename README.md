# Piano Sight-Reading Trainer

Lightweight flashcard-style React app for learning to sight-read piano notes quickly.

## Tech

- React + TypeScript + Vite
- VexFlow for staff and note rendering
- Fully client-side (no backend)

## Features

- Single-note flashcard display on a staff
- Clef modes:
  - Treble only (`E4` to `F5`)
  - Bass only (`G2` to `A3`)
  - Mixed mode (random clef each card)
- Answer buttons: `A` through `G`
- Immediate feedback:
  - Correct: green
  - Incorrect: red + correct answer shown
- Fast loop: auto-advances to the next note after 1 second
- Score tracking:
  - Current streak
  - Total correct
  - Total incorrect
  - Total attempts

## Run locally

```bash
cd PianoSight
npm install
npm run dev
```

Then open the local URL shown by Vite (typically `http://localhost:5173`).

## Project structure

- `src/App.tsx` - app state, flashcard loop, scoring, modes
- `src/components/StaffDisplay.tsx` - VexFlow notation rendering
- `src/components/AnswerButtons.tsx` - A–G answer controls + visual feedback
- `src/components/ScoreTracker.tsx` - streak and score stats
- `src/lib/noteGenerator.ts` - random note generation logic
