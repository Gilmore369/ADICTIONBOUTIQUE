import { Composition } from "remotion";
import { PromoVideo } from "./PromoVideo";
import { VIDEO_DURATION_IN_FRAMES } from "./generatedVoiceTimeline";

export const RemotionRoot = () => {
  return (
    <Composition
      id="AdictionBoutiquePromo"
      component={PromoVideo}
      durationInFrames={VIDEO_DURATION_IN_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
