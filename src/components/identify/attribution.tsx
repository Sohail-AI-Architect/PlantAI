/*
 * Pl@ntNet attribution (FR-ID-008, UI_UX_DESIGN.md §6.1/§6.3 trust blocks).
 *
 * The recommended attribution sentence is quoted from Pl@ntNet's terms via
 * docs/VERIFIED_FACTS.md research note (verified quote, 2026-11). PlantAI
 * displays attribution regardless of plan requirements (good practice).
 */
export function PlanteNetAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-foreground-muted text-xs leading-relaxed ${className}`}>
      The image-based plant species identification service used, is based on
      the{" "}
      <a
        href="https://my.plantnet.org/"
        rel="noopener noreferrer"
        target="_blank"
        className="underline hover:text-foreground"
      >
        Pl@ntNet
      </a>{" "}
      recognition API, regularly updated and accessible through the site
      my.plantnet.org.
    </p>
  );
}
