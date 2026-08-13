# INSELL Social-First Marketplace System Redesign

## Product Direction
Insell should behave like a social network for real estate discovery and transactions.

- Discovery-first feed, not form-first listing flow
- Intent-based onboarding and role-aware dashboards
- Property post creation should feel like creating social content
- Conversations and visit scheduling should happen in-app

## Core Flow
1. User logs in with OTP.
2. User selects intent (Buy, Sell, Rent, List for Rent, Broker).
3. User completes dynamic role-based onboarding.
4. User lands on personalized dashboard and feed.
5. User discovers, likes, saves, comments, and chats.
6. User schedules visit and negotiates in-app.

## Experience Architecture

### Feed-First UI
- Stories and featured strips on top
- Search and quick filters
- Infinite property feed cards
- Floating create button
- Sticky bottom navigation

### Create Post Flow
1. Listing type
2. Property type
3. Media
4. Essential details
5. Preview
6. Publish success

### Property Card
- Seller identity and verification
- Large media carousel
- Social actions (like, save, share, chat)
- Price, location, specs, caption
- Visit scheduling CTA

## Backend Architecture
- Routes
- Controllers
- DTO/Validation
- Services
- Repositories
- MongoDB
- Redis cache
- Background jobs
- Notification providers (SMS, Email, WhatsApp)

## Data Domains
- Users with multi-role profiles and active role switch
- Property posts with social interactions
- Chats and thread metadata
- Notifications and activity events
- Saved listings and recommendation signals

## Phased Implementation

### Phase 1 (In progress)
- Intent-first onboarding
- Role profiles and active role switch
- Social-style property feed
- Create property modal with progressive steps
- Like and save actions

### Phase 2
- Comments, follow seller/locality, and discovery ranking
- Requirement posts and match engine
- Property detail immersive page
- Better media handling and upload pipeline

### Phase 3
- Reels/stories for properties
- Verified broker and builder ecosystem
- AI recommendations and lead quality scoring
- Monetization (promoted listings, subscriptions)
