// Duração de cada cena em frames (30 fps). O vídeo inteiro deriva daqui, para
// que mexer numa cena não deixe a duração total ou os sons fora de sincronia.
export const FPS = 30;
export const TRANSITION = 14;

export const DUR = {
  hook: 150,
  brand: 96,
  project: 144,
  wall: 114,
  values: 156,
  cta: 222,
} as const;

export const PROJECT_COUNT = 7;

const sequence = [
  DUR.hook,
  DUR.brand,
  ...Array.from({ length: PROJECT_COUNT }, () => DUR.project),
  DUR.wall,
  DUR.values,
  DUR.cta,
];

export const TOTAL =
  sequence.reduce((a, b) => a + b, 0) - TRANSITION * (sequence.length - 1);

// Frame (global) em que cada transição começa — usado para os whooshes.
export const CUTS: number[] = (() => {
  const cuts: number[] = [];
  let end = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    end += sequence[i];
    cuts.push(end - TRANSITION);
    end -= TRANSITION;
  }
  return cuts;
})();

export const BRAND_START = CUTS[0];
export const CTA_START = TOTAL - DUR.cta;

// Frame (dentro da cena CTA) em que o cursor clica no botão "Me chama na DM".
export const CLICK_AT = 116;
