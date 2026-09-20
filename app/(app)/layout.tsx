import Link from "next/link";

const NAV = [
  { href: "/generate", label: "Cook" },
  { href: "/pantry", label: "Pantry" },
  { href: "/library", label: "Library" },
  { href: "/import", label: "Add" },
  { href: "/settings", label: "Taste" },
];

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 bg-paper border-b border-rule">
        <div className="mx-auto max-w-3xl px-5 h-14 flex items-center gap-5">
          <Link href="/generate" className="display text-lg shrink-0">
            Recipe Bot
          </Link>
          <nav className="flex-1 flex items-center gap-4 overflow-x-auto text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink-soft hover:text-ink whitespace-nowrap py-1"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-5 py-8">{children}</main>
    </>
  );
}
