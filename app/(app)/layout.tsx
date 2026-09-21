import Link from "next/link";
import { Bowl, Knife, Sprig, Whisk } from "@/components/ornaments";
import { isUnlocked } from "@/lib/access";

const NAV = [
  { href: "/generate", label: "Cook", icon: Whisk, ownerOnly: false },
  { href: "/library", label: "Library", icon: Bowl, ownerOnly: false },
  { href: "/import", label: "Add", icon: Knife, ownerOnly: true },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const unlocked = await isUnlocked();
  const nav = NAV.filter((item) => unlocked || !item.ownerOnly);

  return (
    <>
      <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-mist">
        <div className="mx-auto max-w-3xl px-5 h-16 flex items-center gap-6">
          <Link href="/generate" className="flex items-center gap-2 shrink-0">
            <span className="text-sage">
              <Sprig size={22} />
            </span>
            <span className="display text-xl">Recipe Bot</span>
          </Link>
          <nav className="flex-1 flex items-center justify-end gap-1 text-sm">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-bark hover:text-cocoa hover:bg-linen whitespace-nowrap"
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
