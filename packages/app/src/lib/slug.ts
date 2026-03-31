import { db } from "./db";
import { projects } from "./schema";
import { eq } from "drizzle-orm";

const adjectives = [
  "bold", "calm", "cool", "dark", "deep", "dry", "fair", "fast", "flat", "free",
  "glad", "gold", "good", "gray", "half", "hard", "high", "holy", "huge", "iron",
  "keen", "kind", "last", "late", "lazy", "lean", "left", "long", "lost", "loud",
  "main", "mild", "mint", "near", "neat", "next", "nice", "open", "pale", "past",
  "pink", "pure", "rare", "raw", "real", "red", "rich", "ripe", "safe", "slim",
  "slow", "snap", "soft", "sour", "tall", "tame", "thin", "tidy", "tiny", "true",
  "vast", "warm", "weak", "west", "wide", "wild", "wise", "young", "zen", "zany",
  "able", "aged", "airy", "blue", "bone", "busy", "cozy", "damp", "dear", "easy",
  "even", "fine", "firm", "full", "grim", "hazy", "icy", "jade", "just", "lush",
  "neon", "odd", "peak", "plum", "quick", "rosy", "ruby", "rust", "sage", "teal",
];

const nouns = [
  "arch", "acre", "band", "bark", "barn", "beam", "bell", "bird", "boat", "bolt",
  "bone", "book", "bush", "cape", "cave", "clay", "clip", "coal", "coat", "coin",
  "cone", "cork", "cove", "crow", "dawn", "deer", "dock", "dove", "drum", "duck",
  "dune", "dust", "fawn", "fern", "fish", "flag", "foam", "fold", "fork", "frog",
  "gate", "glen", "glow", "goal", "gust", "hare", "hawk", "heap", "herb", "hill",
  "hive", "hook", "horn", "isle", "jade", "jazz", "keel", "kelp", "kite", "knot",
  "lake", "lamp", "lark", "leaf", "lime", "lion", "lock", "loft", "lynx", "mane",
  "mars", "mask", "mesa", "mill", "mint", "mist", "moon", "moss", "nest", "node",
  "opal", "orca", "palm", "path", "peak", "pear", "pine", "plum", "pond", "quay",
  "rain", "reed", "reef", "ring", "road", "rock", "root", "rose", "ruby", "sage",
  "sand", "seal", "seed", "snow", "star", "stem", "swan", "tide", "tree", "vale",
  "veil", "vine", "wren", "yarn", "yew", "wolf", "wood", "zinc", "zone", "vale",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSlug(): string {
  return `${pick(adjectives)}-${pick(adjectives)}-${pick(nouns)}`;
}

export async function uniqueSlug(): Promise<string> {
  while (true) {
    const slug = generateSlug();
    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!existing) return slug;
  }
}
