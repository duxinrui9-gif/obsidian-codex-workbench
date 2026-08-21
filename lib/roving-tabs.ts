export function rovingTabIndex(currentIndex: number, key: string, count: number): number | null {
  if (!count) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return (currentIndex + count - 1) % count;
  if (key === "ArrowRight" || key === "ArrowDown") return (currentIndex + 1) % count;
  return null;
}
