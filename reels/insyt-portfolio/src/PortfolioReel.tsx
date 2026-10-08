import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Background } from "./components/Background";
import { PROJECTS } from "./projects";
import { Brand } from "./scenes/Brand";
import { Cta } from "./scenes/Cta";
import { Hook } from "./scenes/Hook";
import { ProjectScene } from "./scenes/ProjectScene";
import { Values } from "./scenes/Values";
import { Wall } from "./scenes/Wall";
import { EASE, fontsLoaded } from "./theme";
import { BRAND_START, CLICK_AT, CTA_START, CUTS, DUR, TRANSITION } from "./timeline";

const timing = linearTiming({ durationInFrames: TRANSITION, easing: EASE });

export const PortfolioReel: React.FC = () => {
  const { fps } = useVideoConfig();
  const [handle] = useState(() => delayRender("Carregando fontes da marca"));
  useEffect(() => {
    fontsLoaded.then(() => continueRender(handle));
  }, [handle]);

  // Os sete projetos usam o mesmo template de cena, alternando a direção da
  // entrada para a sequência não ficar monótona.
  const projectItems = PROJECTS.flatMap((p, i) => [
    <TransitionSeries.Transition
      key={`t-${p.slug}`}
      presentation={slide({ direction: i % 2 === 0 ? "from-right" : "from-bottom" })}
      timing={timing}
    />,
    <TransitionSeries.Sequence
      key={p.slug}
      name={`Projeto ${i + 1} · ${p.slug}`}
      durationInFrames={DUR.project}
      premountFor={fps}
    >
      <ProjectScene index={i} />
    </TransitionSeries.Sequence>,
  ]);

  return (
    <AbsoluteFill>
      <Background />

      <TransitionSeries>
        <TransitionSeries.Sequence name="Gancho" durationInFrames={DUR.hook} premountFor={fps}>
          <Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
        <TransitionSeries.Sequence name="Marca" durationInFrames={DUR.brand} premountFor={fps}>
          <Brand />
        </TransitionSeries.Sequence>
        {projectItems}
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
        <TransitionSeries.Sequence name="Mural" durationInFrames={DUR.wall} premountFor={fps}>
          <Wall />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
        <TransitionSeries.Sequence name="Diferenciais" durationInFrames={DUR.values} premountFor={fps}>
          <Values />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
        <TransitionSeries.Sequence name="CTA" durationInFrames={DUR.cta} premountFor={fps}>
          <Cta />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Efeitos sonoros. A trilha fica para o Instagram (áudio em alta no
          app rende mais alcance e já vem licenciado). */}
      {CUTS.map((cut) => (
        <Sequence key={cut} name="Whoosh" from={cut - 2} durationInFrames={fps} premountFor={fps}>
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.45} />
        </Sequence>
      ))}
      <Sequence name="Monta símbolo" from={BRAND_START + 6} durationInFrames={fps} premountFor={fps}>
        <Audio src={staticFile("sfx/switch.wav")} volume={0.4} />
      </Sequence>
      <Sequence name="Clique CTA" from={CTA_START + CLICK_AT - 2} durationInFrames={fps} premountFor={fps}>
        <Audio src={staticFile("sfx/mouse-click.wav")} volume={0.7} />
      </Sequence>
      <Sequence name="Ding" from={CTA_START + CLICK_AT + 6} durationInFrames={2 * fps} premountFor={fps}>
        <Audio src={staticFile("sfx/ding.wav")} volume={0.35} />
      </Sequence>
    </AbsoluteFill>
  );
};
