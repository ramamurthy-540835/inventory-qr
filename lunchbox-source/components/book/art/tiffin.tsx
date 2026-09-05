export function TiffinArt({ open = false, sealed = false }: { open?: boolean; sealed?: boolean }) {
  return <svg className={`demo-tiffin-art ${open ? "is-open" : ""} ${sealed ? "is-sealed" : ""}`} viewBox="0 0 520 430" role="img" aria-label="Steel tiffin box">
    <defs><linearGradient id="steel" x1="0" x2="1"><stop offset="0" stopColor="var(--lb-ink)" /><stop offset=".32" stopColor="var(--lb-paper)" /><stop offset=".6" stopColor="var(--lb-leaf-deep)" /><stop offset=".9" stopColor="var(--lb-paper)" /><stop offset="1" stopColor="var(--lb-ink)" /></linearGradient></defs>
    <g className="tiffin-lid"><path d="M92 146Q260 91 428 146l-18 55q-150 48-300 0Z" fill="url(#steel)" stroke="var(--lb-ink)" strokeWidth="8" /><path d="M140 135Q260 106 380 135" fill="none" stroke="var(--lb-paper)" strokeOpacity=".7" strokeWidth="7" /><path className="tiffin-latch" d="M238 191h44v35h-44Z" fill="var(--lb-turmeric)" stroke="var(--lb-turmeric-deep)" strokeWidth="6" /></g>
    <g className="tiffin-body"><path d="M76 204Q260 248 444 204v128q-184 76-368 0Z" fill="url(#steel)" stroke="var(--lb-ink)" strokeWidth="9" /><path d="M88 254Q260 302 432 254" fill="none" stroke="var(--lb-paper)" strokeOpacity=".5" strokeWidth="6" /><path d="M108 335Q260 382 412 335" fill="none" stroke="var(--lb-turmeric-deep)" strokeOpacity=".7" strokeWidth="8" /></g>
    <g className="tiffin-hinge"><path d="M78 187v53m364-53v53" stroke="var(--lb-ink)" strokeWidth="12" strokeLinecap="round" /></g>
    {sealed && <g className="tiffin-label"><path d="M140 238h240v85H140Z" fill="var(--lb-paper)" stroke="var(--lb-leaf-deep)" strokeWidth="4" /><path d="M158 259h150m-150 22h195m-195 22h126" stroke="var(--lb-leaf-deep)" strokeWidth="5" strokeLinecap="round" /></g>}
  </svg>;
}
