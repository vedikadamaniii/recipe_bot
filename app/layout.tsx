import type { Metadata } from "next";
import { Archivo, Bodoni_Moda } from "next/font/google";
import "./globals.css";

// Two families, clearly distinct. Bodoni carries the headings — the
// high-contrast serif from the reference palette. Archivo does everything
// else, and its width axis is what sets quantities apart (see `.qty`).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
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
    <html
      lang="en"
      className={`${archivo.variable} ${bodoni.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
