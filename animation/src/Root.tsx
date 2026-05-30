import { Composition } from "remotion";
import { TicTacToeTraining } from "./TicTacToeTraining";

export const RemotionRoot = () => {
  return (
    <Composition
      id="AlphaGoTicTacToe"
      component={TicTacToeTraining}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
