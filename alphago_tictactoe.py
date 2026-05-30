"""
AlphaGo 简化版 —— 井字棋
========================
核心组件：
1. 棋盘逻辑（Board）
2. 神经网络（PolicyValueNet）—— 策略 + 价值
3. 蒙特卡洛树搜索（MCTS）—— 用神经网络指导搜索
4. 自我对弈训练（train）—— 通过实战提升棋力

运行: pip install torch numpy && python alphago_tictactoe.py
"""

import math
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from collections import defaultdict

# ============================================================
# 第一部分：棋盘逻辑
# ============================================================

class Board:
    """井字棋棋盘"""

    def __init__(self):
        # 3x3 棋盘，0=空，1=黑棋(先手)，-1=白棋(后手)
        self.grid = np.zeros(9, dtype=np.float32)
        self.current_player = 1  # 黑棋先走

    def copy(self):
        b = Board()
        b.grid = self.grid.copy()
        b.current_player = self.current_player
        return b

    def legal_moves(self):
        """返回所有合法落子位置"""
        return [i for i in range(9) if self.grid[i] == 0]

    def play(self, pos):
        """在 pos 位置落子"""
        assert self.grid[pos] == 0, f"位置 {pos} 已有棋子"
        self.grid[pos] = self.current_player
        self.current_player *= -1  # 换手

    def check_winner(self):
        """检查胜负：返回 1(黑赢), -1(白赢), 0(平局), None(未结束)"""
        lines = [
            [0,1,2], [3,4,5], [6,7,8],  # 横
            [0,3,6], [1,4,7], [2,5,8],  # 竖
            [0,4,8], [2,4,6],            # 对角
        ]
        for line in lines:
            s = self.grid[line[0]] + self.grid[line[1]] + self.grid[line[2]]
            if s == 3: return 1    # 黑赢
            if s == -3: return -1  # 白赢
        if len(self.legal_moves()) == 0:
            return 0  # 平局
        return None  # 未结束

    def to_tensor(self):
        """
        把棋盘转成神经网络的输入
        3个通道：
          通道0: 我的棋子位置（1=有子）
          通道1: 对手棋子位置（1=有子）
          通道2: 当前玩家标识（全1或全-1）
        """
        my_pieces = (self.grid == self.current_player).astype(np.float32)
        opp_pieces = (self.grid == -self.current_player).astype(np.float32)
        player_plane = np.full(9, self.current_player, dtype=np.float32)
        return np.concatenate([my_pieces, opp_pieces, player_plane])

    def display(self):
        """打印棋盘"""
        symbols = {0: '.', 1: 'X', -1: 'O'}
        for row in range(3):
            print(' '.join(symbols[self.grid[row*3 + col]] for col in range(3)))
        print()


# ============================================================
# 第二部分：神经网络 —— 策略头 + 价值头
# ============================================================

class PolicyValueNet(nn.Module):
    """
    输入：棋盘状态 (3 x 9)
    输出：
      - policy: 每个位置的落子概率 (9个数字)
      - value:  当前局面的胜率评估 (1个数字, -1到1)
    """

    def __init__(self):
        super().__init__()
        # 共享的特征提取层
        self.shared = nn.Sequential(
            nn.Linear(27, 128),   # 3通道 x 9格 = 27维输入
            nn.ReLU(),
            nn.Linear(128, 128),
            nn.ReLU(),
        )
        # 策略头：输出每个位置的落子概率
        self.policy_head = nn.Linear(128, 9)
        # 价值头：输出当前局面胜率
        self.value_head = nn.Linear(128, 1)

    def forward(self, x):
        features = self.shared(x)
        policy_logits = self.policy_head(features)  # 未归一化的概率
        value = torch.tanh(self.value_head(features))  # 压缩到 [-1, 1]
        return policy_logits, value


# ============================================================
# 第三部分：蒙特卡洛树搜索（MCTS）
# ============================================================

