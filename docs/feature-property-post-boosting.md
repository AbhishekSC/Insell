# Feature Documentation: Property Post Boosting with Referral Coins

**Document Version:** 1.0.0  
**Feature Name:** Property Post Boosting  
**Currency Mechanism:** Referral Coins (1 Coin = 1 Boost for 24 Hours)  
**Target Platforms:** Mobile App (React Native / Expo iOS & Android) & Web Client (React / Vite)  
**Backend Services:** Express.js, MongoDB (Mongoose), Redis, Stream Notifications  

---

## 1. Executive Summary

Property Post Boosting enables listing creators (owners, landlords, and brokers) to promote their listings to the top of discovery feeds for 24 hours using **Referral Coins**. 

Instead of requiring monetary payments upfront, this feature leverages sweat-equity virality: users earn 1 referral coin whenever a friend joins through their unique invite link and verifies their account. Users can then spend 1 coin to boost any of their property listings, unlocking priority algorithmic ranking and an Instagram-style `⚡ Boosted` visual badge.

This aligns incentives:
- **Users** gain powerful visibility and inquiries without friction.
- **The Platform** gains viral user acquisition, higher retention, and network effects.

---

## 2. End-to-End How It Works

### 2.1 Earning Referral Coins
1. Every authenticated user has a unique referral code and shareable link (e.g. `https://nearmyspace.app/signup?ref=ABC1234`).
2. When an invited user signs up and verifies their email or phone number, the referral engine triggers:
   - **Inviter** receives +1 `referralCredits` (Referral Coin).
   - **Invitee** receives +1 `referralCredits` as a welcome bonus.
   - Both receive push/in-app notifications.

### 2.2 Triggering a Boost
Listing owners can initiate a 24-hour boost from several touchpoints:
1. **Interactive Badge on Post Image**: On the owner's own property cards, a sleek pill badge appears on the bottom-left of the cover photo:
   - If not boosted: `⚡ Boost Listing (1 Coin)`
   - If already active: `⚡ Boost Active` (tappable to view remaining time or extend).
   - *Note:* If the post has been blocked by administrators, this badge is completely suppressed.
2. **3-Dots Kebab Menu**: Post options menu provides a `⚡ Boost Listing (1 Coin)` action for owned, unblocked posts.
3. **Profile Dashboard**: A dedicated **Referral Coins & Property Boost** widget displays current coin balance, program terms (`1 Coin = 1 Boost`), and an "Invite Friends" shortcut.
4. **Property Detail Page**: A "Boost Listing" banner is displayed directly in the owner's Listing Performance section.

### 2.3 Boost Property Modal
Tapping any boost trigger opens the `BoostPropertyModal`:
- **Property Snapshot**: Thumbnail, title, price, locality, and active boost timer (if applicable).
- **Referral Coins Balance**: Displays available coins from `GET /api/v1/referral/me`.
- **Value Breakdown**:
  - ⚡ **#1 Priority Feed Placement**: Surfaced at the top of buyer feeds and search results.
  - 🏷️ **Instagram-Style "Boosted" Badge**: Eye-catching gradient badge highlighting the post.
  - 📈 **3x Inquiries & Views**: High visibility to active buyers and tenants.
  - ⏱️ **24 Hours Duration**: Continuous priority placement with stacking support.
- **Dynamic Action**:
  - **Sufficient Balance (>= 1 Coin)**: One-tap `Boost Listing for 24h (1 Coin)` button.
  - **Zero Balance**: Educational callout with 1-click **Copy Link** and native **Share Invite Link** (`navigator.share` / mobile share sheet).

### 2.4 Server-Side Processing
When `POST /api/v1/posts/:id/boost` is called:
1. **Authorization & Validation**:
   - Verifies JWT identity and checks `requireVerified`.
   - Ensures post belongs to caller (`authorId === userId`).
   - Ensures post is not deleted.
   - **Blocked Post Enforcement**: If `post.isBlocked` is true, rejects with `400 Cannot boost a blocked property listing`.
2. **Coin Deduction**:
   - Confirms `user.referralCredits >= 1`.
   - Decrements 1 credit atomically (`user.referralCredits -= 1`).
3. **24-Hour Expiration Calculation**:
   - If post is not currently boosted: `boostExpiresAt = Date.now() + 24 * 60 * 60 * 1000`.
   - If already boosted: stacks 24 hours on top of the existing `boostExpiresAt`.
   - Sets `isBoosted = true`, updates `boostedAt`, and increments `boostCount`.
4. **Cache Invalidation & Realtime Event**:
   - Purges Redis feed caches (`property:feed:*`), discover caches, and personalization caches.
   - Dispatches an in-app `post_boosted` notification.

### 2.5 Algorithmic Ranking & Feed Display
- In `getPropertyFeed`, posts are sorted primarily by `{ isBoosted: -1, createdAt: -1 }`.
- When serializing posts for the feed, `isBoosted` is dynamically computed:
  ```js
  isBoosted: Boolean(post.isBoosted && post.boostExpiresAt && post.boostExpiresAt > now)
  ```
