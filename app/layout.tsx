import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "Soccer Match Analyzer", description: "Form, streaks, xG and player ratings for soccer matches" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/"><b>⚽ Soccer Match Analyzer</b></Link>
          <nav style={{ display: "flex", gap: 14, alignItems: "center" }}><Link href="/">Matches</Link><Link href="/predictions">Predictions</Link></nav>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
