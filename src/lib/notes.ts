export function noteIdFor(userId: string, tanggal: string): string {
  return `note-${userId}-${tanggal}`;
}