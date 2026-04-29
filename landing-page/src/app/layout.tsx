import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zenius - Study Smarter, Not Harder",
  description: "AI-powered learning platform. Turn any material into notes, flashcards, quizzes, and podcasts instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
