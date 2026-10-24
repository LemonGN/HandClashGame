"""
碰手游戏 —— 状态空间求解器（随机策略版 + 最大跃升边查找）
=========================================================

一、游戏规则
------------
- 双方各有两只手, 初始点数均为 1。
- 轮到一方时, 选择自己一只未完成的手(攻击手)和对方一只未完成的手(目标手)。
- 目标手的点数会加到攻击手上, 达到或超过 WIN(默认 10)记为 WIN, 即"完成"。
  (注意: 是加到"自己"手上, 不是加到对方手上。)
- 已完成(值为 WIN)的手不能再用于攻击, 也不能再被选为目标。
- 先让两只手都完成的一方获胜; A 为先手, B 为后手, 双方交替行动。

二、状态与动作编码
------------------
状态: (turn, A1, A2, B1, B2)
    turn = 0 -> A 行动; turn = 1 -> B 行动
    Ai/Bi ∈ [1, WIN], 其中 WIN 表示该手已完成
动作: idx = 2 * atk_idx + def_idx (0..3)
    0 -> 攻击方手1 碰 对方手1    1 -> 攻击方手1 碰 对方手2
    2 -> 攻击方手2 碰 对方手1    3 -> 攻击方手2 碰 对方手2
    攻击手或目标手已完成时该动作非法(记为 None)。

三、算法（本版本）
------------------
记忆化 DFS 计算双方"随机决策"下的胜率:
- A_p = 从该状态出发, 双方每一步都均匀随机选择合法动作时, A 获胜的概率。
- B_p = 1 - A_p （同理）。
- 回溯: A_p = mean(子节点 A_p), B_p = mean(子节点 B_p)。
  终局 A 双手完成 -> (1, 0); B 双手完成 -> (0, 1)。
- 归纳可证: 全图 A_p + B_p = 1。

四、最大跃升边
--------------
遍历整张状态图的所有父子边:
- A 视角: 对每条边计算 child.A_p - parent.A_p, 取最大者。
  （这是"轮到 A 决策"的边中, 单步操作对 A 胜率提升最大的操作。）
- B 视角: 对每条边计算 child.B_p - parent.B_p, 取最大者。
  （这是"轮到 B 决策"的边中, 单步操作对 B 胜率提升最大的操作。）
注意: 父子边中只有"父节点轮到该方决策"的边才真正对应"该方的操作"。
      但为了完整, 下面会分别统计 turn=0 和 turn=1 的边。
"""

import sys
import json

sys.setrecursionlimit(100000)

# ===================== 可配置参数 =====================
WIN = 10            # 完成阈值: 手值 >= WIN 即完成
SIZE = WIN + 1      # 数组每维大小
# ====================================================

state = [[[[[None] * SIZE for _ in range(SIZE)]
           for _ in range(SIZE)]
          for _ in range(SIZE)]
         for _ in range(2)]

leaf_num = 0
visited_num = 0


class Node:
    __slots__ = ("A_1", "A_2", "B_1", "B_2", "A_p", "B_p", "childs")

    def __init__(self, A_1, A_2, B_1, B_2):
        self.A_1 = A_1
        self.A_2 = A_2
        self.B_1 = B_1
        self.B_2 = B_2
        self.A_p = None
        self.B_p = None
        self.childs = [None, None, None, None]


def build(a1, a2, b1, b2, turn):
    global leaf_num, visited_num

    existing = state[turn][a1][a2][b1][b2]
    if existing is not None:
        return existing

    node = Node(a1, a2, b1, b2)
    state[turn][a1][a2][b1][b2] = node
    visited_num += 1

    # 终局
    if a1 >= WIN and a2 >= WIN:
        leaf_num += 1
        node.A_p, node.B_p = 1.0, 0.0
        return node
    if b1 >= WIN and b2 >= WIN:
        leaf_num += 1
        node.A_p, node.B_p = 0.0, 1.0
        return node

    if turn == 0:
        atk = [a1, a2]
        dfd = [b1, b2]
    else:
        atk = [b1, b2]
        dfd = [a1, a2]

    a_ps, b_ps = [], []

    for atk_idx in range(2):
        for def_idx in range(2):
            idx = 2 * atk_idx + def_idx

            if atk[atk_idx] >= WIN or dfd[def_idx] >= WIN:
                node.childs[idx] = None
                continue

            new_atk = list(atk)
            v = new_atk[atk_idx] + dfd[def_idx]
            new_atk[atk_idx] = WIN if v >= WIN else v

            if turn == 0:
                na1, na2, nb1, nb2 = new_atk[0], new_atk[1], dfd[0], dfd[1]
            else:
                na1, na2, nb1, nb2 = dfd[0], dfd[1], new_atk[0], new_atk[1]

            child = build(na1, na2, nb1, nb2, 1 - turn)
            node.childs[idx] = child
            a_ps.append(child.A_p)
            b_ps.append(child.B_p)

    if not a_ps:
        raise RuntimeError(
            f"非终局却无合法走法: "
            f"A[{a1},{a2}] B[{b1},{b2}] turn={turn}"
        )

    # 纯随机策略: 双方都均匀随机选合法动作
    node.A_p = sum(a_ps) / len(a_ps)
    node.B_p = sum(b_ps) / len(b_ps)
    # 数值上必然 = 1 - A_p，这里不再强制归一（便于自检）
    return node


# ===================== 查找最大跃升边 =====================

# ===================== 查找最大跃升边（排除叶子子节点） =====================

