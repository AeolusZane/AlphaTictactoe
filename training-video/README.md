# AlphaGo 训练可视化动画

用 Remotion 制作的 AlphaGo 训练过程可视化动画，包含 3 个独立视频，配有中文语音讲解。

## 视频内容

### 1. 自我对弈训练（TicTacToeTraining）

- 时长：112 秒（3360 帧）
- 展示两局自我对弈过程
- 棋盘状态实时更新
- MCTS 搜索分布可视化（柱状图）
- 每步决策的概率分布
- 训练统计面板（胜率、损失曲线）

### 2. 权重更新原理（WeightUpdateVisualization）

- 时长：105 秒（3150 帧）
- 策略梯度公式推导
- 正负奖励对权重的影响
- 可视化权重变化过程

### 3. MCTS 四步流程（MCTSVisualization）

- 时长：178 秒（5340 帧）
- 搜索树结构（标注每层谁在下棋）
- 选择（Selection）：UCB 公式 + 路径高亮
- 扩展（Expansion）：神经网络评估叶子节点
- 回溯（Backpropagation）：逐层翻转符号动画
- 模拟（Simulation）：多次搜索统计
- 结果：访问次数最多的走法 = 最佳走法

## 运行

```bash
# 安装依赖
npm install

# 启动预览（浏览器打开 http://localhost:3000）
npm start

# 渲染单个视频
npx remotion render TicTacToeTraining out/tictactoe.mp4
npx remotion render WeightUpdate out/weight-update.mp4
npx remotion render MCTSVisualization out/mcts.mp4

# 渲染所有视频
npm run build
```

## 技术栈

- Remotion 4.0
- React 19
- TypeScript
- edge-tts（中文语音合成）

## 参数

- 分辨率：1920x1080
- 帧率：30fps
- 总时长：395 秒（3 个视频）

## 音频

配音文件位于 `public/audio/` 目录：

- `tictactoe/` — 自我对弈训练配音
- `weight-update/` — 权重更新配音
- `mcts/` — MCTS 流程配音（10 段）

使用 edge-tts 的 `zh-CN-YunxiNeural` 语音生成。
