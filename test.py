"""
碰手游戏 - 状态空间树构建与概率计算

节点字段:
    A_1, A_2, B_1, B_2 : 四只手的数字 (1~9 未完成, 10 已完成)
    A_p : A采用最优策略、B采用随机策略时, A在当前局面获胜的概率
    B_p : B采用最优策略、A采用随机策略时, B在当前局面获胜的概率
    childs : 长度4的列表, 对应 4 种碰法:
        childs[0] = 用手1 碰 对方手1
        childs[1] = 用手1 碰 对方手2
        childs[2] = 用手2 碰 对方手1
        childs[3] = 用手2 碰 对方手2
        非法操作为 None

深度约定(不存进节点):
    depth = 2n   -> 该 A 决策
    depth = 2n+1 -> 该 B 决策

回溯规则:
    A决策节点: A_p = max(子.A_p),  B_p = mean(子.B_p)
    B决策节点: A_p = mean(子.A_p), B_p = max(子.B_p)
    mean 只对非 None 的子节点取平均

终局:
    A 两只手都完成 -> A_p=1, B_p=0
    B 两只手都完成 -> A_p=0, B_p=1
"""

# WIN = 10
# leaf_num = 0
# node_total_num = 0


# class Tree_Node:
#     def __init__(self, A_1, A_2, B_1, B_2):
#         global node_total_num
#         node_total_num += 1
#         self.A_1 = A_1
#         self.A_2 = A_2
#         self.B_1 = B_1
#         self.B_2 = B_2
#         self.A_p = None
#         self.B_p = None
#         self.childs = [None, None, None, None]

#     def is_leaf(self):
#         """任一方两只手都完成, 即为终局"""
#         a_done = (self.A_1 >= WIN and self.A_2 >= WIN)
#         b_done = (self.B_1 >= WIN and self.B_2 >= WIN)
#         return a_done or b_done


# def apply_hit(attacker_hands, defender_hands, atk_idx, def_idx):
#     """
#     攻击方用手 atk_idx 碰 被碰方手 def_idx。
#     返回 (new_attacker_hands, new_defender_hands)。
#     攻击方那只手 += 被碰方那只手, >=10 记 10; 被碰方不变。
#     """
#     new_atk = list(attacker_hands)
#     val = new_atk[atk_idx] + defender_hands[def_idx]
#     new_atk[atk_idx] = WIN if val >= WIN else val
#     return new_atk, list(defender_hands)


# def legal(atk_hand, def_hand):
#     """攻击方手 <10 且 被碰方手 <10 才合法"""
#     return atk_hand < WIN and def_hand < WIN


# def build(node, depth):
#     """
#     DFS 构建状态空间树, 并在回溯时计算 A_p / B_p。
#     """
#     # --- 终局 ---
#     if node.is_leaf():
#         global leaf_num
#         leaf_num += 1
#         if node.A_1 >= WIN and node.A_2 >= WIN:
#             node.A_p, node.B_p = 1.0, 0.0
#         else:
#             node.A_p, node.B_p = 0.0, 1.0
#         return

#     # --- 判断当前谁决策 / 谁是攻击方 ---
#     a_turn = (depth % 2 == 0)  # 偶数深度: A 决策, A 是攻击方

#     # 当前行动方的手 / 对方的手
#     if a_turn:
#         atk_hands = [node.A_1, node.A_2]
#         dfd_hands = [node.B_1, node.B_2]
#     else:
#         atk_hands = [node.B_1, node.B_2]
#         dfd_hands = [node.A_1, node.A_2]

#     # --- 生成 4 种碰法对应的子节点 ---
#     # childs 下标编码: 2*atk_idx + def_idx
#     for atk_idx in range(2):
#         for def_idx in range(2):
#             idx = 2 * atk_idx + def_idx
#             if not legal(atk_hands[atk_idx], dfd_hands[def_idx]):
#                 node.childs[idx] = None
#                 continue

#             new_atk, new_dfd = apply_hit(atk_hands, dfd_hands,
#                                          atk_idx, def_idx)

#             if a_turn:
#                 # A 攻击: A 的手变了, B 不变
#                 child = Tree_Node(new_atk[0], new_atk[1],
#                              new_dfd[0], new_dfd[1])
#             else:
#                 # B 攻击: B 的手变了, A 不变
#                 child = Tree_Node(new_dfd[0], new_dfd[1],
#                              new_atk[0], new_atk[1])

#             build(child, depth + 1)
#             node.childs[idx] = child

#     # --- 回溯: 按决策方计算 A_p / B_p ---
#     valid_children = [c for c in node.childs if c is not None]