def is_terminal(node):
    """终局判定: 任一方双手均完成。"""
    return (node.A_1 >= WIN and node.A_2 >= WIN) or \
           (node.B_1 >= WIN and node.B_2 >= WIN)


def find_best_gain_edges(root, exclude_leaf_child=True):
    """
    遍历整张状态图, 对每条父子边计算:
        gainA = child.A_p - parent.A_p
        gainB = child.B_p - parent.B_p
    分别找出:
        - turn=0 (A 决策) 的边中 gainA 最大者
        - turn=1 (B 决策) 的边中 gainB 最大者

    参数:
        exclude_leaf_child=True 时, 跳过"子节点为终局(叶子)"的边,
        只在父子都非终局的边中找最大跃升。
    """
    bestA = None
    bestB = None

    visited = set()

    def key_of(turn, n):
        return (turn, n.A_1, n.A_2, n.B_1, n.B_2)

    def dfs(node, turn):
        nonlocal bestA, bestB
        k = key_of(turn, node)
        if k in visited:
            return
        visited.add(k)

        for i, c in enumerate(node.childs):
            if c is None:
                continue

            # 排除叶子子节点
            if exclude_leaf_child and is_terminal(c):
                # 仍然要递归下去（虽然终局节点没有孩子，递归无副作用，
                # 但保持遍历完整性；终局节点 childs 全 None，会立即返回）
                dfs(c, 1 - turn)
                continue

            gainA = c.A_p - node.A_p
            gainB = c.B_p - node.B_p

            if turn == 0:
                if bestA is None or gainA > bestA["gain"]:
                    bestA = {
                        "parent_turn": turn,
                        "parent": (node.A_1, node.A_2, node.B_1, node.B_2),
                        "child":  (c.A_1, c.A_2, c.B_1, c.B_2),
                        "action_idx": i,
                        "parent_A_p": node.A_p,
                        "child_A_p": c.A_p,
                        "gain": gainA,
                    }

            if turn == 1:
                if bestB is None or gainB > bestB["gain"]:
                    bestB = {
                        "parent_turn": turn,
                        "parent": (node.A_1, node.A_2, node.B_1, node.B_2),
                        "child":  (c.A_1, c.A_2, c.B_1, c.B_2),
                        "action_idx": i,
                        "parent_B_p": node.B_p,
                        "child_B_p": c.B_p,
                        "gain": gainB,
                    }

            dfs(c, 1 - turn)

    dfs(root, 0)
    return bestA, bestB


ACTION_DESC = {
    0: "攻击手1 碰 对方手1",
    1: "攻击手1 碰 对方手2",
    2: "攻击手2 碰 对方手1",
    3: "攻击手2 碰 对方手2",
}


def export_json(root, filename="data.json"):
    data = {}
    visited = set()

    def key_of(turn, n):
        return f"{turn}:{n.A_1},{n.A_2},{n.B_1},{n.B_2}"

    def dfs(node, turn):
        k = key_of(turn, node)
        if k in visited:
            return
        visited.add(k)
        child_keys = [None, None, None, None]
        for i, c in enumerate(node.childs):
            if c is not None:
                child_keys[i] = key_of(1 - turn, c)
        data[k] = {"A_p": node.A_p, "B_p": node.B_p, "childs": child_keys}
        for c in node.childs:
            if c is not None:
                dfs(c, 1 - turn)

    dfs(root, 0)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"已导出 {len(data)} 个状态到 {filename}")
    return data


# ===================== 运行 =====================

if __name__ == "__main__":
    root = build(1, 1, 1, 1, turn=0)

    print("=" * 70)
    print(f"构建完成  (WIN = {WIN})")
    print("=" * 70)
    print(f"实际创建的节点数 : {visited_num}")
    print(f"终局状态数       : {leaf_num}")
    print()
    print(f"根节点 A[1,1] B[1,1] (A先手, 双方随机):")
    print(f"  A_p = {root.A_p:.6f}")
    print(f"  B_p = {root.B_p:.6f}")
    print(f"  A_p + B_p = {root.A_p + root.B_p:.6f}")
    print("=" * 70)
    bestA, bestB = find_best_gain_edges(root, exclude_leaf_child=True)

    print("\n【A 视角: 单步操作对 A 胜率提升最大的边】")
    if bestA:
        p = bestA["parent"]; c = bestA["child"]
        print(f"  父状态 (turn=A, A[{p[0]},{p[1]}] B[{p[2]},{p[3]}]):  A_p = {bestA['parent_A_p']:.6f}")
        print(f"  操作: idx={bestA['action_idx']}  ({ACTION_DESC[bestA['action_idx']]})")
        print(f"  子状态 (turn=B, A[{c[0]},{c[1]}] B[{c[2]},{c[3]}]):  A_p = {bestA['child_A_p']:.6f}")
        print(f"  A_p 提升 = {bestA['gain']:.6f}")

    print("\n【B 视角: 单步操作对 B 胜率提升最大的边】")
    if bestB:
        p = bestB["parent"]; c = bestB["child"]
        print(f"  父状态 (turn=B, A[{p[0]},{p[1]}] B[{p[2]},{p[3]}]):  B_p = {bestB['parent_B_p']:.6f}")
        print(f"  操作: idx={bestB['action_idx']}  ({ACTION_DESC[bestB['action_idx']]})")
        print(f"  子状态 (turn=A, A[{c[0]},{c[1]}] B[{c[2]},{c[3]}]):  B_p = {bestB['child_B_p']:.6f}")
        print(f"  B_p 提升 = {bestB['gain']:.6f}")

    print("=" * 70)

    # export_json(root, "data.json")