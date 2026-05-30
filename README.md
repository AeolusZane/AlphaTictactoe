# AlphaTictactoe

AlphaGo 简化版 —— 用井字棋演示 AlphaGo 的核心原理。

## 核心组件

| 组件 | 说明 |
|------|------|
| **Board** | 井字棋规则（落子、判胜负） |
| **PolicyValueNet** | 神经网络（策略头 + 价值头） |
| **MCTS** | 蒙特卡洛树搜索（用神经网络指导） |
| **Self-play + Train** | 自我对弈 + 策略梯度更新权重 |

## 详细教程

面向初中生的通俗教程，用举例的方式讲清每个模块：

1. **[棋盘与规则](docs/01-棋盘与规则.md)** —— 教电脑认识井字棋
2. **[神经网络](docs/02-神经网络.md)** —— 给电脑装上"棋感"
3. **[蒙特卡洛树搜索](docs/03-蒙特卡洛树搜索.md)** —— 让电脑学会"往后想"
4. **[自我对弈与训练](docs/04-自我对弈与训练.md)** —— 让电脑越下越强

## 运行

```bash
pip install torch numpy
python alphago_tictactoe.py
```

训练 200 局后自动进入人机对弈模式。

## 训练日志

```bash
# 默认模式：控制台只显示摘要，详细日志写入 training_log.txt
python alphago_tictactoe.py

# 详细模式：控制台也打印每步对弈过程
python alphago_tictactoe.py --verbose

# 直接对弈：加载已训练好的模型
python alphago_tictactoe.py --play
```

## 动画演示

`animation/` 目录包含用 Remotion 制作的训练过程可视化动画：

```bash
cd animation
npm install
npm start        # 预览（浏览器打开 http://localhost:3000）
npm run build    # 渲染为 MP4 视频
```

## 原理

1. **策略网络**：输入棋盘 → 输出每个位置的落子概率（"棋感"）
2. **价值网络**：输入棋盘 → 输出当前胜率（"大局观"）
3. **MCTS**：用神经网络缩小搜索范围 + 评估局面
4. **自我对弈**：AI 自己跟自己下，产生训练数据
5. **策略梯度**：用对弈数据更新神经网络权重

## 项目结构

```
AlphaTictactoe/
├── alphago_tictactoe.py    # 主程序
├── docs/                   # 详细教程（4篇）
├── animation/              # Remotion 动画项目
└── README.md
```
