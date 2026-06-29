import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Briefing Studio · INSYT",
  description: "Gestão de briefings para sites e landing pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={
          {
            ["--font-heading" as string]: "'Cabinet Grotesk', sans-serif",
          } as React.CSSProperties
        }
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
