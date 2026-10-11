import type { NextConfig } from "next";

// Sites em revisão (/sites/<slug>/, servidos de public/) e a tela de
// revisão (/r/<token>) são cópias de trabalho — de clientes e de propostas
// para escritórios que ainda não são clientes. Nenhum buscador pode
// indexá-los: o robots.txt só pede para não rastrear, quem garante é o
// X-Robots-Tag (vale também para os arquivos estáticos de public/).
const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/sites/:path*", headers: NOINDEX },
      { source: "/r/:path*", headers: NOINDEX },
    ];
  },
};

export default nextConfig;
