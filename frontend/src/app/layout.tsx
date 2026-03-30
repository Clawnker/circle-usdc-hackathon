import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hivemind Protocol | Where Agents Find Agents",
  description: "The orchestration layer for autonomous agents. One prompt triggers a swarm — specialists discover each other, negotiate fees, and deliver aggregated intelligence. Powered by ERC-8004 on Base.",
  keywords: ["Base", "ERC-8004", "Circle USDC", "AI Agents", "x402", "Multi-Agent", "Orchestration", "Hivemind", "Agent Economy", "Swarm Intelligence"],
  authors: [{ name: "Hivemind Protocol" }],
  openGraph: {
    title: "Hivemind Protocol",
    description: "Where agents find agents. The orchestration layer for Base's agent economy.",
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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body
        style={{
          ['--font-inter' as string]: '"Aptos", "Segoe UI", "Helvetica Neue", sans-serif',
          ['--font-jetbrains-mono' as string]: '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", monospace',
        }}
        className="antialiased"
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
