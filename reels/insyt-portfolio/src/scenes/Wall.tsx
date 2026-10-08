import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PHONE_RATIO, PhoneFrame } from "../components/Devices";
import { Words } from "../components/Words";
import { PROJECTS } from "../projects";
import { EASE, clamp } from "../theme";

// Mural: todos os projetos juntos, em colunas que correm em sentidos opostos.
// Fecha a vitrine com escala ("não foi um site só") antes dos argumentos.
const PHONE_W = 300;
const GAP = 40;
const STEP = PHONE_W * PHONE_RATIO + GAP;

const COLUMNS = [
  [0, 3, 6, 2],
  [4, 1, 5, 0],
  [2, 6, 3, 4],
];

export const Wall: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { ...clamp, easing: EASE });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: fadeIn,
          transform: "perspective(2400px) rotateX(22deg) rotateZ(-14deg) scale(1.15)",
          transformOrigin: "50% 60%",
          top: 560,
        }}
      >
        {COLUMNS.map((col, ci) => {
          const dir = ci % 2 === 0 ? -1 : 1;
          const offset = dir * frame * 3.2 - (ci % 2 === 0 ? 0 : STEP);
          return col.map((pi, ri) => (
            <PhoneFrame
              key={`${ci}-${ri}`}
              slug={PROJECTS[pi].slug}
              width={PHONE_W}
              scroll={0.04 * ri}
              style={{ left: 40 + ci * (PHONE_W + GAP), top: ri * STEP + offset }}
            />
          ));
        })}
      </AbsoluteFill>

      {/* Véu para o texto ler bem por cima do mural */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,15,45,0.98) 0%, rgba(10,15,45,0.92) 36%, rgba(10,15,45,0) 58%)",
        }}
      />
      <div style={{ position: "absolute", left: 80, right: 80, top: 260 }}>
        <Words
          text={`${PROJECTS.length} projetos.\n1 especialidade:\no jurídico.`}
          accent={["jurídico"]}
          size={112}
          start={4}
          stagger={4}
        />
      </div>
    </AbsoluteFill>
  );
};
