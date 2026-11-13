// Finding a structure by name in Explore. Every level's structures can be
// found, so "Skull" (Easy) and "Sphenoid bone" (Hard) both turn up.
import { entries, type Entry, type PartInfo } from './structures';

/** Every structure of every level, once by name, with every part it covers at any level. */
export function searchable(parts: readonly PartInfo[]): Entry[] {
  const byName = new Map<string, Entry>();
  for (const level of [1, 2, 3] as const) {
    for (const entry of entries(parts, level)) {
      const key = entry.system + ':' + entry.name;
      const known = byName.get(key);
      if (!known) byName.set(key, { ...entry, parts: [...entry.parts] });
      else for (const id of entry.parts) if (!known.parts.includes(id)) known.parts.push(id);
    }
  }
  return [...byName.values()];
}

const words = (text: string) => text.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean);

/**
 * The structures whose names match what was typed, best first: a name that
 * starts with it, then one with a word starting with each word typed, then
 * one that has it anywhere. "femur" finds "Thigh bone (femur)".
 */
export function search(list: readonly Entry[], query: string, limit = 8): Entry[] {
  const typed = words(query);
  if (!typed.length) return [];
  const joined = typed.join(' ');
  const ranked: [number, Entry][] = [];
  for (const entry of list) {
    const name = words(entry.name);
    const whole = name.join(' ');
    const rank = whole.startsWith(joined) ? 0
      : typed.every((t) => name.some((w) => w.startsWith(t))) ? 1
      : whole.includes(joined) ? 2
      : -1;
    if (rank >= 0) ranked.push([rank, entry]);
  }
  ranked.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length || a[1].name.localeCompare(b[1].name));
  return ranked.slice(0, limit).map(([, entry]) => entry);
}
