export function clampZoom(value: number) {
  return Math.max(25, Math.min(400, Math.round(value)));
}
export function wheelZoom(value: number, delta: number) {
  return clampZoom(value + (delta < 0 ? 10 : -10));
}
