import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZO FM — 86.13",
  description: "Always on. Always tuned in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
