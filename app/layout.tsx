import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lexveritasacademy.sites.bd"),
  title: "LexVeritas Academy | BJS, Bar Council, Law Officer & Legal Education",
  description:
    "BJS, Bangladesh Bar Council, Law Officer, and academic legal education. Take MCQ examinations and explore law books from LexVeritas Academy.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/assets/lexveritas-logo.png",
    shortcut: "/assets/lexveritas-logo.png",
    apple: "/assets/lexveritas-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
