import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Audio, staticFile } from "remotion";

// 棋盘状态
const BOARD_SIZE = 3;
const CELL_SIZE = 80;

// 搜索树节点数据
interface TreeNode {
  id: string;
  x: number;
  y: number;
  visits: number;
  value: number;
  children: TreeNode[];
  move?: number;
  highlighted?: boolean;
}

// 场景时间轴（秒）
const SCENES = {
  title: { start: 0, end: 5 },
  problem: { start: 5, end: 15 },
  idea: { start: 15, end: 25 },
  tree: { start: 25, end: 35 },
  selection: { start: 35, end: 50 },
  expansion: { start: 50, end: 65 },
  backprop: { start: 65, end: 80 },
  simulate: { start: 80, end: 100 },
  result: { start: 100, end: 110 },
  summary: { start: 110, end: 120 },
};

// 棋盘组件
const Board: React.FC<{ board: (number | null)[]; highlight?: number[] }> = ({ board, highlight = [] }) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`, gap: 4 }}>
      {board.map((cell, i) => (
        <div
          key={i}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            backgroundColor: highlight.includes(i) ? "#4CAF50" : "#1a1a1a",
            border: "2px solid #444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: "bold",
            color: cell === 1 ? "#00ff88" : cell === -1 ? "#ff6b6b" : "#666",
          }}
        >
          {cell === 1 ? "X" : cell === -1 ? "O" : ""}
        </div>
      ))}
    </div>
  );
};

// 搜索树节点组件
const TreeNodeComponent: React.FC<{ node: TreeNode; depth: number }> = ({ node, depth }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const scale = spring({
    frame: frame - depth * 10,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <g>
      {/* 连接线到子节点 */}
      {node.children.map((child, i) => (
        <line
          key={i}
          x1={node.x}
          y1={node.y}
          x2={child.x}
          y2={child.y}
          stroke={child.highlighted ? "#FFD700" : "#444"}
          strokeWidth={child.highlighted ? 3 : 1}
        />
      ))}
      
      {/* 节点圆圈 */}
      <circle
        cx={node.x}
        cy={node.y}
        r={25 * scale}
        fill={node.highlighted ? "#FFD700" : "#1a1a1a"}
        stroke={node.highlighted ? "#FFD700" : "#666"}
        strokeWidth={2}
      />
      
      {/* 访问次数 */}
      <text
        x={node.x}
        y={node.y - 5}
        textAnchor="middle"
        fill="white"
        fontSize={12}
        fontFamily="monospace"
      >
        {node.visits}
      </text>
      
      {/* 价值 */}
      <text
        x={node.x}
        y={node.y + 10}
        textAnchor="middle"
        fill="#00ff88"
        fontSize={10}
        fontFamily="monospace"
      >
        {node.value.toFixed(2)}
      </text>
      
      {/* 递归渲染子节点 */}
      {node.children.map((child, i) => (
        <TreeNodeComponent key={i} node={child} depth={depth + 1} />
      ))}
    </g>
  );
};

// 主组件
export const MCTSVisualization: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();

  // 当前场景
  const currentScene = Object.entries(SCENES).find(
    ([, { start, end }]) => frame >= start * fps && frame < end * fps
  )?.[0] || "summary";

  const sceneFrame = frame - (SCENES[currentScene as keyof typeof SCENES]?.start || 0) * fps;

  // 初始棋盘（黑棋要走）
  const initialBoard: (number | null)[] = [
    1, -1, null,
    null, null, null,
    null, null, null,
  ];

  // 搜索树数据（简化版）
  const buildTree = (simCount: number): TreeNode => {
    const root: TreeNode = {
      id: "root",
      x: width / 2,
      y: 150,
      visits: simCount,
      value: 0.52,
      children: [],
      highlighted: currentScene === "selection" || currentScene === "backprop",
    };

    // 3个子节点（3个合法走法）
    const moves = [2, 4, 6];
    const visits = [
      Math.floor(simCount * 0.45),
      Math.floor(simCount * 0.35),
      Math.floor(simCount * 0.20),
    ];
    const values = [0.62, 0.48, 0.35];

    moves.forEach((move, i) => {
      const child: TreeNode = {
        id: `child-${move}`,
        x: width / 2 + (i - 1) * 200,
        y: 300,
        visits: visits[i],
        value: values[i],
        children: [],
        move,
        highlighted: currentScene === "selection" && i === 0,
      };

      // 每个子节点有2个孙节点
      if (simCount > 10) {
        for (let j = 0; j < 2; j++) {
          child.children.push({
            id: `grandchild-${move}-${j}`,
            x: child.x + (j - 0.5) * 80,
            y: 450,
            visits: Math.floor(visits[i] * 0.4),
            value: values[i] + (j === 0 ? 0.1 : -0.1),
            children: [],
            highlighted: currentScene === "selection" && i === 0 && j === 0,
          });
        }
      }

      root.children.push(child);
    });

    return root;
  };

  const tree = buildTree(currentScene === "simulate" ? Math.min(100, Math.floor(sceneFrame / fps) * 20) : 100);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", fontFamily: "monospace" }}>
      {/* 背景音乐 */}
      <Audio src={staticFile("audio/bgm.mp3")} volume={0.2} />

      {/* 配音 */}
      <Sequence from={0} durationInFrames={5 * fps}>
        <Audio src={staticFile("audio/mcts/narration-title.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={5 * fps} durationInFrames={10 * fps}>
        <Audio src={staticFile("audio/mcts/narration-problem.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={15 * fps} durationInFrames={10 * fps}>
        <Audio src={staticFile("audio/mcts/narration-idea.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={25 * fps} durationInFrames={10 * fps}>
        <Audio src={staticFile("audio/mcts/narration-tree.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={35 * fps} durationInFrames={15 * fps}>
        <Audio src={staticFile("audio/mcts/narration-selection.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={50 * fps} durationInFrames={15 * fps}>
        <Audio src={staticFile("audio/mcts/narration-expansion.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={65 * fps} durationInFrames={15 * fps}>
        <Audio src={staticFile("audio/mcts/narration-backprop.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={80 * fps} durationInFrames={20 * fps}>
        <Audio src={staticFile("audio/mcts/narration-simulate.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={100 * fps} durationInFrames={10 * fps}>
        <Audio src={staticFile("audio/mcts/narration-result.mp3")} volume={1.0} />
      </Sequence>
      <Sequence from={110 * fps} durationInFrames={10 * fps}>
        <Audio src={staticFile("audio/mcts/narration-summary.mp3")} volume={1.0} />
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
            蒙特卡洛树搜索
          </div>
          <div style={{
            fontSize: 36,
            color: "#888",
            marginTop: 30,
            opacity: interpolate(sceneFrame, [fps, 2 * fps], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            通过模拟对局找到最佳走法
          </div>
        </AbsoluteFill>
      )}

      {/* 问题引入 */}
      {currentScene === "problem" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#00ff88", marginBottom: 40, fontWeight: "bold" }}>
            黑棋该走哪里？
          </div>
          <div style={{ display: "flex", gap: 60, alignItems: "flex-start" }}>
            <div>
              <Board board={initialBoard} />
              <div style={{ marginTop: 20, fontSize: 20, color: "#888" }}>
                当前局面（X = 黑棋）
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 20 }}>合法走法：位置 2, 4, 6</div>
                <div style={{ color: "#ffaa00", fontSize: 28, fontWeight: "bold" }}>
                  如何评估每个走法的好坏？
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 核心思想 */}
      {currentScene === "idea" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#00ff88", marginBottom: 40, fontWeight: "bold" }}>
            蒙特卡洛方法
          </div>
          <div style={{ display: "flex", gap: 60, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 20 }}>
                  让 AI <span style={{ color: "#FFD700" }}>自己跟自己下很多局</span>
                </div>
                <div style={{ marginBottom: 20 }}>
                  统计每个走法的<span style={{ color: "#FFD700" }}>胜率</span>
                </div>
                <div style={{ color: "#00ff88", fontSize: 28, fontWeight: "bold" }}>
                  胜率最高的走法 = 最佳走法
                </div>
              </div>
            </div>
            <div>
              <svg width="400" height="300" viewBox="0 0 400 300">
                {/* 模拟多条对局路径 */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <path
                    key={i}
                    d={`M 50 50 Q ${100 + i * 30} ${100 + i * 20} ${200 + i * 20} ${150 + i * 15} T ${350} ${250}`}
                    stroke={i % 2 === 0 ? "#00ff88" : "#ff6b6b"}
                    strokeWidth={2}
                    fill="none"
                    opacity={0.6}
                  />
                ))}
                <circle cx={50} cy={50} r={8} fill="#FFD700" />
                <text x={50} y={30} textAnchor="middle" fill="white" fontSize={14}>当前局面</text>
              </svg>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 搜索树结构 */}
      {currentScene === "tree" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#00ff88", marginBottom: 40, fontWeight: "bold" }}>
            搜索树结构
          </div>
          <div style={{ display: "flex", gap: 60 }}>
            <div style={{ flex: 1 }}>
              <svg width="100%" height="500" viewBox={`0 0 ${width - 120} 500`}>
                <TreeNodeComponent node={tree} depth={0} />
              </svg>
            </div>
            <div style={{ width: 400 }}>
              <div style={{ fontSize: 20, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ color: "#FFD700" }}>节点</span> = 一个局面
                </div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ color: "#00ff88" }}>上方数字</span> = 访问次数
                </div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ color: "#00ff88" }}>下方数字</span> = 平均价值（胜率）
                </div>
                <div style={{ marginTop: 40, color: "#ffaa00", fontSize: 24, fontWeight: "bold" }}>
                  树越深，模拟越准确
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 选择阶段 */}
      {currentScene === "selection" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#FFD700", marginBottom: 40, fontWeight: "bold" }}>
            第一步：选择（Selection）
          </div>
          <div style={{ display: "flex", gap: 60 }}>
            <div style={{ flex: 1 }}>
              <svg width="100%" height="500" viewBox={`0 0 ${width - 120} 500`}>
                <TreeNodeComponent node={tree} depth={0} />
              </svg>
            </div>
            <div style={{ width: 400 }}>
              <div style={{ fontSize: 20, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 20 }}>
                  从根节点开始，沿 <span style={{ color: "#FFD700" }}>UCB 最高</span> 的路径走到叶子
                </div>
                <div style={{ 
                  backgroundColor: "#1a1a1a", 
                  padding: 20, 
                  borderRadius: 8,
                  marginTop: 20,
                  fontSize: 16,
                }}>
                  <div style={{ color: "#FFD700", marginBottom: 10 }}>UCB 公式：</div>
                  <div style={{ color: "#00ff88", fontFamily: "monospace" }}>
                    UCB = value + c × prior × √(parent_visits) / (1 + visits)
                  </div>
                </div>
                <div style={{ marginTop: 20, color: "#888", fontSize: 16 }}>
                  平衡<span style={{ color: "#00ff88" }}>探索</span>（尝试新走法）和<span style={{ color: "#ff6b6b" }}>利用</span>（选择已知好走法）
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 扩展阶段 */}
      {currentScene === "expansion" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#FFD700", marginBottom: 40, fontWeight: "bold" }}>
            第二步：扩展（Expansion）
          </div>
          <div style={{ display: "flex", gap: 60 }}>
            <div style={{ flex: 1 }}>
              <svg width="100%" height="500" viewBox={`0 0 ${width - 120} 500`}>
                <TreeNodeComponent node={tree} depth={0} />
                {/* 新节点动画 */}
                <circle
                  cx={width / 2 - 200}
                  cy={450}
                  r={25}
                  fill="#4CAF50"
                  opacity={interpolate(sceneFrame, [0, fps], [0, 1], { extrapolateRight: "clamp" })}
                />
              </svg>
            </div>
            <div style={{ width: 400 }}>
              <div style={{ fontSize: 20, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 20 }}>
                  用<span style={{ color: "#4CAF50" }}>神经网络</span>评估叶子节点
                </div>
                <div style={{ marginBottom: 20 }}>
                  输出：
                  <ul style={{ marginTop: 10 }}>
                    <li><span style={{ color: "#00ff88" }}>policy</span>：每个走法的先验概率</li>
                    <li><span style={{ color: "#00ff88" }}>value</span>：当前局面的胜率估计</li>
                  </ul>
                </div>
                <div style={{ marginTop: 20, color: "#ffaa00", fontSize: 24, fontWeight: "bold" }}>
                  创建子节点，赋予先验概率
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 回溯阶段 */}
      {currentScene === "backprop" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#FFD700", marginBottom: 40, fontWeight: "bold" }}>
            第三步：回溯（Backpropagation）
          </div>
          <div style={{ display: "flex", gap: 60 }}>
            <div style={{ flex: 1 }}>
              <svg width="100%" height="500" viewBox={`0 0 ${width - 120} 500`}>
                <TreeNodeComponent node={tree} depth={0} />
                {/* 回溯箭头 */}
                <path
                  d={`M ${width / 2 - 200} 450 L ${width / 2 - 200} 300 L ${width / 2} 150`}
                  stroke="#FFD700"
                  strokeWidth={4}
                  fill="none"
                  strokeDasharray="10,5"
                  opacity={interpolate(sceneFrame, [0, fps], [0, 1], { extrapolateRight: "clamp" })}
                />
              </svg>
            </div>
            <div style={{ width: 400 }}>
              <div style={{ fontSize: 20, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 20 }}>
                  从叶子往根节点回溯
                </div>
                <div style={{ marginBottom: 20 }}>
                  更新路径上所有节点：
                  <ul style={{ marginTop: 10 }}>
                    <li><span style={{ color: "#00ff88" }}>visits += 1</span></li>
                    <li><span style={{ color: "#00ff88" }}>value_sum += v</span></li>
                  </ul>
                </div>
                <div style={{ 
                  backgroundColor: "#1a1a1a", 
                  padding: 20, 
                  borderRadius: 8,
                  marginTop: 20,
                  color: "#ff6b6b",
                  fontSize: 18,
                }}>
                  注意：每上一层翻转符号（v = -v）
                  <div style={{ color: "#888", fontSize: 14, marginTop: 10 }}>
                    因为对手视角相反
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 多次模拟 */}
      {currentScene === "simulate" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#00ff88", marginBottom: 40, fontWeight: "bold" }}>
            重复模拟 100 次
          </div>
          <div style={{ display: "flex", gap: 60 }}>
            <div style={{ flex: 1 }}>
              <svg width="100%" height="500" viewBox={`0 0 ${width - 120} 500`}>
                <TreeNodeComponent node={tree} depth={0} />
              </svg>
            </div>
            <div style={{ width: 400 }}>
              <div style={{ fontSize: 20, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ 
                  fontSize: 48, 
                  color: "#FFD700", 
                  fontWeight: "bold",
                  marginBottom: 20,
                }}>
                  {Math.min(100, Math.floor(sceneFrame / fps) * 20)} / 100
                </div>
                <div style={{ marginBottom: 20 }}>
                  模拟次数
                </div>
                <div style={{ marginTop: 40, color: "#888", fontSize: 16 }}>
                  树逐渐生长，访问次数分化
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 最终结果 */}
      {currentScene === "result" && (
        <AbsoluteFill style={{ padding: 60 }}>
          <div style={{ fontSize: 36, color: "#00ff88", marginBottom: 40, fontWeight: "bold" }}>
            搜索结果
          </div>
          <div style={{ display: "flex", gap: 60 }}>
            <div>
              <Board board={initialBoard} highlight={[2]} />
              <div style={{ marginTop: 20, fontSize: 20, color: "#888" }}>
                最佳走法：位置 2
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, color: "#ccc", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 30 }}>
                  <div style={{ color: "#FFD700", fontSize: 28, fontWeight: "bold", marginBottom: 10 }}>
                    访问次数分布
                  </div>
                  <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
                    {[
                      { move: 2, visits: 45, value: 0.62 },
                      { move: 4, visits: 35, value: 0.48 },
                      { move: 6, visits: 20, value: 0.35 },
                    ].map((item, i) => (
                      <div key={i} style={{
                        backgroundColor: item.move === 2 ? "#4CAF50" : "#1a1a1a",
                        padding: 20,
                        borderRadius: 8,
                        border: item.move === 2 ? "3px solid #FFD700" : "2px solid #444",
                      }}>
                        <div style={{ fontSize: 20, color: "white", marginBottom: 10 }}>
                          位置 {item.move}
                        </div>
                        <div style={{ fontSize: 32, color: "#00ff88", fontWeight: "bold" }}>
                          {item.visits}
                        </div>
                        <div style={{ fontSize: 16, color: "#888", marginTop: 5 }}>
                          胜率 {(item.value * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ color: "#ffaa00", fontSize: 28, fontWeight: "bold" }}>
                  访问次数最多的走法 = 最佳走法
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 总结 */}
      {currentScene === "summary" && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
          <div style={{ fontSize: 48, color: "#00ff88", marginBottom: 60, fontWeight: "bold" }}>
            MCTS 核心循环
          </div>
          <div style={{ display: "flex", gap: 40, fontSize: 28 }}>
            {[
              { step: "1", title: "选择", desc: "沿 UCB 走到叶子", color: "#FFD700" },
              { step: "2", title: "扩展", desc: "神经网络评估", color: "#4CAF50" },
              { step: "3", title: "回溯", desc: "更新路径节点", color: "#2196F3" },
            ].map((item, i) => (
              <div key={i} style={{
                backgroundColor: "#1a1a1a",
                padding: 40,
                borderRadius: 12,
                border: `3px solid ${item.color}`,
                textAlign: "center",
                width: 300,
              }}>
                <div style={{ fontSize: 64, color: item.color, fontWeight: "bold", marginBottom: 20 }}>
                  {item.step}
                </div>
                <div style={{ fontSize: 32, color: "white", marginBottom: 15 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 20, color: "#888" }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 60, fontSize: 24, color: "#ffaa00" }}>
            重复 100 次 → 选择访问次数最多的走法
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
