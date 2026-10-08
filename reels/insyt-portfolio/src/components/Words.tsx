import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, DISPLAY, EASE, clamp } from "../theme";

type WordsProps = {
  readonly text: string; // "\n" quebra linha
  readonly size: number;
  readonly start?: number;
  readonly stagger?: number;
  readonly exitAt?: number;
  readonly accent?: string[]; // palavras (sem pontuação) em laranja
  readonly color?: string;
  readonly weight?: number;
  readonly font?: string;
  readonly lineHeight?: number;
  readonly align?: "left" | "center";
  readonly letterSpacing?: string;
  readonly style?: React.CSSProperties;
};

const clean = (w: string) => w.replace(/[.,!?:;]/g, "");

// Tipografia cinética: cada palavra sobe de dentro de uma máscara. É o
// movimento-assinatura do vídeo — todas as frases entram e saem assim.
export const Words: React.FC<WordsProps> = ({
  text,
  size,
  start = 0,
  stagger = 3,
  exitAt,
  accent = [],
  color = C.off,
  weight = 800,
  font = DISPLAY,
  lineHeight = 0.98,
  align = "left",
  letterSpacing = "-0.03em",
  style,
}) => {
  const frame = useCurrentFrame();
  let i = 0;

  return (
    <div
      style={{
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        letterSpacing,
        color,
        ...style,
      }}
    >
      {text.split("\n").map((line, li) => (
        <div
          key={li}
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: size * 0.24,
            justifyContent: align === "center" ? "center" : "flex-start",
          }}
        >
          {line.split(" ").map((word, wi) => {
            const d = start + i * stagger;
            const e = exitAt === undefined ? 0 : exitAt + i * 2;
            i++;
            const inP = interpolate(frame, [d, d + 16], [0, 1], { ...clamp, easing: EASE });
            const outP =
              exitAt === undefined
                ? 0
                : interpolate(frame, [e, e + 12], [0, 1], { ...clamp, easing: EASE });
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  paddingBottom: size * 0.12,
                  marginBottom: -size * 0.12,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    translate: `0 ${(1 - inP) * 110 - outP * 115}%`,
                    color: accent.includes(clean(word)) ? C.orange : undefined,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
