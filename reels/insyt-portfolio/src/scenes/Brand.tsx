import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { InsytMark } from "../components/InsytMark";
import { Words } from "../components/Words";
import { BODY, C, EASE, clamp } from "../theme";

// Entrada da marca: o símbolo se monta, o wordmark é revelado por baixo dele
// e a assinatura do site ("Ideias que viram presença.") fecha a cena.
// O logo empilhado tem viewBox 2000×1540 e o símbolo ocupa x 662–1337,
// y 2–677 — o símbolo animado é posicionado exatamente por cima dessa área.
const LOGO_W = 560;
const S = LOGO_W / 2000;

export const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [22, 42], [0, 1], { ...clamp, easing: EASE });
  const lift = interpolate(frame, [0, 30], [40, 0], { ...clamp, easing: EASE });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: (1080 - LOGO_W) / 2,
          top: 330 + lift,
          width: LOGO_W,
          height: 1540 * S,
        }}
      >
        <Img
          src={staticFile("brand/insyt-logo-light.svg")}
          style={{
            width: LOGO_W,
            // Só a parte do wordmark (abaixo do símbolo) é revelada pela máscara.
            clipPath: `inset(${interpolate(reveal, [0, 1], [100, 46])}% 0 0 0)`,
            translate: `0 ${(1 - reveal) * 30}px`,
          }}
        />
        <InsytMark
          size={674.328 * S}
          start={2}
          style={{ position: "absolute", left: 662.836 * S, top: 2.597 * S }}
        />
      </div>

      <div style={{ position: "absolute", left: 80, right: 80, top: 860 }}>
        <Words
          text={"Ideias que viram\npresença."}
          accent={["presença"]}
          size={116}
          start={34}
          stagger={4}
          align="center"
        />
        <div
          style={{
            marginTop: 44,
            textAlign: "center",
            fontFamily: BODY,
            fontSize: 40,
            lineHeight: 1.35,
            color: C.muted,
            opacity: interpolate(frame, [52, 68], [0, 1], clamp),
            translate: `0 ${interpolate(frame, [52, 68], [20, 0], { ...clamp, easing: EASE })}px`,
          }}
        >
          Sites e landing pages para
          <br />
          escritórios de advocacia
        </div>
      </div>
    </AbsoluteFill>
  );
};
