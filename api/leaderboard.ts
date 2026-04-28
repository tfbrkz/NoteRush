import { Profanity } from "@2toad/profanity";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

type ClefMode = "treble" | "bass" | "mixed";
type DifficultyTier = "beginner" | "intermediate" | "advanced";
type StoredMode = ClefMode | "unknown";

type LeaderboardEntry = {
  id: string;
  user: string;
  score: number;
  difficulty: DifficultyTier;
  mode: StoredMode;
  timestamp: number;
};

const profanity = new Profanity();
const MAX_ENTRIES = 10;
const NAME_MAX_LENGTH = 24;
const KV_KEY = "leaderboard:entries";

function isMode(value: unknown): value is ClefMode {
  return value === "treble" || value === "bass" || value === "mixed";
}

function isDifficulty(value: unknown): value is DifficultyTier {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function validateName(user: string) {
  const trimmed = user.trim();
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
  return [...entries]
    .sort((left, right) => {
      if (left.score === right.score) {
        return left.timestamp - right.timestamp;
      }
      return right.score - left.score;
    })
    .slice(0, MAX_ENTRIES);
}

async function getEntries() {
  const stored = await kv.get<LeaderboardEntry[]>(KV_KEY);
  if (!Array.isArray(stored)) {
    return [];
  }
  return sortLeaderboard(stored);
}

async function saveEntries(entries: LeaderboardEntry[]) {
  await kv.set(KV_KEY, sortLeaderboard(entries));
}

function toLegacyScore(totalCorrect: number, averageTimePerNoteMs: number) {
  if (!Number.isFinite(averageTimePerNoteMs) || averageTimePerNoteMs <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((totalCorrect / averageTimePerNoteMs) * 100000));
}

function parseEntryPayload(body: unknown): LeaderboardEntry | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const payload = body as Record<string, unknown>;
  const user = typeof payload.user === "string" ? payload.user : typeof payload.name === "string" ? payload.name : "";
  const nameError = validateName(user);
  if (nameError) {
    return null;
  }

  const mode: StoredMode = isMode(payload.mode) ? payload.mode : "unknown";
  const difficulty: DifficultyTier = isDifficulty(payload.difficulty) ? payload.difficulty : "beginner";

  let score = typeof payload.score === "number" ? payload.score : 0;
  if (!Number.isFinite(score) || score <= 0) {
    const totalCorrect = typeof payload.totalCorrect === "number" ? payload.totalCorrect : 0;
    const averageTimePerNoteMs = typeof payload.averageTimePerNoteMs === "number" ? payload.averageTimePerNoteMs : 0;
    score = toLegacyScore(totalCorrect, averageTimePerNoteMs);
  }

  if (!Number.isFinite(score) || score <= 0) {
    return null;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user: user.trim(),
    score,
    difficulty,
    mode,
    timestamp: Date.now()
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const entries = await getEntries();
    res.status(200).json({ entries });
    return;
  }

  if (req.method === "POST") {
    const entry = parseEntryPayload(req.body);
    if (!entry) {
      res.status(400).json({ error: "Invalid leaderboard payload." });
      return;
    }

    const entries = await getEntries();
    const nextEntries = sortLeaderboard([...entries, entry]);
    await saveEntries(nextEntries);
    res.status(201).json({ entry, entries: nextEntries });
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

    const entries = await getEntries();
    const nextEntries = entries.filter((entry) => entry.id !== id);
    if (nextEntries.length === entries.length) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    await saveEntries(nextEntries);
    res.status(200).json({ entries: nextEntries });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