class MCTSNode:
    """搜索树的一个节点"""

    def __init__(self, parent=None, move=None):
        self.parent = parent
        self.move = move           # 到达这个节点的走法
        self.children = {}         # move -> MCTSNode
        self.visits = 0            # 访问次数
        self.value_sum = 0.0       # 累计价值
        self.prior = 0.0           # 神经网络给的先验概率

    @property
    def value(self):
        """平均价值"""
        return self.value_sum / self.visits if self.visits > 0 else 0

    def ucb_score(self, c_puct=1.4):
        """
        UCB 公式：平衡「探索」和「利用」
        - value: 这个节点的平均胜率（利用）
        - prior * sqrt(parent_visits) / (1 + visits): 先验概率引导的探索
        """
        if self.visits == 0:
            exploration = float('inf')
        else:
            parent_visits = self.parent.visits if self.parent else 1
            exploration = c_puct * self.prior * math.sqrt(parent_visits) / (1 + self.visits)
        return self.value + exploration


def mcts_search(board, net, num_simulations=100):
    """
    对一个局面做 MCTS 搜索

    核心循环：
    1. 选择（Selection）：从根节点沿 UCB 最高的路径走到叶子
    2. 扩展（Expansion）：用神经网络评估叶子节点
    3. 回溯（Backpropagation）：把评估值传回路径上所有节点

    返回：每个合法走法的访问次数分布（作为改进后的策略）
    """
    root = MCTSNode()

    for _ in range(num_simulations):
        node = root
        sim_board = board.copy()

        # --- 1. 选择：沿 UCB 最高的路径走到叶子 ---
        while node.children and sim_board.check_winner() is None:
            # 选 UCB 最高的子节点
            best_move = max(node.children, key=lambda m: node.children[m].ucb_score())
            node = node.children[best_move]
            sim_board.play(best_move)

        # --- 2. 扩展：评估叶子节点 ---
        winner = sim_board.check_winner()
        if winner is not None:
            # 游戏已结束，直接用真实结果
            # winner == 当前玩家 → +1，对手赢 → -1，平局 → 0
            leaf_value = winner * sim_board.current_player * (-1)
            # 注意：这里 winner 是相对于原始玩家的，需要转换
            if winner == 0:
                leaf_value = 0
            elif winner == board.current_player:
                leaf_value = 1
            else:
                leaf_value = -1
        else:
            # 用神经网络评估
            state = torch.FloatTensor(sim_board.to_tensor()).unsqueeze(0)
            with torch.no_grad():
                policy_logits, value = net(state)

            leaf_value = value.item()

            # 创建子节点，用神经网络的策略作为先验概率
            policy = torch.softmax(policy_logits, dim=1).squeeze().numpy()
            legal = sim_board.legal_moves()

            # 归一化合法走法的概率
            legal_policy = {m: policy[m] for m in legal}
            total = sum(legal_policy.values())
            if total > 0:
                legal_policy = {m: p/total for m, p in legal_policy.items()}
            else:
                legal_policy = {m: 1/len(legal) for m in legal}

            for move in legal:
                child = MCTSNode(parent=node, move=move)
                child.prior = legal_policy[move]
                node.children[move] = child

        # --- 3. 回溯：把叶子价值传回根节点 ---
        # 注意：每上一层要翻转符号（对手视角）
        current = node
        v = leaf_value
        while current is not None:
            current.visits += 1
            current.value_sum += v
            v = -v  # 翻转视角：我的好事是对手的坏事
            current = current.parent

    # 返回每个走法的访问次数分布
    visit_counts = {}
    for move in board.legal_moves():
        if move in root.children:
            visit_counts[move] = root.children[move].visits
        else:
            visit_counts[move] = 0

    return visit_counts


# ============================================================
# 第四部分：自我对弈 + 训练
# ============================================================

