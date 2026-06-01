/**
 * AlphaGo 简化版 —— 井字棋 (Node.js + TensorFlow.js)
 * ====================================================
 * 核心组件：
 * 1. 棋盘逻辑（Board）
 * 2. 神经网络（PolicyValueNet）—— 策略 + 价值
 * 3. 蒙特卡洛树搜索（MCTS）—— 用神经网络指导搜索
 * 4. 自我对弈训练（train）—— 通过实战提升棋力
 *
 * 运行: npm install && node alphago_tictactoe.js
 */

const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const readline = require('readline');

// ============================================================
// 第一部分：棋盘逻辑
// ============================================================

class Board {
  constructor() {
    // 3x3 棋盘，0=空，1=黑棋(先手)，-1=白棋(后手)
    this.grid = new Float32Array(9);
    this.currentPlayer = 1; // 黑棋先走
  }

  copy() {
    const b = new Board();
    b.grid = new Float32Array(this.grid);
    b.currentPlayer = this.currentPlayer;
    return b;
  }

  legalMoves() {
    const moves = [];
    for (let i = 0; i < 9; i++) {
      if (this.grid[i] === 0) moves.push(i);
    }
    return moves;
  }

  play(pos) {
    if (this.grid[pos] !== 0) throw new Error(`位置 ${pos} 已有棋子`);
    this.grid[pos] = this.currentPlayer;
    this.currentPlayer *= -1; // 换手
  }

  checkWinner() {
    const lines = [
      [0,1,2], [3,4,5], [6,7,8], // 横
      [0,3,6], [1,4,7], [2,5,8], // 竖
      [0,4,8], [2,4,6],          // 对角
    ];
    for (const [a, b, c] of lines) {
      const s = this.grid[a] + this.grid[b] + this.grid[c];
      if (s === 3) return 1;    // 黑赢
      if (s === -3) return -1;  // 白赢
    }
    if (this.legalMoves().length === 0) return 0; // 平局
    return null; // 未结束
  }

  toTensor() {
    // 3个通道：我的棋子、对手棋子、当前玩家标识
    const myPieces = new Float32Array(9);
    const oppPieces = new Float32Array(9);
    const playerPlane = new Float32Array(9);

    for (let i = 0; i < 9; i++) {
      myPieces[i] = this.grid[i] === this.currentPlayer ? 1 : 0;
      oppPieces[i] = this.grid[i] === -this.currentPlayer ? 1 : 0;
      playerPlane[i] = this.currentPlayer;
    }

    // 拼接成 27 维向量
    const result = new Float32Array(27);
    result.set(myPieces, 0);
    result.set(oppPieces, 9);
    result.set(playerPlane, 18);
    return result;
  }

  display() {
    const symbols = { 0: '.', 1: 'X', '-1': 'O' };
    for (let row = 0; row < 3; row++) {
      const line = [];
      for (let col = 0; col < 3; col++) {
        line.push(symbols[this.grid[row * 3 + col]] || '.');
      }
      console.log(line.join(' '));
    }
    console.log();
  }
}

// ============================================================
// 第二部分：神经网络 —— 策略头 + 价值头
// ============================================================

function createPolicyValueNet() {
  // 共享特征提取层
  const input = tf.input({ shape: [27] });
  let x = tf.layers.dense({ units: 128, activation: 'relu' }).apply(input);
  x = tf.layers.dense({ units: 128, activation: 'relu' }).apply(x);

  // 策略头：输出每个位置的落子概率（9个 logits）
  const policyLogits = tf.layers.dense({ units: 9, name: 'policy' }).apply(x);

  // 价值头：输出当前局面胜率（tanh 压缩到 [-1, 1]）
  const valueRaw = tf.layers.dense({ units: 1, name: 'value' }).apply(x);
  const value = tf.layers.activation({ activation: 'tanh' }).apply(valueRaw);

  const model = tf.model({ inputs: input, outputs: [policyLogits, value] });
  return model;
}

/**
 * 用神经网络评估局面
 * 返回 { policy: Float32Array(9), value: number }
 */
function evaluatePosition(model, stateArray) {
  return tf.tidy(() => {
    const input = tf.tensor2d([Array.from(stateArray)]);
    const [policyLogits, valueTensor] = model.predict(input);
    const policy = tf.softmax(policyLogits, 1);
    return {
      policy: policy.dataSync(),
      value: valueTensor.dataSync()[0]
    };
  });
}

// ============================================================
// 第三部分：蒙特卡洛树搜索（MCTS）
// ============================================================

class MCTSNode {
  constructor(parent = null, move = null) {
    this.parent = parent;
    this.move = move;
    this.children = new Map(); // move -> MCTSNode
    this.visits = 0;
    this.valueSum = 0;
    this.prior = 0;
  }

