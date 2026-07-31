import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peace Street Bridge Tracker",
  description: "Tracks confirmed truck strikes at Raleigh's Peace Street railroad bridge.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