- Expired boosts naturally drop back to normal chronological ranking without requiring manual database cleanup cron jobs.

---

## 3. How It Helps Users

### 3.1 For Sellers, Landlords & Brokers
- **Zero Cash Outlay**: Emerging brokers and individual owners can achieve top-tier promotion without spending money on expensive ad tiers.
- **Accelerated Liquidity**: Boosted listings receive up to 3x more impressions, direct calls, and visit requests.
- **Strategic Timing**: Users can boost right before weekend peak searching periods (Friday evening / Saturday morning) to maximize view-to-lead conversion.
- **Clarity & Control**: The active countdown informs sellers exactly when their boost expires, giving them full transparency.

### 3.2 For Buyers & Tenants
- **Active & Motivated Sellers**: A seller who spends their referral coins is engaged and highly responsive, resulting in faster replies to inquiries and fewer ghost listings.
- **Fresh Opportunities**: Puts fresh inventory in front of buyers without cluttering feeds with spammy multi-week ads.

### 3.3 For Newly Referred Users
- **Instant Welcome Gift**: An invited user gets 1 free coin upon registration, allowing them to test boosting immediately upon creating their first property listing.

---

## 4. How It Helps Our Business

| Strategic Objective | Business Impact |
| :--- | :--- |
| **Organic Viral Coefficient ($K$-Factor)** | Users are directly incentivized to invite other property owners, agents, and friends to earn boost coins, transforming users into organic platform promoters. |
| **Lower Customer Acquisition Cost (CAC)** | Reduces dependence on paid Meta/Google ads. Each user acquired via referral costs $0 in ad spend. |
| **Retention & Daily Active Users (DAU)** | The 24-hour boost window creates a strong re-engagement hook. Users log in daily to inspect views, check boost status, and share their link to earn more coins. |
| **Supply-Side Activation** | Encourages dormant users with unlisted or underperforming properties to polish and boost their listings. |
| **Future Monetization Pipeline** | Introduces coins as the platform's native micro-currency. In future phases, NearMySpace can offer coin bundles (e.g., 5 coins for ₹499) for high-volume brokers who want more boosts than referrals alone provide. |

---

## 5. Infrastructure Cost & Operational Analysis

### 5.1 Database (MongoDB)
- **Schema Overhead**: Four lightweight fields added to `PropertyPost` (`isBoosted`, `boostedAt`, `boostExpiresAt`, `boostCount`).
- **Indexing**: 
  - Compound index `{ isBoosted: -1, createdAt: -1 }` guarantees index-covered scans for feed queries.
  - Single index on `boostExpiresAt` ensures fast range filters.
- **Query Performance**: Negligible latency overhead (< 2ms for indexed compound queries).

### 5.2 Redis Caching
- Key namespace: `property:feed:*`.
- Cache invalidation occurs only when a boost is successfully purchased (`POST /posts/:id/boost`), keeping cache churn low while guaranteeing near-instant visibility updates for active users.

### 5.3 CDN & Media Processing (Cloudinary)
- Boosting reuses existing Cloudinary media URLs, LQIP previews, and responsive srcset configurations.
- No additional image upload, transformation, or video encoding costs are triggered by boosting.

### 5.4 Net Infrastructure Cost
- **Incremental Cost per Active User:** **$0.00 / month**.
- Existing database clusters, Redis instances, and API nodes handle the lightweight JSON requests within regular capacity margins.

---

## 6. Security, Anti-Fraud & Edge Case Handling

1. **Self-Referral Prevention**:
   - Device and IP fingerprints, along with phone/email verification checkpoints, prevent users from creating phantom accounts to farm referral coins.
2. **Blocked Post Safeguard**:
   - If an admin blocks a post due to policy violations, all boost badges are hidden immediately on both web and mobile.
   - The backend explicitly returns `400 Cannot boost a blocked property listing`, preventing any coin deduction on invalid posts.
3. **Ownership Enclosure**:
   - Attempts to boost a post owned by another user fail with `403 You can only boost your own property listings`.
4. **Self-Healing Expiration**:
   - Feed logic checks `boostExpiresAt > now` at read time. Even if server processes are restarted or worker queues are delayed, expired listings cannot display as boosted.

---

## 7. Key Performance Indicators (KPIs) to Track

- **Viral Factor ($K$)**: Number of successful referrals generated per active user.
- **Boost Adoption Rate**: Percentage of published listings that get boosted at least once.
- **Inquiry Multiplier**: View-to-contact conversion rate comparison between boosted listings and standard listings.
- **Coin Velocity**: Average time between earning a referral coin and spending it on a property boost.
- **Repeat Boost Frequency**: Number of times an owner re-boosts their property listing until under-offer or sold.
