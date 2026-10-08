import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame, PHONE_RATIO, PhoneFrame } from "../components/Devices";
import { Words } from "../components/Words";
import { PROJECTS, type Project } from "../projects";
import { BODY, C, DISPLAY, EASE, clamp } from "../theme";

type Props = {
  readonly index: number; // 0-based, em PROJECTS
};

// Rolagem com respiros: desce, segura um instante numa seção, desce de novo.
// Parece alguém navegando de verdade, não um scroll linear de screen recorder.
const useScroll = (start: number, end: number) => {
  const frame = useCurrentFrame();
  const span = end - start;
  return interpolate(
    frame,
    [start, start + span * 0.3, start + span * 0.45, start + span * 0.8, end],
    [0, 0.22, 0.26, 0.55, 0.6],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
};

export const ProjectScene: React.FC<Props> = ({ index }) => {
  const project = PROJECTS[index];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 90, mass: 0.9 } });
  const push = interpolate(frame, [0, 144], [1, 1.04], clamp);
  const desktopScroll = useScroll(16, 140);
  const phoneScroll = useScroll(22, 142);

  return (
    <AbsoluteFill>
      {/* Número gigante vazado ao fundo: dá profundidade e marca a sequência */}
      <div
        style={{
          position: "absolute",
          right: -30,
          top: 120,
          fontFamily: DISPLAY,
          fontWeight: 900,
          fontSize: 560,
          lineHeight: 1,
          letterSpacing: "-0.06em",
          color: "transparent",
          WebkitTextStroke: "2px rgba(255,255,255,0.07)",
          translate: `${interpolate(frame, [0, 144], [60, -40], clamp)}px 0`,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <Header project={project} index={index} />

      <AbsoluteFill style={{ scale: `${push}`, transformOrigin: "50% 70%" }}>
        {project.layout === "stack" && (
          <>
            <BrowserFrame
              slug={project.slug}
              url={project.url}
              imgH={project.desktopH}
              width={880}
              height={580}
              scroll={desktopScroll}
              style={{
                left: 40,
                top: 650,
                transform: `perspective(2200px) rotateY(14deg) rotateX(4deg) translateY(${(1 - enter(2)) * 500}px)`,
                opacity: enter(2),
              }}
            />
            <PhoneFrame
              slug={project.slug}
              width={330}
              scroll={phoneScroll}
              style={{
                left: 690,
                top: 860,
                translate: `0 ${(1 - enter(8)) * 700}px`,
                rotate: `${(1 - enter(8)) * 8 + 3}deg`,
              }}
            />
          </>
        )}

        {project.layout === "phone" && (
          <>
            <PhoneFrame
              slug={project.slug}
              width={400}
              scroll={phoneScroll}
              style={{
                left: 80,
                top: 640,
                translate: `0 ${(1 - enter(2)) * 800}px`,
                rotate: `${(1 - enter(2)) * -10 - 3}deg`,
              }}
            />
            <Tags project={project} start={20} />
          </>
        )}

        {project.layout === "tilt" && (
          <>
            <BrowserFrame
              slug={project.slug}
              url={project.url}
              imgH={project.desktopH}
              width={1000}
              height={660}
              scroll={desktopScroll}
              style={{
                left: 120,
                top: 660,
                transform: `perspective(1800px) rotateX(16deg) rotateY(-16deg) rotateZ(4deg) translateX(${(1 - enter(2)) * 900}px)`,
              }}
            />
            <PhoneFrame
              slug={project.slug}
              width={300}
              scroll={phoneScroll}
              style={{
                left: 70,
                top: 1500 - 300 * PHONE_RATIO + 40,
                translate: `${(1 - enter(10)) * -500}px 0`,
                rotate: `${-4 + (1 - enter(10)) * -8}deg`,
              }}
            />
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Header: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [4, 24], [0, 1], { ...clamp, easing: EASE });
  const sub = interpolate(frame, [16, 32], [0, 1], { ...clamp, easing: EASE });

  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 236 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.orange,
          opacity: line,
        }}
      >
        <div style={{ width: 18, height: 18, backgroundColor: C.orange }} />
        <span style={{ color: C.off, letterSpacing: "0.08em" }}>
          {String(index + 1).padStart(2, "0")} / {String(PROJECTS.length).padStart(2, "0")}
        </span>
        <div style={{ width: 70 * line, height: 2, backgroundColor: "rgba(255,255,255,0.3)" }} />
        {project.type}
      </div>
      <Words text={project.name} size={104} start={4} stagger={3} style={{ marginTop: 26 }} />
      <div
        style={{
          marginTop: 22,
          fontFamily: BODY,
          fontSize: 34,
          color: C.muted,
          opacity: sub,
          translate: `0 ${(1 - sub) * 16}px`,
        }}
      >
        {project.area}
      </div>
    </div>
  );
};

// Entregas do projeto, ao lado do celular no layout "phone".
const Tags: React.FC<{ project: Project; start: number }> = ({ project, start }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 540,
        right: 60,
        top: 760,
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: 24,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.muted,
          opacity: interpolate(frame, [start - 6, start + 6], [0, 1], clamp),
        }}
      >
        Entregas
      </div>
      {project.tags.map((tag, i) => {
        const p = interpolate(frame, [start + i * 7, start + i * 7 + 16], [0, 1], { ...clamp, easing: EASE });
        return (
          <div
            key={tag}
            style={{
              opacity: p,
              translate: `${(1 - p) * 80}px 0`,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "24px 28px",
              borderRadius: 22,
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 40,
              lineHeight: 1.05,
              color: C.off,
            }}
          >
            <div style={{ flex: "none", width: 16, height: 16, backgroundColor: C.orange }} />
            {tag}
          </div>
        );
      })}
    </div>
  );
};
