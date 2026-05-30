import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Audio, staticFile } from "remotion";

// ============================================================
// 网络结构
// ============================================================
const NETWORK = { input: 3, hidden: 4, output: 2 };

// ============================================================
// 布局常量（基于 1920x1080 画布）
// ============================================================
const CANVAS_W = 1920;
const CANVAS_H = 1080;

// 网络图区域：上方 70% 空间，留出底部说明文字区域
const NET_TOP = 80;
const NET_BOTTOM = 700;
const NET_HEIGHT = NET_BOTTOM - NET_TOP;

// 三列 X 坐标
const COL_INPUT = 350;
const COL_HIDDEN = 960;
const COL_OUTPUT = 1570;

// ============================================================
// 神经元位置计算（在 NET_TOP ~ NET_BOTTOM 之间均匀分布）
// ============================================================
const getNeuronPositions = (count: number, x: number) => {
  const positions = [];
  const spacing = NET_HEIGHT / (count + 1);
  for (let i = 0; i < count; i++) {
    positions.push({ x, y: NET_TOP + spacing * (i + 1) });
  }
  return positions;
};

// ============================================================
// 权重数据
// ============================================================
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

// 梯度数据
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

// 损失值序列
const lossSequence = [0.85, 0.72, 0.58, 0.45, 0.35, 0.28, 0.22, 0.18, 0.15, 0.12];

// ============================================================
// 颜色工具
// ============================================================
// 连线颜色：正权重 = 绿色，负权重 = 红色
const weightToColor = (weight: number, opacity: number = 1) => {
  const absWeight = Math.abs(weight);
  const intensity = Math.min(absWeight * 2.5, 1);
  if (weight > 0) {
    return `rgba(76, 175, 80, ${intensity * opacity})`;
  } else if (weight < 0) {
    return `rgba(244, 67, 54, ${intensity * opacity})`;
  }
  return `rgba(150, 150, 150, ${0.3 * opacity})`;
};

const weightToWidth = (weight: number) => {
  return Math.max(1.5, Math.abs(weight) * 10);
};

// ============================================================
// 神经元组件
// ============================================================
const Neuron: React.FC<{
  x: number;
  y: number;
  label?: string;
  active?: boolean;
  activation?: number;
  neuronColor?: string;
}> = ({ x, y, label, active = false, activation = 0, neuronColor = "#666" }) => {
  const radius = 32;
  const glowOpacity = active ? 0.5 : 0;
  const fillColor = active ? "#1a1a1a" : "#111";
  const borderColor = active ? neuronColor : "#444";

  return (
    <g>
      {active && (
        <circle cx={x} cy={y} r={radius + 12} fill="none" stroke={neuronColor} strokeWidth={2} opacity={glowOpacity} />
      )}
      <circle cx={x} cy={y} r={radius} fill={fillColor} stroke={borderColor} strokeWidth={2.5} />
      {active && (
        <text x={x} y={y + 6} textAnchor="middle" fill="white" fontSize={16} fontFamily="monospace" fontWeight="bold">
          {activation.toFixed(2)}
        </text>
      )}
      {label && (
        <text x={x} y={y + radius + 24} textAnchor="middle" fill="#999" fontSize={14} fontFamily="monospace">
          {label}
        </text>
      )}
    </g>
  );
};

// ============================================================
// 连接线组件
// ============================================================
const Connection: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  weight: number;
  showGradient?: boolean;
  gradientValue?: number;
  highlight?: boolean;
}> = ({ x1, y1, x2, y2, weight, showGradient = false, gradientValue = 0, highlight = false }) => {
  const color = weightToColor(weight, highlight ? 1 : 0.7);
  const width = weightToWidth(weight);

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      {showGradient && (
        <g>
          <rect
            x={(x1 + x2) / 2 - 28}
            y={(y1 + y2) / 2 - 18}
            width={56}
            height={20}
            rx={4}
            fill="rgba(0,0,0,0.8)"
            stroke="#FFD700"
            strokeWidth={1}
          />
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 4}
            textAnchor="middle"
            fill="#FFD700"
            fontSize={12}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {gradientValue > 0 ? "+" : ""}{gradientValue.toFixed(3)}
          </text>
        </g>
      )}
    </g>
  );
};

