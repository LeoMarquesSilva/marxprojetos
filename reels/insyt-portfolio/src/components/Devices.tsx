import type React from "react";
import { Img, staticFile } from "remotion";
import { BODY, C } from "../theme";
import { DESKTOP_W, MOBILE_H, MOBILE_W } from "../projects";

// Mockups com a captura real do site rolando por dentro. `scroll` vai de 0
// (topo) a 1 (fim da captura) — quem chama decide a curva da rolagem.

type BrowserProps = {
  readonly slug: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly imgH: number;
  readonly scroll: number;
  readonly style?: React.CSSProperties;
};

const BAR = 54;

export const BrowserFrame: React.FC<BrowserProps> = ({
  slug,
  url,
  width,
  height,
  imgH,
  scroll,
  style,
}) => {
  const contentH = (imgH * width) / DESKTOP_W;
  const maxScroll = Math.max(0, contentH - (height - BAR));

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: "#0e1330",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 10px 30px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      <div
        style={{
          height: BAR,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 20px",
          backgroundColor: "#141a3d",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {[0, 1, 2].map((d) => (
          <div
            key={d}
            style={{
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: d === 0 ? C.orange : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
        <div
          style={{
            flex: 1,
            marginLeft: 18,
            height: 32,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: BODY,
            fontSize: 17,
            color: "rgba(255,255,255,0.7)",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <svg width="13" height="15" viewBox="0 0 13 15">
            <rect x="1" y="6" width="11" height="8" rx="2" fill="rgba(255,255,255,0.6)" />
            <path d="M3.5 6V4.5a3 3 0 0 1 6 0V6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" fill="none" />
          </svg>
          {url}
        </div>
      </div>
      <div style={{ height: height - BAR, overflow: "hidden" }}>
        <Img
          src={staticFile(`captures/${slug}-desktop.jpg`)}
          style={{ width, display: "block", translate: `0 ${-scroll * maxScroll}px` }}
        />
      </div>
    </div>
  );
};

type PhoneProps = {
  readonly slug: string;
  readonly width: number;
  readonly scroll: number;
  readonly style?: React.CSSProperties;
};

export const PHONE_RATIO = 2.06;

export const PhoneFrame: React.FC<PhoneProps> = ({ slug, width, scroll, style }) => {
  const height = width * PHONE_RATIO;
  const bezel = width * 0.035;
  const screenW = width - bezel * 2;
  const screenH = height - bezel * 2;
  const contentH = (MOBILE_H * screenW) / MOBILE_W;
  const maxScroll = Math.max(0, contentH - screenH);

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: width * 0.16,
        padding: bezel,
        background: "linear-gradient(145deg, #2a2f45, #0b0d18 60%)",
        boxShadow:
          "0 60px 120px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.10)",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: screenW,
          height: screenH,
          borderRadius: width * 0.13,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        <Img
          src={staticFile(`captures/${slug}-mobile.jpg`)}
          style={{ width: screenW, display: "block", translate: `0 ${-scroll * maxScroll}px` }}
        />
        <div
          style={{
            position: "absolute",
            top: screenW * 0.03,
            left: "50%",
            translate: "-50% 0",
            width: screenW * 0.3,
            height: screenW * 0.085,
            borderRadius: screenW,
            backgroundColor: "#000",
          }}
        />
      </div>
    </div>
  );
};
