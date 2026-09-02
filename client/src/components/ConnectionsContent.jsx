import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Ellipsis,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  UserPlus,
  UsersRound,
  X,
  Building2,
  IndianRupee,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router";
import UserAvatar from "./UserAvatar";
import axiosInstance from "../lib/axios";

const EMPTY_LIST = [];
const TABS = ["All", "Requests", "My Network", "Discover"];
const DISCOVERY_FILTERS = ["All", "Nearby", "Verified", "Buyers", "Sellers", "Brokers", "Builders", "Recently Active"];
const MORE_DISCOVERY_FILTERS = ["Investors", "Architects", "Interior Designers", "Loan Advisors", "Property Consultants"];

function entityId(entity) {
  return String(typeof entity === "object" ? entity?._id || entity?.id || "" : entity || "");
}

function userRole(user) {
  return user?.primaryRole || user?.activeRole || user?.travelStyle || "Marketplace member";
}

function userLocation(user) {
  return user?.city || user?.homeBase || user?.location || "Location not set";
}

function ConnectionsTabs({ activeTab, onChange, requestCount, messageRequestCount }) {
  return (
    <nav className="grid grid-cols-4 items-center" aria-label="Connection sections">
      {TABS.map((tab) => {
        const active = activeTab === tab;
        const totalRequests = tab === "Requests" ? requestCount + messageRequestCount : 0;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`relative px-1 py-3 text-center text-xs transition sm:text-sm ${active ? "font-bold text-primary" : "font-medium text-base-content/60 hover:text-base-content"}`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              {tab}
              {tab === "Requests" && totalRequests > 0 ? <span className="rounded-full bg-base-200 px-1.5 py-0.5 text-[10px] font-bold text-base-content/70">{totalRequests}</span> : null}
            </span>
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
          </button>
        );
      })}
    </nav>
  );
}

function EmptyRequestBanner({ onDiscover }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5" aria-label="Connection request status">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-base-content">You're all caught up!</p>
        <p className="mt-0.5 text-sm text-base-content/60">No pending connection requests.</p>
      </div>
      <button type="button" onClick={onDiscover} className="btn btn-sm h-10 rounded-xl border border-primary/30 bg-base-100 px-4 text-primary shadow-none hover:border-primary/30 hover:bg-primary/10">
        <UserPlus className="size-4" />Discover People
      </button>
    </section>
  );
}

function RequestRow({ request, onAccept, onReject, busy, isMessageRequest }) {
  const sender = request?.sender || request?.actor;
  
  const handleAccept = () => {
    onAccept(request._id);
  };
  
  const handleReject = () => {
    onReject(request._id);
  };
  
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
      <UserAvatar src={sender?.profilePic} name={sender?.fullName || "User"} sizeClass="size-10" userId={sender?._id} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-base-content">{sender?.fullName || "Unknown user"}</p>
        <p className="mt-0.5 truncate text-xs text-base-content/60">{userRole(sender)} <span className="mx-1 text-base-content/40">·</span>{userLocation(sender)}</p>
        {isMessageRequest && request?.actualMessage && (
          <p className="mt-1 truncate text-xs text-base-content/70 italic">"{request.actualMessage}"</p>
        )}
        {isMessageRequest && request?.propertyPost && (
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-base-200 p-2">
            <Building2 className="size-3 text-base-content/60" />
            <span className="text-xs text-base-content">{request.propertyPost.title || "Property"}</span>
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm h-9 rounded-lg text-base-content/60 hover:bg-base-200" onClick={handleReject} disabled={busy}><X className="size-4" />Ignore</button>
        <button type="button" className="btn btn-sm h-9 rounded-lg border-none bg-primary px-3 text-white hover:bg-primary" onClick={handleAccept} disabled={busy}><Check className="size-4" />Accept</button>
      </div>
    </div>
  );
}

function ConnectionRow({ user, onOpenMessages }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:px-5">
      <UserAvatar src={user?.profilePic} name={user?.fullName || "User"} sizeClass="size-11" userId={user?._id} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link to={`/users/${user?._id}`} className="truncate text-sm font-bold text-base-content hover:text-primary">{user?.fullName || "Unknown user"}</Link>
          <ShieldCheck className="size-4 shrink-0 text-success" aria-label="Verified connection" />
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-primary">{userRole(user)}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-base-content/60"><MapPin className="size-3" />{userLocation(user)}</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={onOpenMessages} className="btn btn-sm h-9 rounded-lg border border-primary/30 bg-base-100 px-3 text-primary shadow-none hover:border-primary/30 hover:bg-primary/10"><MessageCircle className="size-4" />Message</button>
        <button type="button" className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:bg-base-200" onClick={() => setMenuOpen((open) => !open)} aria-label={`More actions for ${user?.fullName || "user"}`}><Ellipsis className="size-5" /></button>
      </div>
      {menuOpen ? (
        <div className="absolute right-4 top-[3.7rem] z-10 w-40 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg">
          <Link to={`/users/${user?._id}`} className="block rounded-lg px-3 py-2 text-sm text-base-content hover:bg-base-200">View profile</Link>
          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200">Remove connection</button>
          <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-error/10">Report user</button>
        </div>
      ) : null}
    </div>
  );
}