  get value() {
    return this.visits > 0 ? this.valueSum / this.visits : 0;
  }

  ucbScore(cPuct = 1.4) {
    if (this.visits === 0) {
      return Infinity;
    }
    const parentVisits = this.parent ? this.parent.visits : 1;
    const exploration = cPuct * this.prior * Math.sqrt(parentVisits) / (1 + this.visits);
    return this.value + exploration;
  }
}

function mctsSearch(board, model, numSimulations = 100) {
  const root = new MCTSNode();

  for (let sim = 0; sim < numSimulations; sim++) {
    let node = root;
    const simBoard = board.copy();

    // --- 1. 选择：沿 UCB 最高的路径走到叶子 ---
    while (node.children.size > 0 && simBoard.checkWinner() === null) {
      let bestMove = null;
      let bestUcb = -Infinity;
      for (const [move, child] of node.children) {
        const ucb = child.ucbScore();
        if (ucb > bestUcb) {
          bestUcb = ucb;
          bestMove = move;
        }
      }
      node = node.children.get(bestMove);
      simBoard.play(bestMove);
    }

    // --- 2. 扩展：评估叶子节点 ---
    const winner = simBoard.checkWinner();
    let leafValue;

    if (winner !== null) {
      // 游戏已结束，用真实结果
      if (winner === 0) {
        leafValue = 0;
      } else if (winner === board.currentPlayer) {
        leafValue = 1;
      } else {
        leafValue = -1;
      }
    } else {
      // 用神经网络评估
      const state = simBoard.toTensor();
      const { policy, value } = evaluatePosition(model, state);
      leafValue = value;

      // 创建子节点，用神经网络的策略作为先验概率
      const legal = simBoard.legalMoves();

      // 归一化合法走法的概率
      const legalPolicy = {};
      let total = 0;
      for (const m of legal) {
        legalPolicy[m] = policy[m];
        total += policy[m];
      }
      if (total > 0) {
        for (const m of legal) {
          legalPolicy[m] /= total;
        }
      } else {
        for (const m of legal) {
          legalPolicy[m] = 1 / legal.length;
        }
      }

      for (const move of legal) {
        const child = new MCTSNode(node, move);
        child.prior = legalPolicy[move];
        node.children.set(move, child);
      }
    }

    // --- 3. 回溯：把叶子价值传回根节点 ---
    let current = node;
    let v = leafValue;
    while (current !== null) {
      current.visits += 1;
      current.valueSum += v;
      v = -v; // 翻转视角
      current = current.parent;
    }
  }

  // 返回每个走法的访问次数分布
  const visitCounts = {};
  for (const move of board.legalMoves()) {
    if (root.children.has(move)) {
      visitCounts[move] = root.children.get(move).visits;
    } else {
      visitCounts[move] = 0;
    }
  }

  return visitCounts;
}

// ============================================================
// 第四部分：自我对弈 + 训练
// ============================================================

