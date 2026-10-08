import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

// Fundo contínuo do vídeo inteiro: fica fora das transições, então as cenas
// deslizam por cima de um mesmo "palco" em vez de trocar de fundo a cada corte.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;

  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, overflow: "hidden" }}>
      {/* Luz laranja (gradiente 01) derivando devagar no topo */}
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -260 + Math.sin(t * 0.35) * 160,
          top: -620 + Math.cos(t * 0.28) * 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.orange}55 0%, ${C.brown}33 38%, transparent 68%)`,
        }}
      />
      {/* Luz azul (gradiente 02) embaixo, para dar profundidade ao navy */}
      <div
        style={{
          position: "absolute",
          width: 1500,
          height: 1500,
          right: -700 + Math.cos(t * 0.3) * 140,
          bottom: -760 + Math.sin(t * 0.25) * 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.blue}44 0%, ${C.blue}11 40%, transparent 68%)`,
        }}
      />
      {/* Grade fina — eco do grid de blocos do símbolo */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
          backgroundPosition: `0px ${(frame * 0.6) % 90}px`,
          maskImage:
            "radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)",
        }}
      />
      {/* Granulado: tira a cara de "gradiente digital" */}
      <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed={Math.floor(frame / 2) % 8}
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
