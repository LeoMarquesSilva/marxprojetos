import { loadFont } from "@remotion/fonts";
import { Easing, staticFile } from "remotion";

// Paleta oficial (INSYT/Paleta de cores). Laranja é o acento único; o navy
// é o fundo de marca; gradiente 01 (pêssego → laranja → marrom) e
// gradiente 02 (lilás → azul → navy) só aparecem como luz de fundo.
export const C = {
  orange: "#f74211",
  orangeDark: "#bf3616",
  brown: "#56180b",
  peach: "#ffc4b6",
  navy: "#0a0f2d",
  blue: "#3e54b5",
  lilac: "#bbc9f9",
  slate: "#525663",
  off: "#f6f6f6",
  muted: "#a3a8b8",
} as const;

export const DISPLAY = "Cabinet Grotesk";
export const BODY = "Poppins";

// Expo-out: entrada rápida que assenta devagar — o "peso" das entradas.
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
// Para rolagens e deslocamentos longos.
export const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const fontsLoaded = Promise.all([
  loadFont({ family: DISPLAY, url: staticFile("fonts/CabinetGrotesk-Medium.woff2"), weight: "500" }),
  loadFont({ family: DISPLAY, url: staticFile("fonts/CabinetGrotesk-Bold.woff2"), weight: "700" }),
  loadFont({ family: DISPLAY, url: staticFile("fonts/CabinetGrotesk-Extrabold.woff2"), weight: "800" }),
  loadFont({ family: DISPLAY, url: staticFile("fonts/CabinetGrotesk-Black.woff2"), weight: "900" }),
  loadFont({ family: BODY, url: staticFile("fonts/Poppins-Regular.ttf"), weight: "400" }),
  loadFont({ family: BODY, url: staticFile("fonts/Poppins-Medium.ttf"), weight: "500" }),
  loadFont({ family: BODY, url: staticFile("fonts/Poppins-SemiBold.ttf"), weight: "600" }),
]);
