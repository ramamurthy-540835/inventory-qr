export const DEMO_TIMELINE = {
  open: 1350,
  fill: { rice: 500, chapati: 850, sambar: 1450, curd: 2050, curryOne: 2450, curryTwo: 2950, channa: 3550, appalam: 4450 },
  seal: 1800,
} as const;

export const DEMO_SEQUENCE_DURATION = 6250;
export const DEMO_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function reducedMotionTransform(reduced: boolean) { return reduced ? "none" : undefined; }
export function skipBeat(beat: "open" | "fill" | "seal") { return beat === "open" ? DEMO_TIMELINE.open : beat === "fill" ? DEMO_SEQUENCE_DURATION : DEMO_TIMELINE.seal; }