#     # 边界保险: 若一个合法子节点都没有(理论上不会, 因为终局已被上面拦截)
#     if not valid_children:
#         node.A_p, node.B_p = 0.5, 0.5
#         return

#     a_ps = [c.A_p for c in valid_children]
#     b_ps = [c.B_p for c in valid_children]

#     if a_turn:
#         # A 决策: A_p 取 max, B_p 取 mean
#         node.A_p = max(a_ps)
#         node.B_p = sum(b_ps) / len(b_ps)
#     else:
#         # B 决策: A_p 取 mean, B_p 取 max
#         node.A_p = sum(a_ps) / len(a_ps)
#         node.B_p = max(b_ps)


# # 打印信息：
# def get_path_info(root):
#     """
#     返回:
#         shortest_paths: 最短路径列表
#         longest_paths : 最长路径列表
#         shortest_len  : 最短路径长度(边数)
#         longest_len   : 最长路径长度(边数)

#     路径元素格式:
#         ("node", node)      节点
#         ("edge", idx, name) 动作边
#     """
#     move_names = [
#         "手1碰对方手1",
#         "手1碰对方手2",
#         "手2碰对方手1",
#         "手2碰对方手2",
#     ]

#     def dfs(node, depth, path, all_paths):
#         if node.is_leaf():
#             all_paths.append((depth, list(path)))
#             return

#         for idx, child in enumerate(node.childs):
#             if child is None:
#                 continue
#             path.append(("edge", idx, move_names[idx]))
#             path.append(("node", child))
#             dfs(child, depth + 1, path, all_paths)
#             path.pop()
#             path.pop()

#     all_paths = []
#     start_path = [("node", root)]
#     dfs(root, 0, start_path, all_paths)

#     if not all_paths:
#         return [], [], 0, 0

#     min_len = min(d for d, _ in all_paths)
#     max_len = max(d for d, _ in all_paths)

#     shortest_paths = [p for d, p in all_paths if d == min_len]
#     longest_paths = [p for d, p in all_paths if d == max_len]

#     return shortest_paths, longest_paths, min_len, max_len


# def print_one_path(path, title=""):
#     """打印一条路径"""
#     if title:
#         print(title)

#     for item in path:
#         if item[0] == "node":
#             node = item[1]
#             print(f"  A[{node.A_1},{node.A_2}] B[{node.B_1},{node.B_2}] "
#                   f"A_p={fmt_p(node.A_p)} B_p={fmt_p(node.B_p)}")
#         else:
#             _, idx, name = item
#             print(f"    └── [{name}]")


# def print_shortest_and_longest_paths(root):
#     """打印最短/最长路径的数量，并各挑一条打印"""
#     shortest_paths, longest_paths, shortest_len, longest_len = get_path_info(root)

#     print("=" * 70)
#     print("最短路径")
#     print("=" * 70)
#     print(f"长度(边数): {shortest_len}")
#     print(f"数量: {len(shortest_paths)}")
#     if shortest_paths:
#         print()
#         print_one_path(shortest_paths[0], "--- 示例最短路径 ---")

#     print("\n" + "=" * 70)
#     print("最长路径")
#     print("=" * 70)
#     print(f"长度(边数): {longest_len}")
#     print(f"数量: {len(longest_paths)}")
#     if longest_paths:
#         print()
#         print_one_path(longest_paths[0], "--- 示例最长路径 ---")

import sys
import random

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


# ============================================================
# ============ 控制台对局 =====================================
# ============================================================

MOVE_NAMES = ["手1碰对方手1", "手1碰对方手2", "手2碰对方手1", "手2碰对方手2"]


def is_leaf(node):
    return all(c is None for c in node.childs)


def legal_moves(node):
    """返回 [(idx, child), ...] 合法走法"""
    return [(i, c) for i, c in enumerate(node.childs) if c is not None]


def show_board(node):
    """垂直排列显示当前局面"""
    print()
    print(f"  当前局面:")
    print(f"    A: [{node.A_1}, {node.A_2}]")
    print(f"    B: [{node.B_1}, {node.B_2}]")
    print(f"    A_p={node.A_p:.4f}   B_p={node.B_p:.4f}")


def choose_human(node, turn):
    """人类选走法, 显示每个选项走完后的 A_p / B_p"""
    moves = legal_moves(node)
    print("  可选走法:")
    for j, (idx, child) in enumerate(moves):
        print(f"    [{j}] {MOVE_NAMES[idx]}")
        print(f"         -> A:[{child.A_1}, {child.A_2}]  "
              f"B:[{child.B_1}, {child.B_2}]")
        print(f"         -> A_p={child.A_p:.4f}   B_p={child.B_p:.4f}")
    while True:
        raw = input("  请选择编号: ").strip()
        if raw.isdigit() and 0 <= int(raw) < len(moves):
            return moves[int(raw)][1]
        print("  无效输入，重试")


