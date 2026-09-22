/**
 * Line-art ornaments.
 *
 * Drawn as strokes on a 24-box with a single consistent weight, so they sit
 * with the type rather than shouting over it. They are used to mark sections
 * and to carry empty states — places where the page would otherwise be a wall
 * of text. `currentColor` throughout, so they inherit whatever meaning the
 * surrounding colour already has.
 */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/**
 * A chilli — used where heat is the actual meaning, next to the spices that
 * need tasting rather than tipping in.
 *
 * Drawn as a closed pod that tapers to a point, with a stalk. Earlier attempts
 * used an open curve, which read as a banana at 20px.
 */
export function Chilli({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13.8 7.6c1.7 1 2.6 3 2.2 5.2-.7 3.9-4.7 7-9 7.2-.9 0-1.3-.8-.8-1.5.3-.4.8-.6 1.4-.8 3.3-1 5.6-3.4 6-6.1.2-1.4-.2-2.8-1-3.8Z" />
      <path d="M13.8 7.6c-.9-.4-1.4-1.3-1.2-2.2.2-1 1.1-1.6 2.1-1.5" />
    </svg>
  );
}

/**
 * A fork — appetite, and what you feel like eating.
 *
 * Tines rather than a spoon's bowl: a spoon drawn face-on reads as a lollipop
 * at small sizes, while tines are unmistakable.
 */
export function Fork({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M7.6 3v4.6c0 1.5 1.2 2.7 2.7 2.7h.4c1.5 0 2.7-1.2 2.7-2.7V3" />
      <path d="M9.4 3v4.2M12 3v4.2" />
      <path d="M10.5 10.3V21" />
    </svg>
  );
}

/** A pot — the method. */
export function Pot({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 9h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
      <path d="M4 11H2.6M20 11h1.4" />
      <path d="M9 6c0-1 .8-1.4.8-2.3M12 6c0-1 .8-1.4.8-2.3M15 6c0-1 .8-1.4.8-2.3" />
    </svg>
  );
}

/** A citrus half — the ingredient ledger. */
export function Citrus({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 12 6.1 6.1M12 12l8.3-1.2M12 12l-1.2 8.3M12 12l5.9 5.9M12 12 10.8 3.7M12 12 3.7 13.2" />
    </svg>
  );
}

/** A herb sprig — the mark in the header. */
export function Sprig({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 21V6.5" />
      <path d="M12 9.5c0-2.2 1.9-4 4.2-4 0 2.2-1.9 4-4.2 4Z" />
      <path d="M12 14c0-2.2 1.9-4 4.2-4 0 2.2-1.9 4-4.2 4Z" />
      <path d="M12 9.5c0-2.2-1.9-4-4.2-4 0 2.2 1.9 4 4.2 4Z" />
      <path d="M12 14c0-2.2-1.9-4-4.2-4 0 2.2 1.9 4 4.2 4Z" />
    </svg>
  );
}

/** A whisk — generating. */
export function Whisk({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m4 20 5.2-5.2" />
      <path d="M14.8 3.8c1.9 1.9 2.4 4.4 1.2 5.7l-5 5c-1.3 1.2-3.8.7-5.7-1.2" />
      <path d="M11.6 5.3c1.4 1.4 2.1 3 1.8 3.9M8.9 7.5c1.4 1.4 2.1 3 1.8 4" />
    </svg>
  );
}

/** A bowl — the library and empty states. */
export function Bowl({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 11h18c0 4.4-3.1 8-7 8h-4c-3.9 0-7-3.6-7-8Z" />
      <path d="M8.5 8c.6-.7.6-1.7 0-2.4M12 7.4c.6-.7.6-1.7 0-2.4M15.5 8c.6-.7.6-1.7 0-2.4" />
    </svg>
  );
}

/** A knife — adding a recipe. */
export function Knife({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.4 15.8 15.2 5c1.6-1.6 3.3-2.4 3.9-1.8.6.6-.2 2.3-1.8 3.9L6.5 17.9Z" />
      <path d="m4.4 15.8 2.1 2.1-2 2a1.5 1.5 0 0 1-2.1-2.1Z" />
    </svg>
  );
}

/** A section heading with an ornament and a rule running off to the right. */
export function SectionHeading({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="section-rule text-sm mb-2">
      <span className="text-blue">{icon}</span>
      <span>{children}</span>
    </h2>
  );
}

/** A mushroom: domed cap over a short stem. */
export function Mushroom({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.8 11.6C2.8 6.9 6.9 3 12 3s9.2 3.9 9.2 8.6c0 .9-.8 1.6-1.8 1.6H4.6c-1 0-1.8-.7-1.8-1.6Z" />
      <path d="M9 13.2v5.6c0 1.6 1.3 2.9 3 2.9s3-1.3 3-2.9v-5.6" />
      <path d="M8.4 8.6c.9-.9 2.2-1.4 3.6-1.4" />
    </svg>
  );
}

/** A garlic bulb: cloves fanning out from a stem. */
export function Garlic({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5.6c4 0 6.9 4 6.9 8.4 0 4-3 7-6.9 7s-6.9-3-6.9-7c0-4.4 2.9-8.4 6.9-8.4Z" />
      <path d="M12 5.6V2.6" />
      <path d="M8.3 14c0-3.6 1.6-8.4 3.7-8.4s3.7 4.8 3.7 8.4" />
    </svg>
  );
}

/** An aubergine: bulbous body under a leafy calyx. */
export function Aubergine({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M16.6 7.2c2.9 2 3.6 6.3 1.5 9.6-2.1 3.4-6.5 4.8-9.8 3.2-3-1.5-3.9-5.2-2-8.4 2-3.4 6.5-5.4 10.3-4.4Z" />
      <path d="M14.8 6.2c-.7-1.6 0-3.4 1.6-4.2M16.6 7.2c1.6-.8 3.5-.2 4.4 1.3" />
    </svg>
  );
}

/** An onion: layered bulb with two shoots. */
export function Onion({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5.8c4.3 0 7.6 3.7 7.6 8.1s-3.3 8.1-7.6 8.1-7.6-3.7-7.6-8.1S7.7 5.8 12 5.8Z" />
      <path d="M8.2 13.9c0-3.9 1.7-8.1 3.8-8.1s3.8 4.2 3.8 8.1" />
      <path d="M12 5.8c-1.1-1.7-.8-3.5.8-4.6M12 5.8c.8-2 2.4-2.9 4.4-2.6" />
    </svg>
  );
}

/** A tomato: round body with a star calyx. */
export function Tomato({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="14.4" r="7.4" />
      <path d="M12 7V3.6" />
      <path d="M12 7C9.9 5.5 7.4 5.6 5.7 7.3 7.4 9 9.9 9.1 12 7Z" />
      <path d="M12 7c2.1-1.5 4.6-1.4 6.3.3-1.7 1.7-4.2 1.8-6.3-.3Z" />
    </svg>
  );
}

/**
 * A row of ingredients and tools, used once per page as the only decorative
 * element. Kept to a single band rather than scattered through the layout:
 * repeated ornamentation reads as filler, one arrangement reads as a choice.
 */
export function StillLife({ className = "" }: { className?: string }) {
  const pieces = [Onion, Mushroom, Chilli, Aubergine, Garlic, Tomato, Whisk, Knife];
  return (
    <div
      className={`flex items-end gap-4 sm:gap-6 text-bark/45 ${className}`}
      aria-hidden
    >
      {pieces.map((Piece, i) => (
        <Piece key={i} size={i % 2 === 0 ? 40 : 34} />
      ))}
    </div>
  );
}
