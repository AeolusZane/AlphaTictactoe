import { Composition } from "remotion";
import { TicTacToeTraining } from "./TicTacToeTraining";
import { WeightUpdateVisualization } from "./WeightUpdateVisualization";
import { MCTSVisualization } from "./MCTSVisualization";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="AlphaGoTicTacToe"
        component={TicTacToeTraining}
        durationInFrames={3360}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="WeightUpdate"
        component={WeightUpdateVisualization}
        durationInFrames={3150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="MCTSVisualization"
        component={MCTSVisualization}
        durationInFrames={3600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
