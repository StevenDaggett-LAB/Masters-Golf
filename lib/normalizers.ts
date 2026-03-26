export function normalizeFullName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
