import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Words } from "../components/Words";
import { BODY, C, EASE, clamp } from "../theme";

// Gancho (0–4s). Já começa com texto na tela no frame 0 — no feed, quem não
// lê nada no primeiro segundo passa direto. A busca digitando coloca o
// advogado na cadeira do cliente dele.
const QUERY = "advogado especialista perto de mim";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = Math.floor(interpolate(frame, [26, 66], [0, QUERY.length], clamp));
  const caretOn = Math.floor(frame / 8) % 2 === 0 || (frame > 26 && frame < 66);
  const barIn = interpolate(frame, [14, 30], [0, 1], { ...clamp, easing: EASE });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 80, right: 80, top: 300 }}>
        <Words
          text={"Antes de ligar,\nseu cliente\npesquisa você."}
          accent={["pesquisa"]}
          size={112}
          start={-14}
          stagger={3}
          exitAt={84}
        />
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, top: 300 }}>
        <Words
          text={"O que ele\nencontra?"}
          accent={["encontra"]}
          size={150}
          start={92}
          stagger={4}
        />
      </div>

      {/* Barra de busca genérica (sem marca de buscador) */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 820,
          opacity: barIn,
          translate: `0 ${(1 - barIn) * 60}px`,
        }}
      >
        <div
          style={{
            height: 128,
            borderRadius: 64,
            backgroundColor: "rgba(255,255,255,0.96)",
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "0 44px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <circle cx="10.5" cy="10.5" r="7" stroke={C.slate} strokeWidth="2.4" />
            <path d="M16 16l5 5" stroke={C.slate} strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <div style={{ fontFamily: BODY, fontSize: 38, color: C.navy, whiteSpace: "nowrap" }}>
            {QUERY.slice(0, typed)}
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 44,
                marginLeft: 4,
                verticalAlign: "middle",
                backgroundColor: C.orange,
                opacity: caretOn ? 1 : 0,
              }}
            />
          </div>
        </div>

        {/* Resultados "fantasma": o cliente vê vários, escolhe um */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 22 }}>
          {[0, 1, 2].map((r) => {
            const p = interpolate(frame, [68 + r * 5, 84 + r * 5], [0, 1], { ...clamp, easing: EASE });
            const pick = r === 1 ? interpolate(frame, [96, 110], [0, 1], { ...clamp, easing: EASE }) : 0;
            return (
              <div
                key={r}
                style={{
                  opacity: p * (r === 1 ? 1 : 1 - pick * 0.6),
                  translate: `0 ${(1 - p) * 30}px`,
                  scale: `${1 + pick * 0.03}`,
                  padding: "26px 34px",
                  borderRadius: 26,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: `2px solid ${pick > 0.01 ? `rgba(247,66,17,${pick})` : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <div style={{ width: [420, 520, 380][r], height: 22, borderRadius: 11, backgroundColor: r === 1 ? C.orange : "rgba(255,255,255,0.28)" }} />
                <div style={{ marginTop: 16, width: [700, 620, 660][r], height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.12)" }} />
                <div style={{ marginTop: 12, width: [560, 680, 500][r], height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.12)" }} />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