def self_play(net, num_simulations=50):
    """
    让 AI 跟自己对弈一局，收集训练数据

    返回：[(state, mcts_policy, winner), ...]
      - state: 棋盘状态
      - mcts_policy: MCTS 搜索后的走法概率分布（比神经网络原始输出更准）
      - winner: 最终赢家
    """
    board = Board()
    game_data = []

    while True:
        # 用 MCTS 搜索当前最佳走法
        visit_counts = mcts_search(board, net, num_simulations)

        # 把访问次数转成概率分布
        total_visits = sum(visit_counts.values())
        if total_visits == 0:
            break
        policy = np.zeros(9)
        for move, count in visit_counts.items():
            policy[move] = count / total_visits

        # 记录训练数据
        game_data.append((board.to_tensor().copy(), policy.copy(), board.current_player))

        # 选访问次数最多的走法（贪心）
        best_move = max(visit_counts, key=visit_counts.get)
        board.play(best_move)

        # 检查游戏是否结束
        winner = board.check_winner()
        if winner is not None:
            break

    # 把 winner 转成每个训练样本的标签
    training_data = []
    for state, policy, player in game_data:
        if winner == 0:
            value = 0  # 平局
        elif winner == player:
            value = 1  # 我赢了
        else:
            value = -1  # 我输了
        training_data.append((state, policy, value))

    return training_data, winner


def train(num_games=200, num_simulations=50, lr=0.003):
    """
    完整的训练流程：
    1. 自我对弈生成数据
    2. 用数据训练神经网络
    3. 重复，越来越强
    """
    net = PolicyValueNet()
    optimizer = optim.Adam(net.parameters(), lr=lr)

    print("=" * 50)
    print("AlphaGo 井字棋 - 开始训练")
    print("=" * 50)

    for game_idx in range(num_games):
        # --- 自我对弈 ---
        data, winner = self_play(net, num_simulations)

        # --- 用对弈数据训练网络 ---
        total_loss = 0
        for state, policy, value in data:
            state_t = torch.FloatTensor(state).unsqueeze(0)
            policy_t = torch.FloatTensor(policy).unsqueeze(0)
            value_t = torch.FloatTensor([value]).unsqueeze(0)

            # 前向传播
            pred_policy, pred_value = net(state_t)

            # 损失函数 = 策略损失 + 价值损失
            # 策略损失：让网络输出接近 MCTS 的搜索分布
            policy_loss = -torch.sum(policy_t * torch.log_softmax(pred_policy, dim=1))
            # 价值损失：让网络评估接近真实胜负
            value_loss = (pred_value - value_t) ** 2

            loss = policy_loss + value_loss

            # 反向传播，更新权重
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        # 每 20 局打印一次进度
        if (game_idx + 1) % 20 == 0:
            result_str = {1: "黑赢", -1: "白赢", 0: "平局"}[winner]
            print(f"第 {game_idx+1:3d} 局 | 结果: {result_str} | 平均损失: {total_loss/len(data):.4f}")

    print("=" * 50)
    print("训练完成！")
    return net


# ============================================================
# 第五部分：人机对弈
# ============================================================

def play_against_human(net, num_simulations=200):
    """和训练好的 AI 下一盘"""
    board = Board()
    print("你是 X（先手），AI 是 O（后手）")
    print("输入 0-8 落子：")
    print("0 1 2")
    print("3 4 5")
    print("6 7 8")
    print()
    board.display()

    while True:
        # 人类走
        if board.current_player == 1:
            while True:
                try:
                    move = int(input(f"你的走法 (合法: {board.legal_moves()}): "))
                    if move in board.legal_moves():
                        break
                    print("非法走法，重试")
                except ValueError:
                    print("输入数字 0-8")
            board.play(move)
        else:
            # AI 走
            print("AI 思考中...")
            visit_counts = mcts_search(board, net, num_simulations)
            best_move = max(visit_counts, key=visit_counts.get)
            print(f"AI 选择位置 {best_move}")
            board.play(best_move)

        board.display()

        winner = board.check_winner()
        if winner is not None:
            if winner == 1:
                print("你赢了！")
            elif winner == -1:
                print("AI 赢了！")
            else:
                print("平局！")
            break


# ============================================================
# 主程序
# ============================================================

if __name__ == "__main__":
    # 训练
    net = train(num_games=200, num_simulations=50)

    # 保存模型
    torch.save(net.state_dict(), "tictactoe_alphago.pth")
    print("\n模型已保存到 tictactoe_alphago.pth")

    # 人机对弈
    print("\n" + "=" * 50)
    print("来和 AI 下一盘吧！")
    print("=" * 50)
    play_against_human(net)
