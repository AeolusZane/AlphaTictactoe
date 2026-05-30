import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

// 模拟训练数据
const trainingGames = [
  {
    moves: [4, 0, 8, 1, 6],
    winner: "X",
    mctsDistribution: [
      [0.12, 0.08, 0.10, 0.06, 0.45, 0.07, 0.04, 0.05, 0.03],
      [0.35, 0.15, 0.12, 0.08, 0.05, 0.10, 0.05, 0.06, 0.04],
      [0.08, 0.25, 0.15, 0.12, 0.05, 0.08, 0.15, 0.07, 0.05],
      [0.10, 0.08, 0.30, 0.15, 0.05, 0.12, 0.08, 0.07, 0.05],
      [0.05, 0.08, 0.10, 0.12, 0.05, 0.15, 0.35, 0.05, 0.05],
    ],
  },
  {
    moves: [4, 2, 6, 0, 8],
    winner: "X",
    mctsDistribution: [
      [0.10, 0.08, 0.12, 0.08, 0.42, 0.08, 0.04, 0.05, 0.03],
      [0.15, 0.10, 0.35, 0.10, 0.05, 0.08, 0.07, 0.06, 0.04],
      [0.10, 0.08, 0.08, 0.15, 0.05, 0.10, 0.32, 0.07, 0.05],
      [0.35, 0.08, 0.10, 0.12, 0.05, 0.10, 0.08, 0.07, 0.05],
      [0.05, 0.08, 0.10, 0.10, 0.05, 0.12, 0.10, 0.05, 0.35],
    ],
  },
];

export const TicTacToeTraining: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 动画阶段
  const titlePhase = frame < 3 * fps;
  const gamePhase = frame >= 3 * fps && frame < 25 * fps;
  const statsPhase = frame >= 25 * fps;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: "monospace" }}>
      {/* 标题 */}
      <Sequence from={0} durationInFrames={3 * fps}>
        <Title />
      </Sequence>

      {/* 对弈演示 */}
      <Sequence from={3 * fps} durationInFrames={22 * fps}>
        <GamePlaythrough gameIndex={0} />
      </Sequence>

      {/* 统计信息 */}
      <Sequence from={25 * fps} durationInFrames={5 * fps}>
        <TrainingStats />
      </Sequence>
    </AbsoluteFill>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 80,
          fontWeight: "bold",
          color: "#00ff88",
          transform: `scale(${scale})`,
          textShadow: "0 0 20px rgba(0, 255, 136, 0.5)",
        }}
      >
        AlphaGo 井字棋训练
      </div>
      <div
        style={{
          fontSize: 32,
          color: "#888",
          marginTop: 20,
        }}
      >
        神经网络 + 蒙特卡洛树搜索
      </div>
    </AbsoluteFill>
  );
};

const GamePlaythrough: React.FC<{ gameIndex: number }> = ({ gameIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const game = trainingGames[gameIndex];

  // 每步 4 秒
  const stepDuration = 4 * fps;
  const currentStep = Math.floor(frame / stepDuration);
  const stepFrame = frame % stepDuration;

  const board = Array(9).fill(null);
  for (let i = 0; i <= currentStep && i < game.moves.length; i++) {
    board[game.moves[i]] = i % 2 === 0 ? "X" : "O";
  }

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        padding: 60,
      }}
    >
      {/* 左侧：棋盘 */}
      <div style={{ flex: 1 }}>
        <Board board={board} currentStep={currentStep} />
      </div>

      {/* 右侧：MCTS 分布 */}
      <div style={{ flex: 1 }}>
        {currentStep < game.mctsDistribution.length && (
          <MCTSDistribution
            distribution={game.mctsDistribution[currentStep]}
            stepFrame={stepFrame}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

const Board: React.FC<{ board: (string | null)[]; currentStep: number }> = ({
  board,
  currentStep,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cellSize = 120;
  const gap = 10;

  return (
    <div>
      <div
        style={{
          fontSize: 28,
          color: "#00ff88",
          marginBottom: 20,
          fontWeight: "bold",
        }}
      >
        第 {currentStep + 1} 步
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: gap,
          backgroundColor: "#333",
          padding: gap,
          borderRadius: 10,
        }}
      >
        {board.map((cell, i) => {
          const isNew = cell !== null && board.slice(0, i).filter(Boolean).length === Math.floor(currentStep / 2);
          const scale = isNew
            ? spring({
                frame: frame % (4 * fps),
                fps,
                config: { damping: 15, stiffness: 200 },
              })
            : 1;

          return (
            <div
              key={i}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: "#1a1a1a",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: 60,
                fontWeight: "bold",
                color: cell === "X" ? "#00ff88" : "#ff6b6b",
                transform: `scale(${scale})`,
                borderRadius: 8,
              }}
            >
              {cell}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MCTSDistribution: React.FC<{
  distribution: number[];
  stepFrame: number;
}> = ({ distribution, stepFrame }) => {
  const { fps } = useVideoConfig();

  const maxProb = Math.max(...distribution);

  return (
    <div>
      <div
        style={{
          fontSize: 28,
          color: "#00ff88",
          marginBottom: 20,
          fontWeight: "bold",
        }}
      >
        MCTS 搜索分布
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {distribution.map((prob, i) => {
          const animatedProb = interpolate(
            stepFrame,
            [0, fps],
            [0, prob],
            { extrapolateRight: "clamp" }
          );

          const barHeight = (animatedProb / maxProb) * 100;
          const isMax = prob === maxProb;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: 120,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: `${barHeight}%`,
                  backgroundColor: isMax ? "#00ff88" : "#444",
                  borderRadius: 4,
                  transition: "height 0.1s",
                }}
              />
              <div
                style={{
                  fontSize: 16,
                  color: isMax ? "#00ff88" : "#888",
                  marginTop: 8,
                  fontWeight: isMax ? "bold" : "normal",
                }}
              >
                {(animatedProb * 100).toFixed(0)}%
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#666",
                  marginTop: 4,
                }}
              >
                位置 {i}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TrainingStats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const stats = [
    { label: "训练局数", value: "200", color: "#00ff88" },
    { label: "黑棋胜率", value: "52%", color: "#00ff88" },
    { label: "白棋胜率", value: "38%", color: "#ff6b6b" },
    { label: "平局率", value: "10%", color: "#888" },
    { label: "平均损失", value: "0.847", color: "#ffaa00" },
  ];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 48,
          color: "#00ff88",
          marginBottom: 40,
          fontWeight: "bold",
        }}
      >
        训练统计
      </div>
      <div
        style={{
          display: "flex",
          gap: 40,
        }}
      >
        {stats.map((stat, i) => {
          const delay = i * 10;
          const scale = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 100 },
          });

          return (
            <div
              key={i}
              style={{
                backgroundColor: "#1a1a1a",
                padding: 30,
                borderRadius: 12,
                minWidth: 180,
                textAlign: "center",
                transform: `scale(${scale})`,
                border: `2px solid ${stat.color}`,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  fontWeight: "bold",
                  color: stat.color,
                  marginBottom: 10,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: "#888",
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
