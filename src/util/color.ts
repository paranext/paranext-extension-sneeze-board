// Subset of .NET KnownColor names that appear in real Sneeze Board data.
// Add entries as fixtures uncover new names.
const NAMED: Record<string, string> = {
  sienna: '#A0522D',
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  goldenrod: '#DAA520',
};

export function normalizeColor(input: string): string {
  if (!input) return input;
  if (input.startsWith('#')) return `#${input.slice(1).toUpperCase()}`;
  const named = NAMED[input.toLowerCase()];
  return named ?? input;
}
