import Link from "next/link";
import { Bowl, Knife, Sprig, Whisk } from "@/components/ornaments";

const NAV = [
  { href: "/generate", label: "Cook", icon: Whisk },
  { href: "/library", label: "Library", icon: Bowl },
  { href: "/import", label: "Add", icon: Knife },
];

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-mist">
        <div className="mx-auto max-w-3xl px-5 h-16 flex items-center gap-3 sm:gap-6">
          {/*
            Home is the Cook page. The wordmark is hidden on narrow screens and
            the sprig carries the link on its own: at phone width the wordmark
            plus three nav items overflowed, and "Add" was pushed off-screen
            entirely, which made it look like the nav had broken.
          */}
          <Link
            href="/generate"
            aria-label="Recipe Bot home"
            className="flex items-center gap-2 shrink-0"
          >
            <span className="text-sage">
              <Sprig size={22} />
            </span>
            <span className="display text-xl hidden sm:inline">Recipe Bot</span>
          </Link>
          <nav className="flex-1 flex items-center justify-end gap-0.5 sm:gap-1 text-sm">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-bark hover:text-cocoa hover:bg-linen whitespace-nowrap shrink-0"
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-5 py-9">{children}</main>
    </>
  );
}
