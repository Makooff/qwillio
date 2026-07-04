import { Composition } from 'remotion';
import { QwillioAd } from './QwillioAd';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="QwillioAd"
        component={QwillioAd}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