def choose_random(node):
    moves = legal_moves(node)
    idx, child = random.choice(moves)
    print(f"  电脑(随机)选择: {MOVE_NAMES[idx]}")
    print(f"    -> A:[{child.A_1}, {child.A_2}]  B:[{child.B_1}, {child.B_2}]")
    print(f"    -> A_p={child.A_p:.4f}   B_p={child.B_p:.4f}")
    return child


def choose_best(node, turn):
    """
    最优策略:
      turn==0 (A): 选 A_p 最大的孩子
      turn==1 (B): 选 B_p 最大的孩子
    """
    moves = legal_moves(node)
    if turn == 0:
        idx, child = max(moves, key=lambda x: x[1].A_p)
    else:
        idx, child = max(moves, key=lambda x: x[1].B_p)
    print(f"  电脑(最优)选择: {MOVE_NAMES[idx]}")
    print(f"    -> A:[{child.A_1}, {child.A_2}]  B:[{child.B_1}, {child.B_2}]")
    print(f"    -> A_p={child.A_p:.4f}   B_p={child.B_p:.4f}")
    return child


def play_game(root):
    print("\n" + "=" * 60)
    print("开始对局")
    print("=" * 60)

    # --- 选择先手 ---
    while True:
        raw = input("你选择先手还是后手? (先手输入 A / 后手输入 B): ").strip().upper()
        if raw in ("A", "B"):
            human_side = raw
            break
        print("  请输入 A 或 B")

    # --- 选择电脑策略 ---
    while True:
        raw = input("电脑采用 随机 还是 最优 策略? (随机 r / 最优 b): ").strip().lower()
        if raw in ("r", "b"):
            ai_strategy = raw
            break
        print("  请输入 r 或 b")

    print(f"\n你是 {human_side} 方；电脑使用 "
          f"{'随机' if ai_strategy=='r' else '最优'} 策略")

    node = root
    step = 0
    while not is_leaf(node):
        turn = step % 2
        side = "A" if turn == 0 else "B"

        show_board(node)

        if side == human_side:
            print(f"  轮到 你({side}) 行动")
            node = choose_human(node, turn)
        else:
            print(f"  轮到 电脑({side}) 行动")
            if ai_strategy == "r":
                node = choose_random(node)
            else:
                node = choose_best(node, turn)

        step += 1

    show_board(node)
    if node.A_1 >= WIN and node.A_2 >= WIN:
        winner = "A"
    else:
        winner = "B"

    print("\n" + "=" * 60)
    if winner == human_side:
        print(f"  🎉 你({human_side}) 获胜！")
    else:
        print(f"  💻 电脑({winner}) 获胜！")
    print("=" * 60)

#   导出  json

import json

def export_json(root, filename="data.json"):
    """
    遍历整张状态图, 导出每个状态的 (A_p, B_p, childs索引) 成 JSON。
    键格式: "turn:a1,a2,b1,b2"
    值: { "A_p": ..., "B_p": ..., "childs": [null 或 "turn:a1,a2,b1,b2", ...] }
    """
    data = {}
    visited = set()

    def key_of(turn, n):
        return f"{turn}:{n.A_1},{n.A_2},{n.B_1},{n.B_2}"

    def dfs(node, turn):
        k = key_of(turn, node)
        if k in visited:
            return
        visited.add(k)

        # 四个孩子: 记录"子节点键"或 null
        child_keys = [None, None, None, None]
        for i, c in enumerate(node.childs):
            if c is not None:
                child_keys[i] = key_of(1 - turn, c)

        data[k] = {
            "A_p": node.A_p,
            "B_p": node.B_p,
            "childs": child_keys,
        }

        # 递归
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

    print("=" * 60)
    print(f"构建完成  (WIN = {WIN})")
    print("=" * 60)
    print(f"实际创建的节点数 (visited_num) : {visited_num}")
    print(f"终局状态数       (leaf_num)    : {leaf_num}")
    print()
    print(f"根节点 A[1,1] B[1,1] (A先手):")
    print(f"  A_p = {root.A_p:.6f}   (A最优/B随机 下 A 胜率)")
    print(f"  B_p = {root.B_p:.6f}   (B最优/A随机 下 B 胜率)")
    print("=" * 60)


    # 进入对局
    # play_game(root)

    export_json(root, "data.json")