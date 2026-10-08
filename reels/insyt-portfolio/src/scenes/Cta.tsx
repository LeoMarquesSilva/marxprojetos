import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Words } from "../components/Words";
import { BODY, C, DISPLAY, EASE, clamp } from "../theme";
import { CLICK_AT } from "../timeline";

// CTA final. Dois caminhos de contato (DM e WhatsApp) porque o vídeo vai
// servir de anúncio: no anúncio o botão nativo leva à DM, no orgânico quem
// prefere WhatsApp já sai com o número. O cursor clicando no botão ensina a
// ação sem precisar de mais texto.

const WHATSAPP = "(35) 98875-4584";
const WA_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const btn = spring({ frame: frame - 44, fps, config: { damping: 13, stiffness: 140 } });
  const wa = interpolate(frame, [60, 76], [0, 1], { ...clamp, easing: EASE });
  const press = interpolate(frame, [CLICK_AT - 3, CLICK_AT, CLICK_AT + 6], [1, 0.95, 1], clamp);
  // Pulso contínuo depois que o botão entra, chamando o olho.
  const cycle = ((frame - 70) % 36) / 36;
  const ring = frame > 70 ? cycle : 0;
  const ripple = interpolate(frame, [CLICK_AT, CLICK_AT + 22], [0, 1], { ...clamp, easing: EASE });

  // Cursor: entra pela direita e para em cima do botão.
  const cur = interpolate(frame, [84, CLICK_AT - 4], [0, 1], { ...clamp, easing: EASE });
  const logo = interpolate(frame, [138, 158], [0, 1], { ...clamp, easing: EASE });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 80, right: 80, top: 250 }}>
        <Words
          text={"Quer um site\nassim para o seu\nescritório?"}
          accent={["escritório"]}
          size={112}
          start={0}
          stagger={3}
        />
      </div>

      {/* Botão principal: DM */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 820,
          height: 170,
          scale: `${btn * press}`,
          opacity: btn,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 85,
            border: `3px solid ${C.orange}`,
            scale: `${1 + ring * 0.12}`,
            opacity: (1 - ring) * 0.7,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 85,
            backgroundColor: C.orange,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            boxShadow: `0 30px 80px ${C.orange}66`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 720,
              top: 85,
              width: 1400 * ripple,
              height: 1400 * ripple,
              translate: "-50% -50%",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.25)",
              opacity: 1 - ripple,
            }}
          />
          {/* Avião de papel (ícone de mensagem direta) */}
          <svg width="66" height="66" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 3L9.5 13.5M22 3l-7 19-4.5-8.5L2 9l20-6z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 76, color: "#fff", letterSpacing: "-0.02em" }}>
            Me chama na DM
          </span>
        </div>
      </div>

      {/* Alternativa: WhatsApp */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1030,
          height: 124,
          borderRadius: 62,
          border: "2px solid rgba(255,255,255,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          opacity: wa,
          translate: `0 ${(1 - wa) * 30}px`,
          fontFamily: BODY,
          fontWeight: 500,
          fontSize: 42,
          color: C.off,
        }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24">
          <path d={WA_PATH} fill={C.off} />
        </svg>
        ou WhatsApp {WHATSAPP}
      </div>

      {/* Cursor */}
      <svg
        width="70"
        height="70"
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: interpolate(cur, [0, 1], [1120, 760]),
          top: interpolate(cur, [0, 1], [1260, 930]),
          opacity: interpolate(frame, [84, 90, CLICK_AT + 26, CLICK_AT + 34], [0, 1, 1, 0], clamp),
          scale: `${press}`,
          filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.5))",
        }}
      >
        <path d="M5 3l14 8-6 1.5L9.5 19z" fill="#fff" stroke={C.navy} strokeWidth="1.2" strokeLinejoin="round" />
      </svg>

      {/* Assinatura */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1250,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          opacity: logo,
          translate: `0 ${(1 - logo) * 24}px`,
        }}
      >
        <Img src={staticFile("brand/insyt-logo-horizontal-light.svg")} style={{ width: 330 }} />
        <div style={{ fontFamily: BODY, fontSize: 30, letterSpacing: "0.06em", color: C.muted }}>
          insytstudio.com.br
        </div>
      </div>
    </AbsoluteFill>
  );
};
