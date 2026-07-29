const NS = 'brics';

export function readCollection<T>(key: string): T[] {
  const raw = localStorage.getItem(`${NS}:${key}`);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

export function writeCollection<T>(key: string, items: T[]): void {
  localStorage.setItem(`${NS}:${key}`, JSON.stringify(items));
}
