export function formatRelativeToPar(score: number) {
  if (!Number.isFinite(score) || score === 0) {
    return 'E';
  }

  return score > 0 ? `+${score}` : `${score}`;
}
