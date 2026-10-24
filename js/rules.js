// Pure game rules. No DOM access, animation, timers, or mutable application state.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { WIN } = HC.config;
  const otherSide = side => side === 'A' ? 'B' : 'A';

  function keyOf(turn, a1, a2, b1, b2) {
    return `${turn}:${a1},${a2},${b1},${b2}`;
  }

  function stateKey(turn, hands) {
    return keyOf(turn, ...hands.A, ...hands.B);
  }

  function winner(hands) {
    if (hands.A.every(value => value >= WIN)) return 'A';
    if (hands.B.every(value => value >= WIN)) return 'B';
    return null;
  }

  function legalMoves(hands, side) {
    if (winner(hands)) return [];
    const moves = [];
    for (let attack = 0; attack < 2; attack++) {
      for (let target = 0; target < 2; target++) {
        if (hands[side][attack] < WIN && hands[otherSide(side)][target] < WIN) {
          moves.push(2 * attack + target);
        }
      }
    }
    return moves;
  }

  function applyMove(hands, side, move) {
    if (!legalMoves(hands, side).includes(move)) throw new Error('非法走法');
    const next = { A: [...hands.A], B: [...hands.B] };
    const attack = Math.floor(move / 2);
    next[side][attack] = Math.min(WIN, hands[side][attack] + hands[otherSide(side)][move % 2]);
    return next;
  }

  function chooseMove(hands, side, strategy, table, random = Math.random) {
    const moves = legalMoves(hands, side);
    if (!moves.length) return null;
    if (strategy === 'random') return moves[Math.floor(random() * moves.length)];
    const entry = table?.[stateKey(side === 'A' ? 0 : 1, hands)];
    const score = move => table?.[entry?.childs[move]]?.[`${side}_p`] ?? -Infinity;
    // Preserve the first legal move when several moves share the best score.
    return moves.reduce((best, move) => score(move) > score(best) ? move : best);
  }

  HC.rules = Object.freeze({ otherSide, keyOf, stateKey, winner, legalMoves, applyMove, chooseMove });
})();