// ============================================================
// 数据流粒子
// ============================================================
const DataParticle: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  progress: number;
  color?: string;
}> = ({ x1, y1, x2, y2, progress, color = "#4CAF50" }) => {
  const x = x1 + (x2 - x1) * progress;
  const y = y1 + (y2 - y1) * progress;
  return (
    <g>
      <circle cx={x} cy={y} r={8} fill={color} opacity={0.3} />
      <circle cx={x} cy={y} r={5} fill={color} opacity={0.9} />
    </g>
  );
};

// ============================================================
// 主组件
// ============================================================
export const WeightUpdateVisualization: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 场景时间轴（秒）
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

  const sceneStart = scenes[currentScene as keyof typeof scenes]?.start || 0;
  const sceneEnd = scenes[currentScene as keyof typeof scenes]?.end || 132;
  const sceneFrame = frame - sceneStart * fps;
  const sceneDuration = (sceneEnd - sceneStart) * fps;

  // 神经元位置（基于 1920x1080 画布）
  const inputPositions = getNeuronPositions(NETWORK.input, COL_INPUT);
  const hiddenPositions = getNeuronPositions(NETWORK.hidden, COL_HIDDEN);
  const outputPositions = getNeuronPositions(NETWORK.output, COL_OUTPUT);

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

  // 场景顺序索引
  const sceneOrder = ["title", "intro", "forward", "loss", "backward", "update", "iterate", "summary"];
  const sceneIndex = sceneOrder.indexOf(currentScene);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: "monospace" }}>
      {/* 背景音乐 */}
      <Audio src={staticFile("audio/bgm.mp3")} volume={0.15} />

      {/* 配音 */}
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

      {/* ==================== 标题场景 ==================== */}
      {currentScene === "title" && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{
            fontSize: 80,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            opacity: interpolate(sceneFrame, [0, fps], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            神经网络如何学习？
          </div>
          <div style={{
            fontSize: 40,
            color: "#888",
            marginTop: 30,
            opacity: interpolate(sceneFrame, [fps, 2 * fps], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            权重更新可视化
          </div>
        </AbsoluteFill>
      )}

      {/* ==================== 网络可视化（intro 及之后） ==================== */}
      {currentScene !== "title" && (
        <AbsoluteFill>
          <svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
            {/* 层标签 */}
            <text x={COL_INPUT} y={50} textAnchor="middle" fill="#aaa" fontSize={22} fontWeight="bold">输入层</text>
            <text x={COL_HIDDEN} y={50} textAnchor="middle" fill="#aaa" fontSize={22} fontWeight="bold">隐藏层</text>
            <text x={COL_OUTPUT} y={50} textAnchor="middle" fill="#aaa" fontSize={22} fontWeight="bold">输出层</text>

            {/* ---- 连接线：输入→隐藏 ---- */}
            {inputPositions.map((input, i) =>
              hiddenPositions.map((hidden, j) => (
                <Connection
                  key={`ih-${i}-${j}`}
                  x1={input.x} y1={input.y}
                  x2={hidden.x} y2={hidden.y}
                  weight={currentWeights.inputHidden[i][j]}
                  showGradient={currentScene === "backward" && backwardProgress > 0.3}
                  gradientValue={gradients.inputHidden[i][j]}
                  highlight={currentScene === "update"}
                />
              ))
            )}

            {/* ---- 连接线：隐藏→输出 ---- */}
            {hiddenPositions.map((hidden, i) =>
              outputPositions.map((output, j) => (
                <Connection
                  key={`ho-${i}-${j}`}
                  x1={hidden.x} y1={hidden.y}
                  x2={output.x} y2={output.y}
                  weight={currentWeights.hiddenOutput[i][j]}
                  showGradient={currentScene === "backward" && backwardProgress > 0.6}
                  gradientValue={gradients.hiddenOutput[i][j]}
                  highlight={currentScene === "update"}
                />
              ))
            )}

            {/* ---- 前向传播粒子 ---- */}
            {currentScene === "forward" && forwardProgress < 0.5 && inputPositions.map((input, i) =>
              hiddenPositions.map((hidden, j) => (
                <DataParticle
                  key={`fp-ih-${i}-${j}`}
                  x1={input.x} y1={input.y} x2={hidden.x} y2={hidden.y}
                  progress={forwardProgress * 2}
                  color="#4CAF50"
                />
              ))
            )}
            {currentScene === "forward" && forwardProgress >= 0.5 && hiddenPositions.map((hidden, i) =>
              outputPositions.map((output, j) => (
                <DataParticle
                  key={`fp-ho-${i}-${j}`}
                  x1={hidden.x} y1={hidden.y} x2={output.x} y2={output.y}
                  progress={(forwardProgress - 0.5) * 2}
                  color="#4CAF50"
                />
              ))
            )}

            {/* ---- 反向传播粒子（金色） ---- */}
            {currentScene === "backward" && backwardProgress < 0.5 && outputPositions.map((output, j) =>
              hiddenPositions.map((hidden, i) => (
                <DataParticle
                  key={`bp-ho-${i}-${j}`}
                  x1={output.x} y1={output.y} x2={hidden.x} y2={hidden.y}
                  progress={backwardProgress * 2}
                  color="#FFD700"
                />
              ))
            )}
            {currentScene === "backward" && backwardProgress >= 0.5 && hiddenPositions.map((hidden, j) =>
              inputPositions.map((input, i) => (
                <DataParticle
                  key={`bp-ih-${i}-${j}`}
                  x1={hidden.x} y1={hidden.y} x2={input.x} y2={input.y}
                  progress={(backwardProgress - 0.5) * 2}
                  color="#FFD700"
                />
              ))
            )}

            {/* ---- 输入神经元（蓝色） ---- */}
            {inputPositions.map((pos, i) => (
              <Neuron
                key={`input-${i}`}
                x={pos.x} y={pos.y}
                label={`x${i + 1}`}
                active={sceneIndex >= 1}
                activation={[1.0, 0.0, -1.0][i]}
                neuronColor="#2196F3"
              />
            ))}

            {/* ---- 隐藏神经元（紫色） ---- */}
            {hiddenPositions.map((pos, i) => (
              <Neuron
                key={`hidden-${i}`}
                x={pos.x} y={pos.y}
                label={`h${i + 1}`}
                active={forwardProgress > 0.3}
                activation={[0.45, 0.12, 0.67, -0.23][i]}
                neuronColor="#9C27B0"
              />
            ))}

            {/* ---- 输出神经元（橙色） ---- */}
            {outputPositions.map((pos, i) => (
              <Neuron
                key={`output-${i}`}
                x={pos.x} y={pos.y}
                label={i === 0 ? "策略" : "价值"}
                active={forwardProgress > 0.7}
                activation={[0.72, 0.35][i]}
                neuronColor="#FF5722"
              />
            ))}

            {/* ---- 图例（intro 场景显示） ---- */}
            {currentScene === "intro" && (
              <g>
                <rect x={700} y={NET_BOTTOM + 30} width={520} height={80} rx={10} fill="rgba(26,26,26,0.95)" stroke="#333" strokeWidth={1} />
                {/* 正权重示例 */}
                <line x1={730} y1={NET_BOTTOM + 60} x2={800} y2={NET_BOTTOM + 60} stroke="#4CAF50" strokeWidth={4} />
                <text x={815} y={NET_BOTTOM + 65} fill="#ccc" fontSize={16} fontFamily="monospace">= 正权重（鼓励信号通过）</text>
                {/* 负权重示例 */}
                <line x1={730} y1={NET_BOTTOM + 90} x2={800} y2={NET_BOTTOM + 90} stroke="#F44336" strokeWidth={4} />
                <text x={815} y={NET_BOTTOM + 95} fill="#ccc" fontSize={16} fontFamily="monospace">= 负权重（抑制信号通过）</text>
              </g>
            )}

            {/* ---- 损失值显示（loss 场景） ---- */}
            {currentScene === "loss" && (
              <g>
                <rect x={COL_OUTPUT + 80} y={NET_TOP + 50} width={200} height={100} rx={12} fill="rgba(26,26,26,0.95)" stroke="#FF5722" strokeWidth={2} />
                <text x={COL_OUTPUT + 180} y={NET_TOP + 90} textAnchor="middle" fill="#888" fontSize={16} fontFamily="monospace">损失 (Loss)</text>
                <text x={COL_OUTPUT + 180} y={NET_TOP + 130} textAnchor="middle" fill="#FF5722" fontSize={36} fontFamily="monospace" fontWeight="bold">0.85</text>
              </g>
            )}

            {/* ---- 损失曲线（iterate 场景） ---- */}
            {currentScene === "iterate" && (
              <g>
                <rect x={1400} y={NET_TOP} width={460} height={280} rx={12} fill="rgba(26,26,26,0.95)" stroke="#333" strokeWidth={1} />
                <text x={1430} y={NET_TOP + 30} fill="#aaa" fontSize={16} fontFamily="monospace" fontWeight="bold">损失曲线</text>
                {/* 坐标轴 */}
                <line x1={1460} y1={NET_TOP + 50} x2={1460} y2={NET_TOP + 240} stroke="#555" strokeWidth={1} />
                <line x1={1460} y1={NET_TOP + 240} x2={1820} y2={NET_TOP + 240} stroke="#555" strokeWidth={1} />
                <text x={1440} y={NET_TOP + 55} fill="#888" fontSize={12} textAnchor="end">1.0</text>
                <text x={1440} y={NET_TOP + 245} fill="#888" fontSize={12} textAnchor="end">0</text>
                <text x={1820} y={NET_TOP + 260} fill="#888" fontSize={12} textAnchor="end">训练轮次</text>

                {/* 曲线 */}
                {(() => {
                  const progress = sceneFrame / sceneDuration;
                  const visiblePoints = Math.max(1, Math.floor(progress * lossSequence.length));
                  const points = lossSequence.slice(0, visiblePoints).map((loss, i) => {
                    const x = 1460 + (i / (lossSequence.length - 1)) * 360;
                    const y = NET_TOP + 240 - loss * 190;
                    return `${x},${y}`;
                  }).join(" ");
                  return (
                    <>
                      <polyline points={points} fill="none" stroke="#4CAF50" strokeWidth={3} />
                      {lossSequence.slice(0, visiblePoints).map((loss, i) => {
                        const x = 1460 + (i / (lossSequence.length - 1)) * 360;
                        const y = NET_TOP + 240 - loss * 190;
                        return <circle key={i} cx={x} cy={y} r={4} fill="#4CAF50" />;
                      })}
                    </>
                  );
                })()}
              </g>
            )}
          </svg>

          {/* ==================== 底部说明文字 ==================== */}
          <div style={{
            position: "absolute",
            bottom: 40,
            left: 60,
            right: 60,
            padding: "20px 30px",
            backgroundColor: "rgba(15, 15, 15, 0.95)",
            borderRadius: 12,
            border: "1px solid #333",
          }}>
            {currentScene === "intro" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#fff" }}>认识权重</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  每条连线都有一个"权重"值。
                  <span style={{ color: "#4CAF50", fontWeight: "bold" }}> 绿色连线 = 正权重</span>（鼓励信号通过），
                  <span style={{ color: "#F44336", fontWeight: "bold" }}> 红色连线 = 负权重</span>（抑制信号）。
                  线条越粗，权重的绝对值越大。
                </div>
              </div>
            )}
            {currentScene === "forward" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#4CAF50" }}>前向传播：数据流过网络</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  输入数据从左到右流过网络。每个神经元把输入乘以权重、加起来，再通过激活函数输出。最终得到预测结果。
                </div>
              </div>
            )}
            {currentScene === "loss" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#FF5722" }}>计算损失：预测与目标的差距</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  把网络的预测和正确答案对比，算出"差距有多大"。这个差距就是损失（Loss）。损失越大，说明预测越差。
                </div>
              </div>
            )}
            {currentScene === "backward" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#FFD700" }}>反向传播：计算梯度</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  从输出往回推，算出每个权重对损失的"贡献"——这就是梯度。梯度告诉我们：这个权重应该往哪个方向调、调多少。
                </div>
              </div>
            )}
            {currentScene === "update" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#2196F3" }}>更新权重</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  根据梯度调整每个权重：梯度为正就减小，梯度为负就增大。调整幅度由学习率控制。更新后，损失会变小，预测会更准。
                </div>
              </div>
            )}
            {currentScene === "iterate" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#4CAF50" }}>反复训练</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  重复这个过程成千上万次，每次损失都变小一点，权重越来越准，网络就"学会"了下棋。
                </div>
              </div>
            )}
            {currentScene === "summary" && (
              <div style={{ color: "white", fontSize: 26 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#fff" }}>总结</div>
                <div style={{ color: "#ccc", lineHeight: 1.6 }}>
                  前向传播 → 计算损失 → 反向传播 → 更新权重。这四步就是神经网络"学习"的全部过程。
                </div>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
