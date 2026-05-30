# AlphaTictactoe

AlphaGo 简化版 —— 用井字棋演示 AlphaGo 的核心原理。

## 核心组件

| 组件 | 说明 |
|------|------|
| **Board** | 井字棋规则（落子、判胜负） |
| **PolicyValueNet** | 神经网络（策略头 + 价值头） |
| **MCTS** | 蒙特卡洛树搜索（用神经网络指导） |
| **Self-play + Train** | 自我对弈 + 策略梯度更新权重 |

## 运行

```bash
pip install torch numpy
python alphago_tictactoe.py
```

训练 200 局后自动进入人机对弈模式。

## 训练日志

支持详细的训练过程记录：

```bash
# 默认模式：控制台只显示摘要，详细日志写入 training_log.txt
python alphago_tictactoe.py

# 详细模式：控制台也打印每步对弈过程
python alphago_tictactoe.py --verbose

# 直接对弈：加载已训练好的模型
python alphago_tictactoe.py --play
```

日志包含：
- 每步棋盘状态
- MCTS 搜索分布（9个位置的访问次数和概率）
- 训练统计（胜率、损失曲线）

## 动画演示

`animation/` 目录包含用 Remotion 制作的训练过程可视化动画：

```bash
cd animation
npm install
npm start        # 预览（浏览器打开 http://localhost:3000）
npm run build    # 渲染为 MP4 视频
```

动画展示：
- 自我对弈过程（棋盘实时更新）
- MCTS 搜索分布可视化（柱状图）
- 训练统计面板（胜率、损失曲线）

## 原理

1. **策略网络**：输入棋盘 → 输出每个位置的落子概率（"棋感"）
2. **价值网络**：输入棋盘 → 输出当前胜率（"大局观"）
3. **MCTS**：用神经网络缩小搜索范围 + 评估局面，替代暴力穷举
4. **自我对弈**：网络 vs 网络对弈，赢了强化决策、输了削弱决策（策略梯度）
