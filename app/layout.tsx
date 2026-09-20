import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One family, used across the whole app. Archivo is variable on both weight and
// width, and the width axis is what carries emphasis here — see `.qty` in
// globals.css.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Recipe Bot",
  description: "A personal recipe assistant that knows how you cook.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
