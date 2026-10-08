import type React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, clamp } from "../theme";

// O símbolo da INSYT desenhado com os mesmos caminhos de public/brand/insyt-icon.svg,
// mas com cada bloco animado separado: os quadrados laranja entram com mola,
// as dobras (triângulos escuros) aparecem logo depois — o "I" se monta na tela.
type Props = {
  readonly size: number;
  readonly start?: number;
  readonly style?: React.CSSProperties;
};

const SQUARES = [
  { x: 662.836, y: 2.597, w: 260.24, h: 260.363 },
  { x: 1076.805, y: 2.597, w: 260.36, h: 260.363 },
  { x: 662.836, y: 416.686, w: 260.24, h: 260.24 },
  { x: 1076.805, y: 416.686, w: 260.36, h: 260.24 },
];

const FOLDS = [
  "1337.164 262.96 1337.164 266.497 1076.805 416.686 1076.805 262.96 1337.164 262.96",
  "1076.805 416.686 1076.805 676.926 1073.266 676.926 923.075 416.686 1076.805 416.686",
  "1076.805 262.96 923.075 262.96 923.075 2.597 926.614 2.597 1076.805 262.96",
  "923.075 262.96 923.075 416.686 662.836 416.686 662.836 413.149 923.075 262.96",
];

export const InsytMark: React.FC<Props> = ({ size, start = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const order = [0, 3, 1, 2];

  return (
    <svg
      width={size}
      height={size}
      viewBox="662.836 2.597 674.328 674.329"
      style={{ overflow: "visible", ...style }}
    >
      {SQUARES.map((s, i) => {
        const p = spring({
          frame: frame - start - order[i] * 3,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.7 },
        });
        return (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            fill={C.orange}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              scale: `${p}`,
              rotate: `${(1 - p) * 90}deg`,
            }}
          />
        );
      })}
      {FOLDS.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill={C.orangeDark}
          opacity={interpolate(frame, [start + 12 + i * 2, start + 22 + i * 2], [0, 1], {
            ...clamp,
            easing: EASE,
          })}
        />
      ))}
    </svg>
  );
};
