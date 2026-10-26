export interface AnimationMeta { id: string; label: string; }

/** Parse the `animations` setting into a clean ordered list of ids. Accepts a
 *  JSON array of id strings, or a single / comma- / space-separated string.
 *  Anything else -> []. */
function normalizeIds(setting: unknown): string[] {
  const raw: string[] = Array.isArray(setting)
    ? setting.filter((x): x is string => typeof x === "string")
    : typeof setting === "string"
      ? setting.split(/[,\s]+/)
      : [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

/** Resolve the ordered, de-duplicated list of animations to display from the
 *  user's `animations` setting. Unknown ids are dropped; if nothing valid is
 *  configured, falls back to the full default list (all animations, default
 *  order). The FIRST entry of the returned list is shown on load. */
export function resolveAnimationList(setting: unknown, all: AnimationMeta[]): AnimationMeta[] {
  const seen = new Set<string>();
  const picked: AnimationMeta[] = [];
  for (const id of normalizeIds(setting)) {
    if (seen.has(id)) continue;
    const m = all.find((a) => a.id === id);
    if (m) { picked.push(m); seen.add(id); }
  }
  return picked.length > 0 ? picked : all;
}

/** One native button per animation in the (already resolved) list; all enabled
 *  so any can be tapped to switch. */
export function buildButtons(list: AnimationMeta[]): { id: string; title: string; enabled: boolean }[] {
  return list.map((m) => ({ id: m.id, title: m.label, enabled: true }));
}

/** Index to switch to when a button is clicked; unknown id -> keep current. */
export function indexForButton(list: AnimationMeta[], buttonID: string, current: number): number {
  const i = list.findIndex((m) => m.id === buttonID);
  return i >= 0 ? i : current;
}
