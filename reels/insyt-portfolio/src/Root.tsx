import { Composition } from "remotion";
import { PortfolioReel } from "./PortfolioReel";
import { FPS, TOTAL } from "./timeline";

// Reels: 1080×1920 (9:16), 30 fps. Duração calculada em timeline.ts (~51s).
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PortfolioReel"
      component={PortfolioReel}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
