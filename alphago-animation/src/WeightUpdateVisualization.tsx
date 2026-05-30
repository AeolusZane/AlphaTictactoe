import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Audio, staticFile } from "remotion";

// 网络结构定义
const NETWORK = {
  input: 3,
  hidden: 4,
  output: 2,
};

// 神经元位置计算
const getNeuronPositions = (count: number, x: number, canvasHeight: number) => {
  const positions = [];
  const spacing = canvasHeight / (count + 1);
  for (let i = 0; i < count; i++) {
    positions.push({ x, y: spacing * (i + 1) });
  }
  return positions;
};

// 权重数据（模拟训练过程）
const initialWeights = {
  inputHidden: [
    [0.1, -0.3, 0.5, 0.2],
    [-0.4, 0.6, -0.1, 0.3],
    [0.2, -0.5, 0.4, -0.2],
  ],
  hiddenOutput: [
    [0.3, -0.4],
    [-0.2, 0.5],
    [0.6, -0.1],
    [-0.3, 0.2],
  ],
};

const updatedWeights = {
  inputHidden: [
    [0.15, -0.25, 0.55, 0.25],
    [-0.35, 0.65, -0.05, 0.35],
    [0.25, -0.45, 0.45, -0.15],
  ],
  hiddenOutput: [
    [0.35, -0.35],
    [-0.15, 0.55],
    [0.65, -0.05],
    [-0.25, 0.25],
  ],
};

// 梯度数据（模拟）
const gradients = {
  inputHidden: [
    [0.05, 0.05, 0.05, 0.05],
    [0.05, 0.05, 0.05, 0.05],
    [0.05, 0.05, 0.05, 0.05],
  ],
  hiddenOutput: [
    [0.05, 0.05],
    [0.05, 0.05],
    [0.05, 0.05],
    [0.05, 0.05],
  ],
};

// 损失值序列（多轮训练）
const lossSequence = [0.85, 0.72, 0.58, 0.45, 0.35, 0.28, 0.22, 0.18, 0.15, 0.12];

// 颜色工具函数
const weightToColor = (weight: number, opacity: number = 1) => {
  const absWeight = Math.abs(weight);
  const intensity = Math.min(absWeight * 2, 1);
  if (weight > 0) {
    return `rgba(76, 175, 80, ${intensity * opacity})`; // 绿色 = 正权重
  } else {
    return `rgba(244, 67, 54, ${intensity * opacity})`; // 红色 = 负权重
  }
};

const weightToWidth = (weight: number) => {
  return Math.max(1, Math.abs(weight) * 8);
};

// 神经元组件
const Neuron: React.FC<{
  x: number;
  y: number;
  label?: string;
  active?: boolean;
  activation?: number;
  color?: string;
}> = ({ x, y, label, active = false, activation = 0, color = "#666" }) => {
  const radius = 25;
  const glowOpacity = active ? 0.6 : 0;
  const fillColor = active ? color : "#1a1a1a";
  const borderColor = active ? color : "#444";

  return (
    <g>
      {/* 发光效果 */}
      {active && (
        <circle
          cx={x}
          cy={y}
          r={radius + 10}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={glowOpacity}
        />
      )}
      {/* 神经元圆圈 */}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={2}
      />
      {/* 激活值 */}
      {active && (
        <text
          x={x}
          y={y + 5}
          textAnchor="middle"
          fill="white"
          fontSize={14}
          fontFamily="monospace"
        >
          {activation.toFixed(2)}
        </text>
      )}
      {/* 标签 */}
      {label && (
        <text
          x={x}
          y={y + radius + 20}
          textAnchor="middle"
          fill="#888"
          fontSize={12}
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
};

// 连接线组件
const Connection: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: number;
  showGradient?: boolean;
  gradientValue?: number;
  highlight?: boolean;
}> = ({ x1, y1, x2, y2, weight, showGradient = false, gradientValue = 0, highlight = false }) => {
  const color = weightToColor(weight, highlight ? 1 : 0.6);
  const width = weightToWidth(weight);

  return (
    <g>
      {/* 连接线 */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      {/* 梯度标注 */}
      {showGradient && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 10}
          textAnchor="middle"
          fill="#FFD700"
          fontSize={10}
          fontFamily="monospace"
        >
          {gradientValue > 0 ? "+" : ""}{gradientValue.toFixed(3)}
        </text>
      )}
    </g>
  );
};

// 数据流动粒子
const DataParticle: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  color?: string;
}> = ({ x1, y1, x2, y2, progress, color = "#4CAF50" }) => {
  const x = x1 + (x2 - x1) * progress;
  const y = y1 + (y2 - y1) * progress;

  return (
    <circle
      cx={x}
      cy={y}
      r={6}
      fill={color}
      opacity={0.8}
    />
  );
};

