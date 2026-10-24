"""
碰手游戏 —— 状态空间求解器（全空间版）
====================================

与旧版区别:
- 旧版只从 (0,1,1,1,1) 出发 DFS, 只导出可达局面。
- 新版遍历 turn∈{0,1} 与 ai,bi∈[1,WIN] 的所有组合,
  对每个局面调用 build (内部记忆化, 重复局面自动复用),
  最终导出全部 2 * WIN^4 个局面 (WIN=10 时为 20000 个)。
"""

import sys
sys.setrecursionlimit(100000)

# ===================== 可配置参数 =====================
WIN = 10            # 完成阈值: 手值 >= WIN 即完成
SIZE = WIN + 1      # 数组每维大小 (下标 0 空置, 手值 1~WIN 直接用)
# ====================================================

# 全局数组与统计
state = [[[[[None] * SIZE for _ in range(SIZE)]
           for _ in range(SIZE)]
          for _ in range(SIZE)]
         for _ in range(2)]

leaf_num = 0      # 终局状态数
visited_num = 0   # 实际创建(非复用)的节点数


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
    """
    递归构建 + 计算概率。
    turn: 0 = 该 A 决策, 1 = 该 B 决策
    返回该状态对应的 Node。
    """
    global leaf_num, visited_num

    # 1. 查表: 已存在 -> 复用(必已算完)
    existing = state[turn][a1][a2][b1][b2]
    if existing is not None:
        return existing

    # 2. 新建节点并登记
    node = Node(a1, a2, b1, b2)
    state[turn][a1][a2][b1][b2] = node
    visited_num += 1

    # 3. 终局判定
    if a1 >= WIN and a2 >= WIN:
        leaf_num += 1
        node.A_p, node.B_p = 1.0, 0.0
        return node
    if b1 >= WIN and b2 >= WIN:
        leaf_num += 1
        node.A_p, node.B_p = 0.0, 1.0
        return node

    # 4. 确定攻击方 / 被碰方
    if turn == 0:      # A 决策, A 攻击
        atk = [a1, a2]
        dfd = [b1, b2]
    else:              # B 决策, B 攻击
        atk = [b1, b2]
        dfd = [a1, a2]

    # 5. 展开 4 种碰法
    a_ps, b_ps = [], []

    for atk_idx in range(2):
        for def_idx in range(2):
            idx = 2 * atk_idx + def_idx

            # 非法: 攻击手已完成 或 被碰手已完成
            if atk[atk_idx] >= WIN or dfd[def_idx] >= WIN:
                node.childs[idx] = None
                continue

            # 合法: 计算新状态
            new_atk = list(atk)
            v = new_atk[atk_idx] + dfd[def_idx]
            new_atk[atk_idx] = WIN if v >= WIN else v

            if turn == 0:
                na1, na2, nb1, nb2 = new_atk[0], new_atk[1], dfd[0], dfd[1]
            else:
                na1, na2, nb1, nb2 = dfd[0], dfd[1], new_atk[0], new_atk[1]

            # 递归(内部查表复用)
            child = build(na1, na2, nb1, nb2, 1 - turn)
            node.childs[idx] = child
            a_ps.append(child.A_p)
            b_ps.append(child.B_p)

    # 6. 保险: 非终局却无合法孩子 -> 抛异常
    if not a_ps:
        raise RuntimeError(
            f"非终局却无合法走法: "
            f"A[{a1},{a2}] B[{b1},{b2}] turn={turn}"
        )

    # 7. 回溯计算
    if turn == 0:      # A 决策
        node.A_p = max(a_ps)
        node.B_p = sum(b_ps) / len(b_ps)
    else:              # B 决策
        node.A_p = sum(a_ps) / len(a_ps)
        node.B_p = max(b_ps)

    return node


#   导出  json

import json

def export_json(filename="data.json"):
    """
    遍历全局 state 数组, 导出所有已创建的节点。
    键格式: "turn:a1,a2,b1,b2"
    值: { "A_p": ..., "B_p": ..., "childs": [null 或 "turn:a1,a2,b1,b2", ...] }
    """
    data = {}

    def key_of(turn, n):
        return f"{turn}:{n.A_1},{n.A_2},{n.B_1},{n.B_2}"

    for turn in (0, 1):
        for a1 in range(1, WIN + 1):
            for a2 in range(1, WIN + 1):
                for b1 in range(1, WIN + 1):
                    for b2 in range(1, WIN + 1):
                        node = state[turn][a1][a2][b1][b2]
                        if node is None:
                            continue
                        k = key_of(turn, node)
                        child_keys = [None, None, None, None]
                        for i, c in enumerate(node.childs):
                            if c is not None:
                                child_keys[i] = key_of(1 - turn, c)
                        data[k] = {
                            "A_p": node.A_p,
                            "B_p": node.B_p,
                            "childs": child_keys,
                        }

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    print(f"已导出 {len(data)} 个状态到 {filename}")
    return data


# ===================== 运行 =====================

if __name__ == "__main__":
    # 遍历全空间: turn ∈ {0,1}, a1,a2,b1,b2 ∈ [1,WIN]
    total_cases = 2 * (WIN ** 4)
    for turn in (0, 1):
        for a1 in range(1, WIN + 1):
            for a2 in range(1, WIN + 1):
                for b1 in range(1, WIN + 1):
                    for b2 in range(1, WIN + 1):
                        build(a1, a2, b1, b2, turn)

    print("=" * 60)
    print(f"构建完成  (WIN = {WIN})")
    print("=" * 60)
    print(f"理论局面数  (2 * WIN^4) : {total_cases}")
    print(f"实际创建的节点数 (visited_num) : {visited_num}")
    print(f"终局状态数       (leaf_num)    : {leaf_num}")
    print("=" * 60)

    # 原根节点胜率(仍然可查, 作为参考)
    root = state[0][1][1][1][1]
    if root is not None:
        print(f"根节点 A[1,1] B[1,1] (A先手):")
        print(f"  A_p = {root.A_p:.6f}   (A最优/B随机 下 A 胜率)")
        print(f"  B_p = {root.B_p:.6f}   (B最优/A随机 下 B 胜率)")
        print("=" * 60)

    export_json("data.json")


    