function selfPlay(model, numSimulations = 50, verbose = false, logFile = null, gameIdx = null) {
  function log(msg) {
    if (verbose) console.log(msg);
    if (logFile) {
      fs.appendFileSync(logFile, msg + '\n');
    }
  }

  const board = new Board();
  const gameData = [];
  const moveHistory = [];

  if (verbose || logFile) {
    log(`\n${'='.repeat(50)}`);
    log(`第 ${gameIdx} 局开始`);
    log(`${'='.repeat(50)}`);
  }

  let step = 0;
  let winner;

  while (true) {
    step++;
    const playerName = board.currentPlayer === 1 ? 'X(黑)' : 'O(白)';

    // 用 MCTS 搜索当前最佳走法
    const visitCounts = mctsSearch(board, model, numSimulations);

    // 把访问次数转成概率分布
    const totalVisits = Object.values(visitCounts).reduce((a, b) => a + b, 0);
    if (totalVisits === 0) break;

    const policy = new Float32Array(9);
    for (const [move, count] of Object.entries(visitCounts)) {
      policy[parseInt(move)] = count / totalVisits;
    }

    // 记录训练数据
    gameData.push({
      state: board.toTensor().slice(),
      policy: policy.slice(),
      player: board.currentPlayer
    });

    // 选访问次数最多的走法
    let bestMove = null;
    let maxVisits = -1;
    for (const [move, count] of Object.entries(visitCounts)) {
      if (count > maxVisits) {
        maxVisits = count;
        bestMove = parseInt(move);
      }
    }

    // 日志
    if (verbose || logFile) {
      log(`\n--- 第 ${step} 步 | ${playerName} 行棋 ---`);
      log('当前棋盘:');
      const gridDisplay = [];
      for (let i = 0; i < 9; i++) {
        if (board.grid[i] === 1) gridDisplay.push('X');
        else if (board.grid[i] === -1) gridDisplay.push('O');
        else gridDisplay.push(String(i));
      }
      log(`  ${gridDisplay[0]} | ${gridDisplay[1]} | ${gridDisplay[2]}`);
      log(`  ---------`);
      log(`  ${gridDisplay[3]} | ${gridDisplay[4]} | ${gridDisplay[5]}`);
      log(`  ---------`);
      log(`  ${gridDisplay[6]} | ${gridDisplay[7]} | ${gridDisplay[8]}`);

      log(`MCTS 搜索分布 (共 ${totalVisits} 次模拟):`);
      const sortedMoves = Object.entries(visitCounts).sort((a, b) => b[1] - a[1]);
      for (const [move, count] of sortedMoves) {
        const pct = (count / totalVisits * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(pct / 2));
        const marker = parseInt(move) === bestMove ? ' ← 选中' : '';
        log(`  位置 ${move}: ${String(count).padStart(4)} 次 (${pct.padStart(5)}%) ${bar}${marker}`);
      }

      // 神经网络先验
      const { policy: netPolicy, value: netValue } = evaluatePosition(model, board.toTensor());
      log(`神经网络评估: 胜率预测 ${netValue >= 0 ? '+' : ''}${netValue.toFixed(2)}`);
      log(`神经网络先验 (Top 3):`);
      const top3 = Array.from({ length: 9 }, (_, i) => i).sort((a, b) => netPolicy[b] - netPolicy[a]).slice(0, 3);
      for (const i of top3) {
        log(`  位置 ${i}: ${(netPolicy[i] * 100).toFixed(1)}%`);
      }
    }

    board.play(bestMove);
    moveHistory.push(`${playerName}@${bestMove}`);

    if (verbose || logFile) {
      log(`决策: ${playerName} 落子位置 ${bestMove}`);
    }

    winner = board.checkWinner();
    if (winner !== null) break;
  }

  // 记录对局结果
  if (verbose || logFile) {
    log(`\n${'─'.repeat(50)}`);
    const result = winner === 1 ? 'X(黑) 胜' : winner === -1 ? 'O(白) 胜' : '平局';
    log(`对局结果: ${result} (共 ${step} 步)`);
    log(`走法记录: ${moveHistory.join(' → ')}`);
    log(`${'─'.repeat(50)}`);
  }

  // 把 winner 转成每个训练样本的标签
  const trainingData = [];
  for (const { state, policy, player } of gameData) {
    let value;
    if (winner === 0) value = 0;
    else if (winner === player) value = 1;
    else value = -1;
    trainingData.push({ state, policy, value });
  }

  return { trainingData, winner };
}

// ============================================================
// 训练函数
// ============================================================

