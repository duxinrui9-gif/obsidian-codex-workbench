export function obsidianOpenUri(vaultName: string, relativePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`;
}
