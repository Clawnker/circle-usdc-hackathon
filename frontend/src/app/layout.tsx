import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hivemind Protocol | Where Agents Find Agents",
  description: "The orchestration layer for autonomous agents. One prompt triggers a swarm — specialists discover each other, negotiate fees, and deliver aggregated intelligence. All on Solana.",
  keywords: ["Solana", "AI Agents", "x402", "Multi-Agent", "Orchestration", "Hivemind", "Agent Economy", "Swarm Intelligence"],
  authors: [{ name: "Hivemind Protocol" }],
  openGraph: {
    title: "Hivemind Protocol",
    description: "Where agents find agents. The orchestration layer for Solana's agent economy.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