async function train(numGames = 200, numSimulations = 50, lr = 0.003, verbose = false, logPath = 'training_log.txt') {
  const model = createPolicyValueNet();

  // 使用 Adam 优化器
  const optimizer = tf.train.adam(lr);

  // 初始化日志文件
  fs.writeFileSync(logPath,
    `AlphaGo 井字棋训练日志\n` +
    `训练参数: ${numGames} 局, ${numSimulations} 次模拟/步, lr=${lr}\n` +
    `开始时间: ${new Date().toLocaleString()}\n` +
    `${'='.repeat(50)}\n`
  );

  console.log('='.repeat(50));
  console.log('AlphaGo 井字棋 - 开始训练');
  console.log(`日志文件: ${logPath}`);
  console.log('='.repeat(50));

  const stats = { blackWin: 0, whiteWin: 0, draw: 0 };
  const startTime = Date.now();

  for (let gameIdx = 0; gameIdx < numGames; gameIdx++) {
    const gameStart = Date.now();

    // 自我对弈
    const showVerbose = verbose || gameIdx < 5 || (gameIdx + 1) % 10 === 0;
    const { trainingData, winner } = selfPlay(
      model, numSimulations,
      showVerbose && verbose,
      logPath,
      gameIdx + 1
    );

    // 用对弈数据训练网络
    let totalLoss = 0;

    for (const { state, policy, value } of trainingData) {
      const loss = optimizer.minimize(() => {
        return tf.tidy(() => {
          const stateT = tf.tensor2d([Array.from(state)]);
          const policyT = tf.tensor2d([Array.from(policy)]);
          const valueT = tf.tensor2d([[value]]);

          const [predPolicy, predValue] = model.apply(stateT);

          // 策略损失：交叉熵
          const logProbs = tf.logSoftmax(predPolicy, 1);
          const policyLoss = tf.neg(tf.sum(tf.mul(policyT, logProbs), 1));

          // 价值损失：MSE
          const valueLoss = tf.square(tf.sub(predValue, valueT));

          const totalLoss = tf.add(policyLoss, valueLoss);
          return totalLoss.mean();
        });
      }, true); // returnCost = true

      totalLoss += loss.dataSync()[0];
      loss.dispose();
    }

    // 更新统计
    const gameTime = (Date.now() - gameStart) / 1000;
    if (winner === 1) stats.blackWin++;
    else if (winner === -1) stats.whiteWin++;
    else stats.draw++;

    // 每 10 局打印进度
    if ((gameIdx + 1) % 10 === 0) {
      const resultStr = { 1: '黑赢', '-1': '白赢', 0: '平局' }[winner];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `第 ${String(gameIdx + 1).padStart(3)}/${numGames} 局 | ` +
        `结果: ${resultStr} | ` +
        `损失: ${(totalLoss / trainingData.length).toFixed(4)} | ` +
        `耗时: ${gameTime.toFixed(1)}s | ` +
        `统计: 黑${stats.blackWin} 白${stats.whiteWin} 平${stats.draw}`
      );

      fs.appendFileSync(logPath,
        `\n[摘要] 第 ${gameIdx + 1} 局 | ` +
        `损失: ${(totalLoss / trainingData.length).toFixed(4)} | ` +
        `耗时: ${gameTime.toFixed(1)}s | ` +
        `累计: 黑${stats.blackWin} 白${stats.whiteWin} 平${stats.draw}\n`
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const summary =
    `\n${'='.repeat(50)}\n` +
    `训练完成！\n` +
    `总耗时: ${totalTime}s\n` +
    `战绩统计: 黑赢 ${stats.blackWin} | 白赢 ${stats.whiteWin} | 平局 ${stats.draw}\n` +
    `${'='.repeat(50)}`;

  console.log(summary);
  fs.appendFileSync(logPath, summary);
  console.log(`详细日志已保存到: ${logPath}`);

  return model;
}

// ============================================================
// 第五部分：人机对弈
// ============================================================

async function playAgainstHuman(model, numSimulations = 200) {
  const board = new Board();
  console.log('你是 X（先手），AI 是 O（后手）');
  console.log('输入 0-8 落子：');
  console.log('0 1 2');
  console.log('3 4 5');
  console.log('6 7 8');
  console.log();
  board.display();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

  while (true) {
    if (board.currentPlayer === 1) {
      // 人类走
      let move;
      while (true) {
        const answer = await askQuestion(`你的走法 (合法: [${board.legalMoves().join(', ')}]): `);
        move = parseInt(answer);
        if (!isNaN(move) && board.legalMoves().includes(move)) break;
        console.log('非法走法，重试');
      }
      board.play(move);
    } else {
      // AI 走
      console.log('AI 思考中...');
      const visitCounts = mctsSearch(board, model, numSimulations);
      let bestMove = null;
      let maxVisits = -1;
      for (const [move, count] of Object.entries(visitCounts)) {
        if (count > maxVisits) {
          maxVisits = count;
          bestMove = parseInt(move);
        }
      }
      console.log(`AI 选择位置 ${bestMove}`);
      board.play(bestMove);
    }

    board.display();

    const winner = board.checkWinner();
    if (winner !== null) {
      if (winner === 1) console.log('你赢了！');
      else if (winner === -1) console.log('AI 赢了！');
      else console.log('平局！');
      break;
    }
  }

  rl.close();
}

// ============================================================
// 模型保存/加载
// ============================================================

async function saveModel(model, path = './tictactoe_model') {
  await model.save(`file://${path}`);
  console.log(`模型已保存到 ${path}/`);
}

async function loadModel(path = './tictactoe_model') {
  const model = await tf.loadLayersModel(`file://${path}/model.json`);
  console.log(`已加载模型 ${path}/`);
  return model;
}

// ============================================================
// 主程序
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const playOnly = args.includes('--play');

  if (playOnly) {
    const model = await loadModel();
    await playAgainstHuman(model);
  } else {
    // 训练
    const model = await train(
      200,   // numGames
      50,    // numSimulations
      0.003, // lr
      verbose,
      'training_log.txt'
    );

    // 保存模型
    await saveModel(model);

    // 人机对弈
    console.log('\n' + '='.repeat(50));
    console.log('来和 AI 下一盘吧！');
    console.log('='.repeat(50));
    await playAgainstHuman(model);
  }
}

// 导出模块（供测试用）
if (typeof module !== 'undefined') {
  module.exports = { Board, MCTSNode, createPolicyValueNet, mctsSearch, selfPlay, train, playAgainstHuman };
}

if (require.main === module) {
  main().catch(console.error);
}
