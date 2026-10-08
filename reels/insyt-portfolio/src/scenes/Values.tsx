import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Words } from "../components/Words";
import { BODY, C, DISPLAY, EASE, clamp } from "../theme";

// Por que contratar: quatro promessas curtas, cada uma entrando no ritmo.
const ITEMS = [
  "Design exclusivo,\nnada de template",
  "Texto que explica\ne convence",
  "WhatsApp a\num clique",
  "Pronto para aparecer\nno Google",
];

export const Values: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 80, right: 80, top: 260 }}>
        <Words
          text={"Site bonito\nnão basta."}
          accent={["não", "basta"]}
          size={124}
          start={0}
          stagger={4}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 640,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        {ITEMS.map((item, i) => {
          const d = 24 + i * 16;
          const p = interpolate(frame, [d, d + 18], [0, 1], { ...clamp, easing: EASE });
          const pop = spring({ frame: frame - d - 4, fps, config: { damping: 12, stiffness: 180 } });
          return (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 34,
                opacity: p,
                translate: `${(1 - p) * -60}px 0`,
                paddingBottom: 30,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div
                style={{
                  flex: "none",
                  width: 76,
                  height: 76,
                  backgroundColor: C.orange,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  scale: `${pop}`,
                  rotate: `${(1 - pop) * 90}deg`,
                  fontFamily: BODY,
                  fontWeight: 600,
                  fontSize: 30,
                  color: C.navy,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 58,
                  lineHeight: 1.02,
                  letterSpacing: "-0.02em",
                  color: C.off,
                  whiteSpace: "pre-line",
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
