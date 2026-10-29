import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hisab — Voice Money Diary",
  description:
    "Speak your spending in your own language. The diary keeps itself. Built with Meta's Muse Spark Open.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ur">
      <body className="bg-amber-950 text-amber-50 antialiased">{children}</body>
    </html>
  );
}
