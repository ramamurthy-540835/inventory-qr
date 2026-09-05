export function LeafArt({ sealed = false }: { sealed?: boolean }) {
  return <svg className="demo-leaf-art" viewBox="0 0 620 330" role="img" aria-label="Banana leaf" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="leafTone" x1="0" x2="1"><stop offset="0" stopColor="var(--lb-leaf)" /><stop offset=".5" stopColor="var(--lb-leaf-wash)" /><stop offset="1" stopColor="var(--lb-leaf)" /></linearGradient></defs>
    <path className="leaf-body" fill="url(#leafTone)" d="M28 171C97 51 242 20 584 46c-45 171-222 259-556 239-21-2-22-82 0-114Z" />
    <path className="leaf-mid" d="M40 238C190 179 355 125 579 48" fill="none" stroke="var(--lb-leaf-deep)" strokeWidth="9" strokeLinecap="round" />
    <g className="leaf-veins" fill="none" stroke="var(--lb-leaf)" strokeWidth="4" strokeLinecap="round"><path d="M145 196 94 100" /><path d="M190 179 164 72" /><path d="M243 160 239 53" /><path d="M300 143 315 45" /><path d="M359 124 394 46" /><path d="M420 104 470 53" /><path d="M181 184 102 254" /><path d="M247 160 180 272" /><path d="M314 141 281 284" /><path d="M380 119 383 272" /><path d="M448 95 489 231" /></g>
    <path className="leaf-split" d="m103 246 34 13m-9-22 23 22" stroke="var(--lb-leaf-deep)" strokeWidth="3" />
    {sealed && <path className="leaf-fold" d="M52 185C185 145 330 106 555 57" fill="none" stroke="var(--lb-turmeric)" strokeWidth="6" strokeDasharray="11 12" />}
  </svg>;
}
