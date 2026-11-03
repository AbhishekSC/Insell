// ── Response-shaping helpers ───────────────────────────────────────────

export function toPaginationDTO({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function toBlockPostDTO(post) {
  return {
    postId: post._id,
    isBlocked: post.isBlocked,
    blockedAt: post.blockedAt,
    blockReasonCode: post.blockReasonCode,
    blockNote: post.blockNote,
  };
}

export function toUnblockPostDTO(post) {
  return {
    postId: post._id,
    isBlocked: post.isBlocked,
  };
}

export function toToggleUserBlockDTO(user) {
  return {
    userId: user._id,
    isBlocked: user.isBlocked,
    blockedAt: user.blockedAt,
  };
}

export function toCreditCoinsDTO({ userId, coinAmount, wallet, fullName }) {
  return {
    userId,
    coinsGranted: coinAmount,
    newBalance: wallet.balance,
  };
}

export function toWalletDTO(wallet) {
  return {
    balance: wallet.balance,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeSpent: wallet.lifetimeSpent,
  };
}

export function toGroupedReportDTO(g, postMap) {
  const counts = {};
  g.reasonCodes.forEach((code) => {
    counts[code] = (counts[code] || 0) + 1;
  });
  const topReason = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    postId: g._id,
    post: postMap.get(String(g._id)) || null,
    reportCount: g.reportCount,
    pendingCount: g.pendingCount,
    topReason,
    latestReportAt: g.latestReportAt,
  };
}

export function toVerificationCountsDTO({ pendingCount, verifiedCount, rejectedCount }) {
  return {
    pending: pendingCount,
    verified: verifiedCount,
    rejected: rejectedCount,
    all: pendingCount + verifiedCount + rejectedCount,
  };
}