function NetworkCard({ friends, showAll, onViewAll, onOpenMessages }) {
  const visibleFriends = showAll ? friends : friends.slice(0, 6);
  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-base-content">My Network <span className="text-base-content/50">({friends.length})</span></h2>
          <p className="mt-0.5 text-xs text-base-content/60">People you’re connected with</p>
        </div>
        {friends.length > 6 ? <button type="button" onClick={onViewAll} className="text-sm font-semibold text-primary hover:text-primary">{showAll ? "Show less" : "View all"}</button> : null}
      </div>
      <div className="border-t border-base-200">
        {visibleFriends.length ? visibleFriends.map((user, index) => (
          <div key={user?._id || index} className={index ? "border-t border-base-200" : ""}><ConnectionRow user={user} onOpenMessages={onOpenMessages} /></div>
        )) : <div className="px-5 py-9 text-center"><UsersRound className="mx-auto size-7 text-base-content/40" /><p className="mt-2 text-sm font-semibold text-base-content">Your network starts here</p><p className="mt-1 text-sm text-base-content/60">Connect with people from the Discover list.</p></div>}
      </div>
    </section>
  );
}

function OutgoingRequestsCard({ requests, showAll, onViewAll }) {
  const visibleRequests = showAll ? requests : requests.slice(0, 6);
  if (!requests.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between px-4 py-4 sm:px-5"><div><h2 className="text-base font-bold text-base-content">Sent Requests</h2><p className="mt-0.5 text-xs text-base-content/60">Waiting for a response</p></div>{requests.length > 6 ? <button type="button" onClick={onViewAll} className="text-sm font-semibold text-primary">{showAll ? "Show less" : "View all"}</button> : null}</div>
      <div className="divide-y divide-base-300 border-t border-base-200">{visibleRequests.map((request) => <div key={request._id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><UserAvatar src={request.receiver?.profilePic} name={request.receiver?.fullName || "User"} sizeClass="size-10" userId={request.receiver?._id} /><div className="min-w-0 flex-1"><Link to={`/users/${request.receiver?._id}`} className="truncate text-sm font-bold text-base-content hover:text-primary">{request.receiver?.fullName || "Unknown user"}</Link><p className="mt-0.5 truncate text-xs text-base-content/60">{userRole(request.receiver)}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning"><Clock3 className="size-3" />Pending</span></div>)}</div>
    </section>
  );
}

function discoveryReason(user, authUser, type) {
  if (type === "Featured Professionals") return user?.isVerified || user?.verified ? `Verified ${userRole(user)}` : "Top rated on NearMySpace";
  if (type === "Nearby Professionals") return `Based in ${userLocation(user)}`;
  if (type === "Trending Sellers") return "Trending listing activity this week";
  if (type === "Recently Joined Members") return "New member on NearMySpace";
  if (type === "Top Rated Professionals") return "Highly rated professional";
  if (type === "Active This Week") return "Recently active on NearMySpace";
  if (user?.city && user.city === authUser?.city) return `You both live in ${user.city}`;
  return user?.isVerified || user?.verified ? `Verified ${userRole(user)}` : "Shared property interests";
}

function ProfessionalCard({ user, authUser, section, onConnect, busy, pendingUserId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const verified = user?.isVerified || user?.verified;
  return <article className="relative rounded-xl border border-base-300 bg-base-100 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex items-start gap-3"><UserAvatar src={user.profilePic} name={user.fullName || "User"} sizeClass="size-11" userId={user._id} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><Link to={`/users/${user._id}`} className="truncate text-sm font-bold text-base-content hover:text-primary">{user.fullName || "Unknown user"}</Link>{verified ? <ShieldCheck className="size-4 shrink-0 text-success" /> : null}</div><p className="mt-0.5 truncate text-xs font-medium text-primary">{userRole(user)}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-base-content/60"><MapPin className="size-3" />{userLocation(user)}</p></div><button type="button" onClick={() => setMenuOpen((open) => !open)} className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:bg-base-200"><Ellipsis className="size-4" /></button></div>{section === "Featured Professionals" ? <span className="mt-3 inline-flex rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">Featured</span> : null}{section === "Trending Sellers" ? <span className="mt-3 inline-flex rounded-full bg-warning/10 px-2 py-1 text-[11px] font-bold text-warning">Trending</span> : null}{section === "Recently Joined Members" ? <span className="mt-3 inline-flex rounded-full bg-success/10 px-2 py-1 text-[11px] font-bold text-success">New Member</span> : null}<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60"><span className="inline-flex items-center gap-1"><Star className="size-3 fill-warning text-warning" />{user.rating || user.averageRating || "New"}</span><span>{user.listingsCount || user.propertiesCount || 0} listings</span><span>{user.responseRate || "Responsive"}</span></div><span className="mt-3 inline-flex max-w-full truncate rounded-lg bg-base-200 px-2.5 py-1.5 text-xs font-medium text-base-content/70">{discoveryReason(user, authUser, section)}</span><div className="mt-3 flex gap-2"><button type="button" onClick={() => onConnect(user._id)} disabled={busy && entityId(user) === entityId(pendingUserId)} className="btn btn-sm h-9 flex-1 rounded-lg border-none bg-primary text-white transition hover:bg-primary"><UserPlus className="size-3.5" />Connect</button><Link to={`/users/${user._id}`} className="btn btn-sm h-9 rounded-lg border border-base-300 bg-base-100 px-3 text-base-content shadow-none hover:bg-base-200">Profile</Link></div>{menuOpen ? <div className="absolute right-3 top-12 z-10 w-36 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg"><button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200">Follow</button><button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200">Share profile</button><button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-error/10">Report user</button><button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-error/10">Block user</button></div> : null}</article>;
}

function DiscoverySection({ title, subtitle, users, authUser, onConnect, busy, pendingUserId, onViewAll }) {
  if (!users.length) return null;
  return <section><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-base font-bold text-base-content">{title}</h3><p className="mt-0.5 text-xs text-base-content/60">{subtitle}</p></div>{users.length > 3 ? <button type="button" onClick={onViewAll} className="shrink-0 text-sm font-semibold text-primary">View all</button> : null}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{users.slice(0, 3).map((user) => <ProfessionalCard key={`${title}-${user._id}`} user={user} authUser={authUser} section={title} onConnect={onConnect} busy={busy} pendingUserId={pendingUserId} />)}</div></section>;
}

function DiscoveryExperience({ users, authUser, searchQuery, onSearchChange, filter, onFilterChange, onConnect, busy, pendingUserId, onRadiusChange, currentRadius }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const RADIUS_OPTIONS = ["Entire city", "5 km", "10 km", "25 km"];
  const matchesFilter = (user) => { const role = userRole(user).toLowerCase(); if (filter === "All" || filter === "Recently Active") return true; if (filter === "Verified") return Boolean(user?.isVerified || user?.verified); if (filter === "Nearby") return Boolean(authUser?.city && userLocation(user) === authUser.city); return role.includes(filter.toLowerCase().replace(/s$/, "")); };
  const matches = users.filter(matchesFilter);
  
  // Track used user IDs to prevent duplicates across sections
  const usedIds = new Set();
  const getUniqueUsers = (userList, count) => {
    const unique = [];
    for (const user of userList) {
      if (!usedIds.has(user._id) && unique.length < count) {
        usedIds.add(user._id);
        unique.push(user);
      }
    }
    return unique;
  };
  
  const featuredUsers = getUniqueUsers(matches.filter((user) => user.isVerified || user.verified), 3);
  const peopleYouMayKnow = getUniqueUsers(matches.filter((user) => !featuredUsers.includes(user)), 3);
  const nearbyUsers = getUniqueUsers(matches.filter((user) => userLocation(user) === authUser?.city && !featuredUsers.includes(user) && !peopleYouMayKnow.includes(user)), 3);
  const trendingUsers = getUniqueUsers(matches.filter((user) => !featuredUsers.includes(user) && !peopleYouMayKnow.includes(user) && !nearbyUsers.includes(user)), 3);
  const recentlyJoined = getUniqueUsers(matches.filter((user) => !featuredUsers.includes(user) && !peopleYouMayKnow.includes(user) && !nearbyUsers.includes(user) && !trendingUsers.includes(user)), 3);
  const topRated = getUniqueUsers([...matches].sort((a, b) => Number(b.rating || b.averageRating || 0) - Number(a.rating || a.averageRating || 0)).filter((user) => !featuredUsers.includes(user) && !peopleYouMayKnow.includes(user) && !nearbyUsers.includes(user) && !trendingUsers.includes(user) && !recentlyJoined.includes(user)), 3);
  const activeUsers = getUniqueUsers(matches.filter((user) => !featuredUsers.includes(user) && !peopleYouMayKnow.includes(user) && !nearbyUsers.includes(user) && !trendingUsers.includes(user) && !recentlyJoined.includes(user) && !topRated.includes(user)), 3);
  
  const sections = [
    ["Featured Professionals", "Trusted, verified experts who are active on NearMySpace.", featuredUsers],
    ["People You May Know", "Relevant matches based on your location and property interests.", peopleYouMayKnow],
    ["Nearby Professionals", `Professionals within your ${currentRadius.toLowerCase()}.`, nearbyUsers],
    ["Trending Sellers", "Popular sellers receiving attention this week.", trendingUsers],
    ["Recently Joined Members", "Welcome new people to the NearMySpace community.", recentlyJoined],
    ["Top Rated Professionals", "Professionals recognised for consistently great service.", topRated],
    ["Active This Week", "People who are posting and engaging right now.", activeUsers],
  ];
  return <div className="space-y-7 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div><h2 className="text-xl font-bold tracking-tight text-base-content">Discover Professionals</h2><p className="mt-1 text-sm text-base-content/60">Find trusted buyers, sellers, brokers, builders, consultants and investors based on what matters to you.</p></div><label className="flex h-11 items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3"><Search className="size-4 text-base-content/50" /><input value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/50" placeholder="Search name, profession, company, city or property interest" /></label><div className="flex flex-wrap items-center gap-2">{DISCOVERY_FILTERS.map((item) => <button key={item} type="button" onClick={() => onFilterChange(item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === item ? "border-primary bg-primary text-white" : "border-base-300 bg-base-100 text-base-content/70 hover:border-primary/30 hover:text-primary"}`}>{item}</button>)}<div className="relative"><button type="button" onClick={() => setMoreOpen((open) => !open)} className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/70 hover:border-primary/30">More filters <ChevronDown className="size-3.5" /></button>{moreOpen ? <div className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg">{MORE_DISCOVERY_FILTERS.map((item) => <button key={item} type="button" onClick={() => { onFilterChange(item); setMoreOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200">{item}</button>)}</div> : null}</div></div><div className="flex flex-wrap items-center gap-2 border-y border-base-200 py-3"><span className="text-xs font-semibold text-base-content/60">Nearby radius</span>{RADIUS_OPTIONS.map((item) => <button key={item} type="button" onClick={() => onRadiusChange(item)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${currentRadius === item ? "bg-neutral text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"}`}>{item}</button>)}</div>{matches.length ? sections.map(([title, subtitle, sectionUsers]) => <DiscoverySection key={title} title={title} subtitle={subtitle} users={sectionUsers} authUser={authUser} onConnect={onConnect} busy={busy} pendingUserId={pendingUserId} onViewAll={() => toast.success(`Showing all ${title.toLowerCase()} soon`)} />) : <div className="rounded-xl border border-dashed border-base-300 px-5 py-12 text-center"><UsersRound className="mx-auto size-8 text-base-content/40" /><p className="mt-3 text-sm font-bold text-base-content">Better recommendations start with your profile</p><p className="mx-auto mt-1 max-w-md text-sm text-base-content/60">Choose your city, add property interests, upload a listing or connect with people to receive tailored professional suggestions.</p></div>}</div>;
}

function DiscoverPeopleCard({ users, searchQuery, onSearchChange, onConnect, busy, pendingUserId, onShuffle, fetching }) {
  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-bold text-base-content">People You May Know</h2><p className="mt-1 text-xs text-base-content/60">Find buyers, sellers and property experts</p></div>
        <button type="button" className="shrink-0 text-sm font-semibold text-primary hover:text-primary">View All</button>
      </div>
      <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3">
        <Search className="size-4 text-base-content/50" /><input type="text" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/50" />
      </label>
      <div className="mt-3 flex items-center justify-between text-xs text-base-content/60"><span>{searchQuery ? "Search results" : "Suggested for you"}</span><button type="button" onClick={onShuffle} disabled={Boolean(searchQuery) || fetching} className="inline-flex items-center gap-1 font-semibold text-base-content/60 hover:text-base-content disabled:opacity-45"><RefreshCw className={`size-3.5 ${fetching ? "animate-spin" : ""}`} />Refresh</button></div>
      <div className="mt-3 divide-y divide-base-300">
        {users.length ? users.slice(0, 4).map((user) => <div key={user._id} className="flex items-center gap-3 py-3"><UserAvatar src={user.profilePic} name={user.fullName || "User"} sizeClass="size-10" userId={user._id} /><div className="min-w-0 flex-1"><Link to={`/users/${user._id}`} className="truncate text-sm font-bold text-base-content hover:text-primary">{user.fullName || "Unknown user"}</Link><p className="mt-0.5 truncate text-xs text-base-content/60">{userRole(user)}</p><p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-base-content/50"><MapPin className="size-3" />{userLocation(user)}</p></div><button type="button" onClick={() => onConnect(user._id)} disabled={busy && entityId(user) === entityId(pendingUserId)} className="btn btn-sm h-8 rounded-lg border border-primary/30 bg-base-100 px-2.5 text-xs text-primary shadow-none hover:border-primary/30 hover:bg-primary/10"><UserPlus className="size-3.5" />Connect</button></div>) : <p className="py-6 text-center text-sm text-base-content/60">No matching people found.</p>}
      </div>
    </section>
  );
}

function InviteCard() {
  return <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UsersRound className="size-5" /></div><div><h2 className="text-base font-bold text-base-content">Grow Your Network</h2><p className="mt-1 text-sm leading-5 text-base-content/60">Invite contacts and build your local real estate circle.</p></div></div><button type="button" onClick={() => toast.success("Invite contacts is ready to share") } className="btn btn-sm mt-4 h-10 w-full rounded-xl border-none bg-primary text-white hover:bg-primary">Invite Contacts</button></section>;
}

export default function ConnectionsContent({ onOpenMessages }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState("All");
  const [radius, setRadius] = useState("Entire city");
  const [expandedLists, setExpandedLists] = useState({ requests: false, network: false, outgoing: false, discover: false });

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300); return () => clearTimeout(timer); }, [searchQuery]);
  const { data: friendsData, isLoading: friendsLoading } = useQuery({ queryKey: ["friends"], queryFn: async () => (await axiosInstance.get("/users/friends")).data?.data?.friends || [] });
  const { data: incomingData, isLoading: incomingLoading } = useQuery({ queryKey: ["incomingRequests"], queryFn: async () => (await axiosInstance.get("/users/friend-requests")).data?.data?.incomingRequests || [], refetchInterval: 15000 });
  const { data: outgoingData, isLoading: outgoingLoading } = useQuery({ queryKey: ["outgoingRequests"], queryFn: async () => (await axiosInstance.get("/users/outgoing-friend-requests")).data?.data?.outgoingRequests || [] });
  const { data: recommendedData, isLoading: recommendedLoading, isFetching: recommendedFetching } = useQuery({ queryKey: ["recommendedUsers", debouncedSearchQuery], queryFn: async () => { const params = new URLSearchParams(debouncedSearchQuery ? { q: debouncedSearchQuery, limit: "24" } : { random: "true", limit: "24" }); return (await axiosInstance.get(`/users?${params.toString()}`)).data?.data?.users || []; }, placeholderData: (previousData) => previousData });
  const { data: discoverData, isLoading: discoverLoading } = useQuery({ 
    queryKey: ["discoverUsers", debouncedSearchQuery, discoveryFilter, radius], 
    enabled: activeTab === "Discover", 
    queryFn: async () => { 
      const params = new URLSearchParams({ limit: "20" }); 
      if (debouncedSearchQuery) params.set("q", debouncedSearchQuery); 
      if (discoveryFilter !== "All") params.set("filter", discoveryFilter);
      if (radius !== "Entire city") {
        const radiusKm = parseInt(radius);
        params.set("nearby", "true");
        params.set("radius", radiusKm.toString());
      }
      return (await axiosInstance.get(`/users/discover?${params.toString()}`)).data?.data?.users || []; 
    }, 
    placeholderData: (previousData) => previousData 
  });
  const { data: authData } = useQuery({ queryKey: ["authUser"], queryFn: async () => (await axiosInstance.get("/auth/verify", { skipErrorToast: true })).data, retry: false, staleTime: 1000 * 60 * 5 });
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({ queryKey: ["notifications"], queryFn: async () => (await axiosInstance.get("/notifications?type=message_request")).data?.data?.notifications || [], refetchInterval: 30000, select: (notifications) => notifications.filter(n => n.requestStatus === "pending") });
  const friends = friendsData ?? EMPTY_LIST;
  const incomingRequests = incomingData ?? EMPTY_LIST;
  const outgoingRequests = outgoingData ?? EMPTY_LIST;
  const recommendedUsers = recommendedData ?? EMPTY_LIST;
  const discoverUsers = discoverData ?? EMPTY_LIST;
  const authUser = authData?.data?.user || authData?.data || null;
  const messageRequests = notificationsData ?? EMPTY_LIST;
  const isLoading = friendsLoading || incomingLoading || outgoingLoading || recommendedLoading || notificationsLoading || (activeTab === "Discover" && discoverLoading);
  const refreshLists = () => ["friends", "incomingRequests", "incomingRequestsCount", "outgoingRequests", "recommendedUsers", "notifications"].forEach((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] }));
  const { mutate: sendRequest, isPending: sending } = useMutation({ mutationFn: async (userId) => axiosInstance.post(`/users/friend-request/${userId}`), onMutate: async (userId) => { setPendingUserId(userId); await queryClient.cancelQueries({ queryKey: ["outgoingRequests"] }); const previousOutgoing = queryClient.getQueryData(["outgoingRequests"]); const selectedUser = [...recommendedUsers, ...discoverUsers].find((user) => entityId(user) === entityId(userId)); queryClient.setQueryData(["outgoingRequests"], (current = EMPTY_LIST) => current.some((request) => entityId(request?.receiver) === entityId(userId)) ? current : [...current, { _id: `pending-${userId}`, receiver: selectedUser || { _id: userId, fullName: "Pending connection" } }]); return { previousOutgoing }; }, onSuccess: () => toast.success("Connection request sent"), onError: (error, _userId, context) => { queryClient.setQueryData(["outgoingRequests"], context?.previousOutgoing); toast.error(error?.response?.data?.message || "Could not send request"); }, onSettled: () => { setPendingUserId(""); refreshLists(); } });
  const { mutate: acceptRequest, isPending: accepting } = useMutation({ mutationFn: async (requestId) => axiosInstance.put(`/users/friend-request/${requestId}/accept`), onMutate: async (requestId) => { await Promise.all([queryClient.cancelQueries({ queryKey: ["incomingRequests"] }), queryClient.cancelQueries({ queryKey: ["friends"] })]); const previousIncoming = queryClient.getQueryData(["incomingRequests"]); const previousFriends = queryClient.getQueryData(["friends"]); const request = (previousIncoming ?? EMPTY_LIST).find((item) => entityId(item) === entityId(requestId)); queryClient.setQueryData(["incomingRequests"], (current = EMPTY_LIST) => current.filter((item) => entityId(item) !== entityId(requestId))); if (request?.sender) queryClient.setQueryData(["friends"], (current = EMPTY_LIST) => current.some((friend) => entityId(friend) === entityId(request.sender)) ? current : [...current, request.sender]); return { previousIncoming, previousFriends }; }, onSuccess: () => toast.success("Connection accepted"), onError: (error, _requestId, context) => { queryClient.setQueryData(["incomingRequests"], context?.previousIncoming); queryClient.setQueryData(["friends"], context?.previousFriends); toast.error(error?.response?.data?.message || "Could not accept request"); }, onSettled: refreshLists });
  const { mutate: rejectRequest, isPending: rejecting } = useMutation({ mutationFn: async (requestId) => axiosInstance.put(`/users/friend-request/${requestId}/reject`), onMutate: async (requestId) => { await queryClient.cancelQueries({ queryKey: ["incomingRequests"] }); const previousIncoming = queryClient.getQueryData(["incomingRequests"]); queryClient.setQueryData(["incomingRequests"], (current = EMPTY_LIST) => current.filter((item) => entityId(item) !== entityId(requestId))); return { previousIncoming }; }, onSuccess: () => toast.success("Connection request declined"), onError: (error, _requestId, context) => { queryClient.setQueryData(["incomingRequests"], context?.previousIncoming); toast.error(error?.response?.data?.message || "Could not decline request"); }, onSettled: refreshLists });
  const { mutate: handleMessageRequest } = useMutation({
    mutationFn: async ({ notificationId, action, senderId }) => {
      const response = await axiosInstance.patch(`/notifications/${notificationId}/handle-request`, { action });
      
      // If accepting, also create a friendship connection
      if (action === "accept" && senderId) {
        try {
          await axiosInstance.post(`/users/friend-request/${senderId}`);
          // Auto-accept the friend request
          await axiosInstance.put(`/users/friend-request/${senderId}/accept`);
        } catch (error) {
          console.error("Failed to create friendship:", error);
        }
      }
      
      return response.data;
    },
    onMutate: async ({ notificationId, action, senderId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["notifications"] }),
        queryClient.cancelQueries({ queryKey: ["friends"] }),
        queryClient.cancelQueries({ queryKey: ["incomingRequests"] }),
      ]);
      const previousNotifications = queryClient.getQueryData(["notifications"]);
      const previousFriends = queryClient.getQueryData(["friends"]);
      const previousIncoming = queryClient.getQueryData(["incomingRequests"]);
      
      // Remove notification
      queryClient.setQueryData(["notifications"], (current = EMPTY_LIST) => current.filter((n) => n._id !== notificationId));
      
      // If accepting, optimistically add to friends
      if (action === "accept" && senderId) {
        const notification = previousNotifications?.find(n => n._id === notificationId);
        const sender = notification?.sender || notification?.actor;
        if (sender) {
          queryClient.setQueryData(["friends"], (current = EMPTY_LIST) => {
            if (current.some(f => entityId(f) === entityId(sender))) return current;
            return [...current, sender];
          });
        }
      }
      
      return { previousNotifications, previousFriends, previousIncoming };
    },
    onSuccess: () => {
      toast.success("Connection accepted successfully");
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(["notifications"], context?.previousNotifications);
      queryClient.setQueryData(["friends"], context?.previousFriends);
      queryClient.setQueryData(["incomingRequests"], context?.previousIncoming);
      console.error("Handle message request error:", error);
      toast.error(error?.response?.data?.message || "Failed to handle request");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["incomingRequests"] });
      refreshLists();
    }
  });
  const visibleRecommendedUsers = useMemo(() => { const excludedIds = new Set([entityId(authUser)]); friends.forEach((user) => excludedIds.add(entityId(user))); incomingRequests.forEach((request) => excludedIds.add(entityId(request?.sender))); outgoingRequests.forEach((request) => excludedIds.add(entityId(request?.receiver))); if (pendingUserId) excludedIds.add(entityId(pendingUserId)); return recommendedUsers.filter((user) => entityId(user) && !excludedIds.has(entityId(user))); }, [authUser, friends, incomingRequests, outgoingRequests, pendingUserId, recommendedUsers]);
  const requestConnection = (userId) => { if (userId && !sending && entityId(userId) !== entityId(authUser)) sendRequest(userId); };
  const showRequests = activeTab === "Requests";
  const showNetwork = activeTab === "All" || activeTab === "My Network";
  const showDiscover = activeTab === "Discover";

  const toggleList = (list) => setExpandedLists((current) => ({ ...current, [list]: !current[list] }));
  const visibleIncoming = expandedLists.requests ? incomingRequests : incomingRequests.slice(0, 6);
  const visibleMessageRequests = expandedLists.requests ? messageRequests : messageRequests.slice(0, 6);

  if (isLoading) return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="h-20 animate-pulse rounded-2xl bg-base-300/70" /><div className="h-64 animate-pulse rounded-2xl bg-base-300/70" /><div className="h-80 animate-pulse rounded-2xl bg-base-300/70" /></div>;
  return (
    <div className="xl:h-full xl:overflow-y-auto xl:pr-1 pb-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight text-base-content">My Network</h1><p className="mt-1 text-sm text-base-content/60">Manage your connections and grow your real estate network.</p></div><button type="button" onClick={refreshLists} className="btn btn-ghost btn-sm h-9 rounded-lg text-base-content/70 hover:bg-base-100"><RefreshCw className="size-4" />Refresh</button></div>
      <div className="rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.025)]"><ConnectionsTabs activeTab={activeTab} onChange={setActiveTab} requestCount={incomingRequests.length} messageRequestCount={messageRequests.length} /></div>
      <div className={`mt-5 grid gap-5 ${showDiscover ? "" : "xl:grid-cols-[minmax(0,1fr)_340px]"}`}>
        <main className="min-w-0 space-y-5">
          {(activeTab === "All" || showRequests) && (incomingRequests.length ? <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-center justify-between px-4 py-4 sm:px-5"><div><h2 className="text-base font-bold text-base-content">Connection Requests</h2><p className="mt-0.5 text-xs text-base-content/60">{incomingRequests.length} waiting for your response</p></div>{incomingRequests.length > 6 ? <button type="button" onClick={() => toggleList("requests")} className="text-sm font-semibold text-primary">{expandedLists.requests ? "Show less" : "View all"}</button> : null}</div><div className="divide-y divide-base-300 border-t border-base-200">{visibleIncoming.map((request) => <RequestRow key={request._id} request={request} onAccept={(id) => acceptRequest(id)} onReject={(id) => rejectRequest(id)} busy={accepting || rejecting} />)}</div></section> : <EmptyRequestBanner onDiscover={() => setActiveTab("Discover")} />)}
          {(activeTab === "All" || showRequests) && (messageRequests.length ? <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-center justify-between px-4 py-4 sm:px-5"><div><h2 className="text-base font-bold text-base-content">Message Requests</h2><p className="mt-0.5 text-xs text-base-content/60">{messageRequests.length} property enquiries</p></div>{messageRequests.length > 6 ? <button type="button" onClick={() => toggleList("requests")} className="text-sm font-semibold text-primary">{expandedLists.requests ? "Show less" : "View all"}</button> : null}</div><div className="divide-y divide-base-300 border-t border-base-200">{visibleMessageRequests.map((request) => <RequestRow key={request._id} request={request} onAccept={(id) => handleMessageRequest({ notificationId: id, action: "accept", senderId: request?.sender?._id || request?.actor?._id })} onReject={(id) => handleMessageRequest({ notificationId: id, action: "ignore" })} busy={false} isMessageRequest />)}</div></section> : null)}
          {activeTab === "All" ? <OutgoingRequestsCard requests={outgoingRequests} showAll={expandedLists.outgoing} onViewAll={() => toggleList("outgoing")} /> : null}
          {showNetwork ? <NetworkCard friends={friends} showAll={expandedLists.network} onViewAll={() => toggleList("network")} onOpenMessages={onOpenMessages} /> : null}
          {showDiscover ? <DiscoveryExperience users={discoverUsers} authUser={authUser} searchQuery={searchQuery} onSearchChange={setSearchQuery} filter={discoveryFilter} onFilterChange={setDiscoveryFilter} onConnect={requestConnection} busy={sending} pendingUserId={pendingUserId} onRadiusChange={setRadius} currentRadius={radius} /> : null}
        </main>
        {showDiscover ? <aside><InviteCard /></aside> : <aside className="space-y-5"><DiscoverPeopleCard users={visibleRecommendedUsers} searchQuery={searchQuery} onSearchChange={setSearchQuery} onConnect={requestConnection} busy={sending} pendingUserId={pendingUserId} onShuffle={() => !debouncedSearchQuery && queryClient.invalidateQueries({ queryKey: ["recommendedUsers", ""] })} fetching={recommendedFetching} /><InviteCard /></aside>}
      </div>
    </div>
  );
}
