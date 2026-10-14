function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeRoundMetrics({
  isEasy,
  reviveGraceLeft,
  round,
  chaos,
  predictability,
  abstractness,
  predScore
}) {
  let chaosUp, chaosDown, predUp, predDown;
  let nextReviveGraceLeft = reviveGraceLeft || 0;

  if (isEasy) {
    chaosUp = 0.35; chaosDown = 0.1; predUp = 0.15; predDown = 0.15;
  } else if (nextReviveGraceLeft > 0) {
    nextReviveGraceLeft--;
    chaosUp = 0.22; chaosDown = 0.12; predUp = 0.25; predDown = 0.08;
  } else if (round <= 3) {
    chaosUp = 0.30; chaosDown = 0.08; predUp = 0.12; predDown = 0.12;
  } else if (round <= 6) {
    chaosUp = 0.22; chaosDown = 0.12; predUp = 0.25; predDown = 0.08;
  } else {
    chaosUp = 0.15; chaosDown = 0.15; predUp = 0.38; predDown = 0.04;
  }

  if (!isEasy && chaos < 80) chaosUp += 0.10;

  const chaosDelta = Math.floor(abstractness * chaosUp) - Math.floor(predScore * chaosDown);
  const newChaos = clamp(chaos + chaosDelta, 0, 120);

  const predDelta = Math.floor(predScore * predUp) - Math.floor(abstractness * predDown);
  const newPred = clamp(predictability + predDelta, 0, 100);

  return { chaosDelta, newChaos, predDelta, newPred, nextReviveGraceLeft };
}

function pickSparkOutOutcome(chaos, predictability) {
  const ratio = chaos / Math.max(1, predictability);
  return ratio > 1.5 ? 'victory' : 'defeat';
}

function calcRevivePred(predictability, reviveReason) {
  if (reviveReason === 'pred') {
    return Math.max(0, Math.floor(predictability * 0.7));
  }
  return Math.max(0, predictability - 30);
}

module.exports = {
  computeRoundMetrics,
  pickSparkOutOutcome,
  calcRevivePred
};
