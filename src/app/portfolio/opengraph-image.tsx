import { ImageResponse } from "next/og";

export const alt = "Portfólio INSYT — ideias que viram presença";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: "#11100f",
          color: "#ffffff",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-120px",
            top: "-170px",
            width: "540px",
            height: "540px",
            borderRadius: "50%",
            background: "#f74211",
            opacity: 0.26,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <span>INSYT</span>
          <span
            style={{
              color: "#f74211",
              fontSize: 16,
              letterSpacing: "0.16em",
            }}
          >
            PORTFÓLIO
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 90,
              fontWeight: 700,
              letterSpacing: "-0.065em",
              lineHeight: 0.92,
            }}
          >
            Ideias que viram
          </div>
          <div
            style={{
              display: "flex",
              color: "#f74211",
              fontSize: 90,
              fontWeight: 700,
              letterSpacing: "-0.065em",
              lineHeight: 0.92,
            }}
          >
            presença.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,.16)",
            paddingTop: "22px",
            color: "rgba(255,255,255,.52)",
            fontSize: 18,
          }}
        >
          <span>Sites · Landing pages · Sistemas</span>
          <span>Brasil</span>
        </div>
      </div>
    ),
    size,
  );
}
