import { Profanity } from "@2toad/profanity";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type ClefMode = "treble" | "bass" | "mixed";
type StoredMode = ClefMode | "unknown";

type LeaderboardEntry = {
  id: string;
  name: string;
  mode: StoredMode;
  totalSets: number;
  totalCorrect: number;
  averageTimePerNoteMs: number;
  createdAtMs: number;
};

const profanity = new Profanity();
const MAX_ENTRIES = 10;
const NAME_MAX_LENGTH = 24;

const inMemoryStore: {
  entries: LeaderboardEntry[];
} = {
  entries: []
};

function isMode(value: unknown): value is ClefMode {
  return value === "treble" || value === "bass" || value === "mixed";
}

function validateName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Please enter a name.";
  }

  if (trimmed.length > NAME_MAX_LENGTH) {
    return `Name must be ${NAME_MAX_LENGTH} characters or less.`;
  }

  const hasUrlPattern =
    /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|gg|app|dev|me|tv|xyz|uk|us|ca|de|fr|jp|au|nl|ru|ch|it|es|in)\b)/i.test(
      trimmed
    );
  if (hasUrlPattern) {
    return "Names cannot contain links or website addresses.";
  }

  if (profanity.exists(trimmed)) {
    return "Please choose a cleaner name.";
  }

  return null;
}

function sortLeaderboard(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.averageTimePerNoteMs === right.averageTimePerNoteMs) {
      return left.createdAtMs - right.createdAtMs;
    }
    return left.averageTimePerNoteMs - right.averageTimePerNoteMs;
  });
}

function getEntries() {
  return sortLeaderboard(inMemoryStore.entries).slice(0, MAX_ENTRIES);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    res.status(200).json({ entries: getEntries() });
    return;
  }

  if (req.method === "POST") {
    const body = req.body as Partial<LeaderboardEntry>;
    const name = typeof body?.name === "string" ? body.name : "";
    const mode: StoredMode = isMode(body?.mode) ? body.mode : "unknown";
    const totalSets = typeof body?.totalSets === "number" ? body.totalSets : 0;
    const totalCorrect = typeof body?.totalCorrect === "number" ? body.totalCorrect : 0;
    const averageTimePerNoteMs = typeof body?.averageTimePerNoteMs === "number" ? body.averageTimePerNoteMs : 0;

    const nameError = validateName(name);
    if (nameError) {
      res.status(400).json({ error: nameError });
      return;
    }

    if (totalSets < 5 || totalCorrect !== totalSets) {
      res.status(400).json({ error: "Leaderboard requires at least 5 sets and a perfect run." });
      return;
    }

    if (!Number.isFinite(averageTimePerNoteMs) || averageTimePerNoteMs <= 0) {
      res.status(400).json({ error: "Average time is invalid." });
      return;
    }

    const entry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      mode,
      totalSets,
      totalCorrect,
      averageTimePerNoteMs,
      createdAtMs: Date.now()
    };

    inMemoryStore.entries = sortLeaderboard([...inMemoryStore.entries, entry]).slice(0, MAX_ENTRIES);
    res.status(201).json({ entry, entries: inMemoryStore.entries });
    return;
  }

  if (req.method === "DELETE") {
    const adminKey = req.headers["x-admin-key"];
    const expected = process.env.LEADERBOARD_ADMIN_KEY;
    if (!expected || adminKey !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (!id) {
      res.status(400).json({ error: "Missing entry id" });
      return;
    }

    const previousLength = inMemoryStore.entries.length;
    inMemoryStore.entries = inMemoryStore.entries.filter((entry) => entry.id !== id);
    if (inMemoryStore.entries.length === previousLength) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    res.status(200).json({ entries: getEntries() });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
