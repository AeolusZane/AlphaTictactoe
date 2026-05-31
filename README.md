# AlphaTictactoe

AlphaGo 简化版 —— 用井字棋演示 AlphaGo 的核心原理。

## 项目结构

```
AlphaTictactoe/
├── alphago_tictactoe.py    # 核心训练代码（Board + PolicyValueNet + MCTS + Self-play）
└── training-video/         # Remotion 可视化动画（3 个独立视频）
    ├── src/
    │   ├── TicTacToeTraining.tsx       # 自我对弈训练过程
    │   ├── WeightUpdateVisualization.tsx # 权重更新原理
    │   └── MCTSVisualization.tsx       # MCTS 四步流程
    └── public/audio/                   # 中文配音
```

## 核心组件

| 组件 | 说明 |
|------|------|
| **Board** | 井字棋规则（落子、判胜负） |
| **PolicyValueNet** | 神经网络（策略头 + 价值头） |
| **MCTS** | 蒙特卡洛树搜索（用神经网络指导） |
| **Self-play + Train** | 自我对弈 + 策略梯度更新权重 |

## 运行训练

```bash
pip install torch numpy
python alphago_tictactoe.py
```

训练 200 局后自动进入人机对弈模式。

## 原理

1. **策略网络**：输入棋盘 → 输出每个位置的落子概率（"棋感"）
2. **价值网络**：输入棋盘 → 输出当前胜率（"大局观"）
3. **MCTS**：用神经网络缩小搜索范围 + 评估局面，替代暴力穷举
4. **自我对弈**：网络 vs 网络对弈，赢了强化决策、输了削弱决策（策略梯度）

## 训练视频

用 Remotion 制作的可视化动画，详见 [training-video/README.md](training-video/README.md)。

| 视频 | 时长 | 内容 |
|------|------|------|
| 自我对弈训练 | 112s | 棋盘状态 + MCTS 搜索分布 + 策略概率 + 统计面板 |
| 权重更新原理 | 105s | 策略梯度公式 + 学习率影响 + 批量训练 |
| MCTS 四步流程 | 178s | 选择 → 扩展 → 回溯 → 模拟，含逐层动画和中文配音 |
