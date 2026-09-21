import type { Metadata } from "next";
import { Bodoni_Moda, Karla } from "next/font/google";
import "./globals.css";

// Karla for everything at reading and interface size: warmer and less
// mechanical than a neutral grotesque, with the figures still clear enough to
// read a quantity at a glance. Bodoni carries the headings.
const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Recipe Bot",
  description: "A recipe assistant that already knows how you cook.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${karla.variable} ${bodoni.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
