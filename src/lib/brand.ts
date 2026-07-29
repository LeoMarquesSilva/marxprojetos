export const insytBrand = {
  name: "INSYT",
  product: "Briefing Studio",
  colors: {
    primary: "#f74211",
    primaryDark: "#bf3616",
    black: "#1d1d1b",
    slate: "#525663",
    surface: "#ffffff",
    canvas: "#f6f5f3",
    canvasAlt: "#efeeeb",
    border: "#e4e2dd",
    muted: "#8b909d",
  },
  fonts: {
    heading: "Cabinet Grotesk, sans-serif",
    body: "Poppins, sans-serif",
  },
  logo: "/brand/insyt-logo.svg",
  logoLight: "/brand/insyt-logo-light.svg",
  // Lockup horizontal: em barras de navegação e rodapés o empilhado fica
  // pequeno demais para o wordmark ser legível.
  logoHorizontal: "/brand/insyt-logo-horizontal.svg",
  logoHorizontalLight: "/brand/insyt-logo-horizontal-light.svg",
} as const;
