import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gcai-project",
  description: "Born from the general-purpose template line.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