// 主组件
export const WeightUpdateVisualization: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // 场景时间轴（秒）- 根据音频时长调整
  const scenes = {
    title: { start: 0, end: 8 },
    intro: { start: 8, end: 27 },
    forward: { start: 27, end: 45 },
    loss: { start: 45, end: 62 },
    backward: { start: 62, end: 80 },
    update: { start: 80, end: 99 },
    iterate: { start: 99, end: 117 },
    summary: { start: 117, end: 132 },
  };

  const currentScene = Object.entries(scenes).find(
    ([, { start, end }]) => frame >= start * fps && frame < end * fps
  )?.[0] || "summary";

  const sceneFrame = frame - (scenes[currentScene as keyof typeof scenes]?.start || 0) * fps;
  const sceneDuration = ((scenes[currentScene as keyof typeof scenes]?.end || 105) - (scenes[currentScene as keyof typeof scenes]?.start || 0)) * fps;

  // 神经元位置
  const inputPositions = getNeuronPositions(NETWORK.input, 200, height);
  const hiddenPositions = getNeuronPositions(NETWORK.hidden, 500, height);
  const outputPositions = getNeuronPositions(NETWORK.output, 800, height);

  // 动画进度
  const forwardProgress = currentScene === "forward" ? sceneFrame / sceneDuration : currentScene > "forward" ? 1 : 0;
  const backwardProgress = currentScene === "backward" ? sceneFrame / sceneDuration : currentScene > "backward" ? 1 : 0;
  const updateProgress = currentScene === "update" ? sceneFrame / sceneDuration : currentScene > "update" ? 1 : 0;

  // 当前权重（插值）
  const currentWeights = {
    inputHidden: initialWeights.inputHidden.map((row, i) =>
      row.map((w, j) => w + (updatedWeights.inputHidden[i][j] - w) * updateProgress)
    ),
    hiddenOutput: initialWeights.hiddenOutput.map((row, i) =>
      row.map((w, j) => w + (updatedWeights.hiddenOutput[i][j] - w) * updateProgress)
    ),
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: "monospace" }}>
      {/* 背景音乐 */}
      <Audio src={staticFile("audio/bgm.mp3")} volume={0.2} />

      {/* 配音 - 根据实际音频时长 */}
      <Sequence from={0} durationInFrames={8 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-title.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={8 * fps} durationInFrames={19 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-intro.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={27 * fps} durationInFrames={18 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-forward.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={45 * fps} durationInFrames={17 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-loss.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={62 * fps} durationInFrames={18 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-backward.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={80 * fps} durationInFrames={19 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-update.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={99 * fps} durationInFrames={18 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-training.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={117 * fps} durationInFrames={15 * fps}>
        <Audio src={staticFile("audio/weight-update/narration-summary.mp3")} volume={1.0} />
      </Sequence>

      {/* 标题场景 */}
      {currentScene === "title" && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{
            fontSize: 72,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            opacity: interpolate(sceneFrame, [0, fps], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            神经网络如何学习？
          </div>
          <div style={{
            fontSize: 36,
            color: "#888",
            marginTop: 30,
            opacity: interpolate(sceneFrame, [fps, 2 * fps], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            权重更新可视化
          </div>
        </AbsoluteFill>
      )}

      {/* 网络可视化（intro 及之后的场景） */}
      {currentScene !== "title" && (
        <AbsoluteFill>
          <svg width="100%" height="100%" viewBox="0 0 1000 600">
            {/* 层标签 */}
            <text x={200} y={50} textAnchor="middle" fill="#888" fontSize={18}>输入层</text>
            <text x={500} y={50} textAnchor="middle" fill="#888" fontSize={18}>隐藏层</text>
            <text x={800} y={50} textAnchor="middle" fill="#888" fontSize={18}>输出层</text>

            {/* 连接线 - 输入到隐藏 */}
            {inputPositions.map((input, i) =>
              hiddenPositions.map((hidden, j) => (
                <Connection
                  key={`ih-${i}-${j}`}
                  x1={input.x}
                  y1={input.y}
                  x2={hidden.x}
                  y2={hidden.y}
                  weight={currentWeights.inputHidden[i][j]}
                  showGradient={currentScene === "backward" && backwardProgress > 0.3}
                  gradientValue={gradients.inputHidden[i][j]}
                  highlight={currentScene === "update"}
                />
              ))
            )}

            {/* 连接线 - 隐藏到输出 */}
            {hiddenPositions.map((hidden, i) =>
              outputPositions.map((output, j) => (
                <Connection
                  key={`ho-${i}-${j}`}
                  x1={hidden.x}
                  y1={hidden.y}
                  x2={output.x}
                  y2={output.y}
                  weight={currentWeights.hiddenOutput[i][j]}
                  showGradient={currentScene === "backward" && backwardProgress > 0.6}
                  gradientValue={gradients.hiddenOutput[i][j]}
                  highlight={currentScene === "update"}
                />
              ))
            )}

            {/* 前向传播粒子 */}
            {currentScene === "forward" && forwardProgress < 0.5 && inputPositions.map((input, i) =>
              hiddenPositions.map((hidden, j) => (
                <DataParticle
                  key={`fp-ih-${i}-${j}`}
                  x1={input.x}
                  y1={input.y}
                  x2={hidden.x}
                  y2={hidden.y}
                  progress={forwardProgress * 2}
                  color="#4CAF50"
                />
              ))
            )}
            {currentScene === "forward" && forwardProgress >= 0.5 && hiddenPositions.map((hidden, i) =>
              outputPositions.map((output, j) => (
                <DataParticle
                  key={`fp-ho-${i}-${j}`}
                  x1={hidden.x}
                  y1={hidden.y}
                  x2={output.x}
                  y2={output.y}
                  progress={(forwardProgress - 0.5) * 2}
                  color="#4CAF50"
                />
              ))
            )}

            {/* 反向传播粒子 */}
            {currentScene === "backward" && backwardProgress < 0.5 && outputPositions.map((output, j) =>
              hiddenPositions.map((hidden, i) => (
                <DataParticle
                  key={`bp-ho-${i}-${j}`}
                  x1={output.x}
                  y1={output.y}
                  x2={hidden.x}
                  y2={hidden.y}
                  progress={backwardProgress * 2}
                  color="#FFD700"
                />
              ))
            )}
            {currentScene === "backward" && backwardProgress >= 0.5 && hiddenPositions.map((hidden, j) =>
              inputPositions.map((input, i) => (
                <DataParticle
                  key={`bp-ih-${i}-${j}`}
                  x1={hidden.x}
                  y1={hidden.y}
                  x2={input.x}
                  y2={input.y}
                  progress={(backwardProgress - 0.5) * 2}
                  color="#FFD700"
                />
              ))
            )}

            {/* 输入神经元 */}
            {inputPositions.map((pos, i) => (
              <Neuron
                key={`input-${i}`}
                x={pos.x}
                y={pos.y}
                label={`x${i + 1}`}
                active={currentScene !== "title"}
                activation={[1.0, 0.0, -1.0][i]}
                color="#2196F3"
              />
            ))}

            {/* 隐藏神经元 */}
            {hiddenPositions.map((pos, i) => (
              <Neuron
                key={`hidden-${i}`}
                x={pos.x}
                y={pos.y}
                label={`h${i + 1}`}
                active={forwardProgress > 0.3}
                activation={[0.45, 0.12, 0.67, -0.23][i]}
                color="#9C27B0"
              />
            ))}

            {/* 输出神经元 */}
            {outputPositions.map((pos, i) => (
              <Neuron
                key={`output-${i}`}
                x={pos.x}
                y={pos.y}
                label={i === 0 ? "策略" : "价值"}
                active={forwardProgress > 0.7}
                activation={[0.72, 0.35][i]}
                color="#FF5722"
              />
            ))}
          </svg>

          {/* 场景说明文字 */}
          <div style={{
            position: "absolute",
            bottom: 50,
            left: 50,
            right: 50,
            padding: 20,
            backgroundColor: "rgba(26, 26, 26, 0.9)",
            borderRadius: 12,
            border: "1px solid #333",
          }}>
            {currentScene === "intro" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>认识权重</div>
                <div style={{ color: "#ccc" }}>
                  每条连线都有一个"权重"值。<span style={{ color: "#4CAF50" }}>绿色 = 正权重</span>（鼓励信号通过），
                  <span style={{ color: "#F44336" }}>红色 = 负权重</span>（抑制信号）。
                  线条越粗，权重越大。
                </div>
              </div>
            )}
            {currentScene === "forward" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>前向传播：数据流过网络</div>
                <div style={{ color: "#ccc" }}>
                  输入数据从左到右流过网络。每个神经元把输入乘以权重、加起来，再通过激活函数输出。
                  最终得到预测结果。
                </div>
              </div>
            )}
            {currentScene === "loss" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>计算损失：预测和目标的差距</div>
                <div style={{ color: "#ccc" }}>
                  把网络的预测和正确答案对比，算出"差距有多大"。这个差距就是损失（Loss）。
                  损失越大，说明预测越差。
                </div>
                <div style={{ marginTop: 15, fontSize: 32, color: "#FF5722", fontWeight: "bold" }}>
                  Loss = 0.85
                </div>
              </div>
            )}
            {currentScene === "backward" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>反向传播：计算梯度</div>
                <div style={{ color: "#ccc" }}>
                  从输出往回推，算出每个权重对损失的"贡献"——这就是梯度。
                  梯度告诉我们：这个权重应该往哪个方向调、调多少。
                </div>
              </div>
            )}
            {currentScene === "update" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>更新权重</div>
                <div style={{ color: "#ccc" }}>
                  根据梯度调整每个权重：梯度为正就减小，梯度为负就增大。
                  调整幅度由学习率控制。更新后，损失会变小，预测会更准。
                </div>
              </div>
            )}
            {currentScene === "iterate" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>反复训练</div>
                <div style={{ color: "#ccc" }}>
                  重复这个过程成千上万次，每次损失都变小一点，权重越来越准，
                  网络就"学会"了下棋。
                </div>
              </div>
            )}
            {currentScene === "summary" && (
              <div style={{ color: "white", fontSize: 24 }}>
                <div style={{ fontWeight: "bold", marginBottom: 10 }}>总结</div>
                <div style={{ color: "#ccc" }}>
                  前向传播 → 计算损失 → 反向传播 → 更新权重。
                  这四步就是神经网络"学习"的全部过程。
                </div>
              </div>
            )}
          </div>

          {/* 损失曲线（iterate 场景） */}
          {currentScene === "iterate" && (
            <div style={{
              position: "absolute",
              top: 80,
              right: 50,
              width: 300,
              height: 200,
              backgroundColor: "rgba(26, 26, 26, 0.9)",
              borderRadius: 12,
              border: "1px solid #333",
              padding: 20,
            }}>
              <div style={{ color: "#888", fontSize: 14, marginBottom: 10 }}>损失曲线</div>
              <svg width="260" height="140" viewBox="0 0 260 140">
                {/* 坐标轴 */}
                <line x1={30} y1={10} x2={30} y2={120} stroke="#444" strokeWidth={1} />
                <line x1={30} y1={120} x2={250} y2={120} stroke="#444" strokeWidth={1} />
                <text x={15} y={15} fill="#888" fontSize={10}>1.0</text>
                <text x={15} y={120} fill="#888" fontSize={10}>0</text>
                <text x={240} y={135} fill="#888" fontSize={10}>轮</text>

                {/* 损失曲线 */}
                <polyline
                  points={lossSequence.map((loss, i) => {
                    const x = 30 + (i / (lossSequence.length - 1)) * 220;
                    const y = 120 - loss * 110;
                    const progress = sceneFrame / sceneDuration;
                    const visiblePoints = Math.floor(progress * lossSequence.length);
                    return i <= visiblePoints ? `${x},${y}` : null;
                  }).filter(Boolean).join(" ")}
                  fill="none"
                  stroke="#4CAF50"
                  strokeWidth={2}
                />

                {/* 数据点 */}
                {lossSequence.map((loss, i) => {
                  const x = 30 + (i / (lossSequence.length - 1)) * 220;
                  const y = 120 - loss * 110;
                  const progress = sceneFrame / sceneDuration;
                  const visiblePoints = Math.floor(progress * lossSequence.length);
                  return i <= visiblePoints ? (
                    <circle key={i} cx={x} cy={y} r={3} fill="#4CAF50" />
                  ) : null;
                })}
              </svg>
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
