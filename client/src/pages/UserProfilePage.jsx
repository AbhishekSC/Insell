import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Building2,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Grid3x3,
  Heart,
  IndianRupee,
  Loader2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  Save,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  User,
  UserRoundPlus,
  X,
} from "lucide-react";
import ShareModal from "../components/ShareModal";
import { getCustomBadgeClasses } from "../lib/badgeColors";
import UserListModal from "../components/UserListModal";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import CommentSection from "../components/CommentSection";
import PostAuthorLink from "../components/PostAuthorLink";
import EmailVerification from "../components/EmailVerification";
import axiosInstance from "../lib/axios";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function normalizeMedia(post) {
  return Array.isArray(post.mediaUrls) && post.mediaUrls.length
    ? post.mediaUrls
    : Array.isArray(post.media) && post.media.length
    ? post.media
    : ["https://placehold.co/1400x900?text=INSELL+Listing"];
}

function getListingBadge(post) {
  if (post.customBadge) return post.customBadge;
  const postType = String(post.postType || "").toUpperCase();
  if (postType === "PROPERTY_SALE") return "For Sale";
  if (postType === "PROPERTY_RENT") return "For Rent";
  if (postType === "REQUIREMENT_BUY") return "Looking to Buy";
  if (postType === "REQUIREMENT_RENT") return "Looking for Rent";
  return post.listingType || "Listing";
}

const BLOCK_REASON_LABELS = {
  SPAM: "Spam / misleading content",
  FRAUD: "Fraud / scam",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  DUPLICATE: "Duplicate listing",
  INCORRECT_INFORMATION: "Incorrect property information",
  POLICY_VIOLATION: "Policy violation",
  OTHER: "Other",
};

function getBlockReasonLabel(reasonCode) {
  return BLOCK_REASON_LABELS[reasonCode] || "Policy violation";
}

function relativeDate(dateString) {
  if (!dateString) return "Just now";
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return "Just now";
  const delta = Date.now() - time;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isVideoUrl(url) {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  return videoExtensions.some((ext) => String(url).toLowerCase().endsWith(ext));
}

function ProfileStat({ label, value }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-lg font-black text-slate-900">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [detailCarouselIndex, setDetailCarouselIndex] = useState(0);
  const [showVerification, setShowVerification] = useState(false);
  const [menuOpenPostId, setMenuOpenPostId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [removedImageUrls, setRemovedImageUrls] = useState([]);
  const [postCarouselIndex, setPostCarouselIndex] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [connectionsModalTitle, setConnectionsModalTitle] = useState(null);

  // Reset tab to posts when userId changes (viewing different user)
  useEffect(() => {
    setActiveTab("posts");
  }, [userId]);

  // Reset carousel index when post changes
  useEffect(() => {
    setDetailCarouselIndex(0);
  }, [selectedPost]);

  // Populates the shared ["authUser"] cache entry that other components read
  // via queryClient.getQueryData — the return value itself isn't needed here.
  useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const res = await axiosInstance.get("/auth/verify");
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: profileData, isLoading: isProfileLoading, isError } = useQuery({
    queryKey: ["userProfile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await axiosInstance.get(`/users/${userId}/profile`);
      return response.data?.data || null;
    },
  });

  const { data: connectionsData, isLoading: isConnectionsLoading, isError: isConnectionsError, error: connectionsError } = useQuery({
    queryKey: ["userFriends", userId],
    enabled: Boolean(userId) && Boolean(connectionsModalTitle),
    retry: false,
    queryFn: async () => {
      const response = await axiosInstance.get(`/users/${userId}/friends`);
      return response.data?.data?.friends || [];
    },
  });

  const connectionsForbidden = isConnectionsError && connectionsError?.response?.status === 403;

  const profileUser = profileData?.user || null;
  const stats = profileData?.stats || { postsCount: 0 };
  const relationship = profileData?.relationship || { isSelf: false, connectionStatus: "none" };
  const isOwnProfile = relationship.isSelf;

  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  // Full-size preview is limited to your own profile and confirmed friends —
  // not something a stranger/pending connection can zoom into.
  const canPreviewAvatar = isOwnProfile || relationship.connectionStatus === "friends";

  const { data: postsData, isLoading: isPostsLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["userPosts", userId],
    enabled: Boolean(userId),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "12");
      params.set("authorId", userId);
      // Explicit, so this tab keeps showing only published posts even on
      // your own profile — drafts live in their own tab (see draftsData).
      params.set("status", "PUBLISHED");

      const response = await axiosInstance.get(`/posts?${params.toString()}`);
      return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
    },
    getNextPageParam: (lastPage) => {
      const current = Number(lastPage?.pagination?.page || 1);
      const total = Number(lastPage?.pagination?.totalPages || 1);
      return current < total ? current + 1 : undefined;
    },
  });

  const posts = useMemo(
    () => (postsData?.pages || []).flatMap((page) => page.posts || []),
    [postsData]
  );

  const { data: draftsData, isLoading: isDraftsLoading, hasNextPage: hasNextDraftPage, fetchNextPage: fetchNextDraftPage, isFetchingNextPage: isFetchingNextDraftPage } = useInfiniteQuery({
    queryKey: ["myDrafts", userId],
    enabled: Boolean(userId) && isOwnProfile,
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "12");
      params.set("authorId", userId);
      params.set("status", "DRAFT");

      const response = await axiosInstance.get(`/posts?${params.toString()}`);
      return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
    },
    getNextPageParam: (lastPage) => {
      const current = Number(lastPage?.pagination?.page || 1);
      const total = Number(lastPage?.pagination?.totalPages || 1);
      return current < total ? current + 1 : undefined;
    },
  });

  const drafts = useMemo(
    () => (draftsData?.pages || []).flatMap((page) => page.posts || []),
    [draftsData]
  );

  const { data: bookmarksData, isLoading: isBookmarksLoading, hasNextPage: hasNextBookmarkPage, fetchNextPage: fetchNextBookmarkPage, isFetchingNextPage: isFetchingNextBookmarkPage } = useInfiniteQuery({
    queryKey: ["userBookmarks", userId],
    enabled: Boolean(userId),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "12");
      params.set("savedBy", userId);

      const response = await axiosInstance.get(`/posts?${params.toString()}`);
      return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
    },
    getNextPageParam: (lastPage) => {
      const current = Number(lastPage?.pagination?.page || 1);
      const total = Number(lastPage?.pagination?.totalPages || 1);
      return current < total ? current + 1 : undefined;
    },
  });

  // Fetch user activity for Activity tab
  const { data: userActivityData, isLoading: isActivityLoading } = useQuery({
    queryKey: ["userProfileActivity", userId],
    enabled: Boolean(userId) && activeTab === "activity",
    queryFn: async () => {
      const response = await axiosInstance.get(`/users/${userId}/activity`);
      return response.data?.data || { likes: [], comments: [], saved: [], connections: [] };
    },
  });

  const bookmarks = useMemo(
    () => (bookmarksData?.pages || []).flatMap((page) => page.posts || []),
    [bookmarksData]
  );

  const verified = useMemo(
    () => profileUser?.isVerified || false,
    [profileUser]
  );

  const { mutate: sendConnectionRequest, isPending: isConnecting } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(`/users/connection-request/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Connection request sent");
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not send connection request");
    },
  });

  const { mutate: toggleSave } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/save`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userBookmarks", userId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
      queryClient.invalidateQueries({ queryKey: ["userPosts", userId] });
    },
  });

  const { mutate: toggleLike } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPosts", userId] });
      queryClient.invalidateQueries({ queryKey: ["userBookmarks", userId] });
    },
  });

  const { mutate: deletePost } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.delete(`/posts/${postId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Post deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["userPosts", userId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
      setMenuOpenPostId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to delete post");
    },
  });

  const { mutate: updatePost, isPending: updatingPost } = useMutation({
    mutationFn: async ({ postId, postData, files, removedUrls }) => {
      // Filter out removed URLs from existing media
      let mediaUrls = (postData.mediaUrls || []).filter(url => !removedUrls.includes(url));
      
      // If there are new files to upload, upload them first
      if (files && files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('media', file);
        });
        
        const uploadResponse = await axiosInstance.post('/posts/upload-media', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        const uploadedUrls = uploadResponse.data?.data?.mediaUrls || [];
        mediaUrls = [...mediaUrls, ...uploadedUrls];
      }
      
      const response = await axiosInstance.put(`/posts/${postId}`, {
        ...postData,
        mediaUrls,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Post updated successfully");
      queryClient.invalidateQueries({ queryKey: ["userPosts", userId] });
      queryClient.invalidateQueries({ queryKey: ["myDrafts", userId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
      setShowEditModal(false);
      setPostToEdit(null);
      setNewImageFiles([]);
      setNewImagePreviews([]);
      setRemovedImageUrls([]);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update post");
    },
  });

  if (isProfileLoading) {
    return (
      <AppShell hideHero lockPageScroll title="Profile" subtitle="Loading profile...">
        <div className="grid min-h-[420px] place-items-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
            <Loader2 className="mx-auto size-5 animate-spin text-indigo-600" />
            <p className="mt-2 text-sm text-slate-500">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isError || !profileUser) {
    return (
      <AppShell hideHero lockPageScroll title="Profile" subtitle="User not found">
        <div className="grid min-h-[420px] place-items-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-800">Profile not found</p>
            <p className="mt-1 text-sm text-slate-500">This user may have been removed or is unavailable.</p>
            <button type="button" className="btn btn-sm mt-4 border-none bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" />
              Go back
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const cityLabel = profileUser.city || profileUser.homeBase || profileUser.location || "City not set";

  return (
    <AppShell hideHero title="Profile" subtitle={profileUser.fullName || "User profile"}>
      <div className="mx-auto max-w-[1440px] px-4 py-0 sm:px-8">
        <div className="flex flex-col gap-6">
          {/* Verification Banner - only show for own profile if not verified */}
          {isOwnProfile && !profileUser?.isVerified && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 rounded-full bg-amber-100 p-1.5">
                  <Sparkles className="size-4 text-amber-600" />
                </div>
                <p className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-amber-800">Get verified</p>
                <button
                  type="button"
                  onClick={() => setShowVerification(!showVerification)}
                  className="btn btn-xs sm:btn-sm bg-amber-600 text-white hover:bg-amber-700 shrink-0"
                >
                  {showVerification ? "Hide" : "Verify Now"}
                </button>
              </div>
              {showVerification && (
                <div className="mt-4">
                  <EmailVerification onClose={() => setShowVerification(false)} />
                </div>
              )}
            </div>
          )}

          {/* Profile Header */}
          <section className="flex flex-col items-center gap-6 rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:text-left">
            {/* Left: Avatar and Info */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:items-center">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (canPreviewAvatar && profileUser.profilePic) setShowAvatarPreview(true);
                  }}
                  className={canPreviewAvatar && profileUser.profilePic ? "cursor-zoom-in" : "cursor-default"}
                  aria-label={canPreviewAvatar ? "View full-size profile photo" : undefined}
                >
                  <UserAvatar
                    src={profileUser.profilePic}
                    name={profileUser.fullName || "User"}
                    sizeClass="size-24"
                    className="ring-4 ring-slate-100"
                  />
                </button>
                <div className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-white"></div>
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {profileUser.fullName || "Unknown User"}
                  </h1>
                  {verified ? <BadgeCheck className="size-5 text-emerald-600" /> : null}
                </div>
                <p className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-500 sm:justify-start">
                  <MapPin className="size-4" />
                  {cityLabel}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                  {profileUser.bio?.trim() || "No bio added yet."}
                </p>
              </div>
            </div>

            {/* Center: Quick Stats */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{stats.postsCount || 0}</p>
                <p className="text-xs text-slate-500">Posts</p>
              </div>
              <button
                type="button"
                onClick={() => setConnectionsModalTitle("Followers")}
                className="text-center transition-opacity hover:opacity-70"
              >
                <p className="text-xl font-bold text-slate-900">{stats.followersCount || 0}</p>
                <p className="text-xs text-slate-500">Followers</p>
              </button>
              <button
                type="button"
                onClick={() => setConnectionsModalTitle("Following")}
                className="text-center transition-opacity hover:opacity-70"
              >
                <p className="text-xl font-bold text-slate-900">{stats.followingCount || 0}</p>
                <p className="text-xs text-slate-500">Following</p>
              </button>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{stats.savedCount || 0}</p>
                <p className="text-xs text-slate-500">Saved</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{stats.reviewsCount || 0}</p>
                <p className="text-xs text-slate-500">Reviews</p>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="shrink-0">
              {isOwnProfile ? (
                <Link to="/marketplace?section=profile" className="btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  Edit Profile
                </Link>
              ) : relationship.connectionStatus === "friends" ? (
                <div className="flex gap-2">
                  <Link to="/chat" className="btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                    <MessageCircle className="size-4" />
                    Message
                  </Link>
                  <button type="button" className="btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                    Share
                  </button>
                </div>
              ) : relationship.connectionStatus === "pending_sent" ? (
                <button type="button" className="btn btn-sm rounded-full border border-slate-200 bg-slate-50 text-slate-500" disabled>
                  Request Sent
                </button>
              ) : relationship.connectionStatus === "pending_received" ? (
                <Link to="/connections" className="btn btn-sm rounded-full border-none bg-indigo-600 text-white hover:bg-indigo-500">
                  Respond to Request
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm rounded-full border-none bg-indigo-600 text-white hover:bg-indigo-500"
                  disabled={isConnecting}
                  onClick={() => sendConnectionRequest()}
                >
                  <UserRoundPlus className="size-4" />
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          </section>

          {/* Content Area */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
              {/* Navigation Tabs */}
              <div className="border-b border-slate-200">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(() => {
                    const tabs = isOwnProfile ? [
                      { id: "posts", label: "Posts", icon: Grid3x3 },
                      { id: "listings", label: "Listings", icon: Building2 },
                      { id: "bookmarks", label: "Saved", icon: Save },
                      { id: "drafts", label: "Drafts", icon: Edit2 },
                      { id: "about", label: "About", icon: User },
                      { id: "reviews", label: "Reviews", icon: Star },
                      { id: "activity", label: "Activity", icon: Calendar },
                    ] : [
                      { id: "posts", label: "Posts", icon: Grid3x3 },
                      { id: "listings", label: "Listings", icon: Building2 },
                      { id: "about", label: "About", icon: User },
                      { id: "reviews", label: "Reviews", icon: Star },
                    ];
                    return tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                              ? "border-indigo-600 text-indigo-600"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <Icon className="size-4" />
                          {tab.label}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === "posts" ? (
                <>
                  {/* Filter Chips */}
                  <div className="flex flex-wrap gap-2">
                    {["All Posts", "For Sale", "Looking to Buy", "Sold", "Rented"].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  {/* Posts Grid */}
                  <section>
                    {isPostsLoading ? (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                          <div key={item} className="aspect-square animate-pulse rounded-2xl bg-slate-100" />
                        ))}
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                        <Grid3x3 className="mx-auto size-8 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">No posts yet</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {relationship.isSelf ? "Create your first listing from the marketplace feed." : "This user has not shared any listings yet."}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {posts.map((post) => {
                            const media = normalizeMedia(post);
                            const currentIndex = postCarouselIndex[post._id] || 0;
                            const image = media[currentIndex];
                            const badge = getListingBadge(post);
                            const hasMultipleImages = media.length > 1;
                            
                            const handlePrevImage = (e) => {
                              e.stopPropagation();
                              setPostCarouselIndex(prev => ({
                                ...prev,
                                [post._id]: (prev[post._id] || 0) > 0 ? (prev[post._id] || 0) - 1 : media.length - 1
                              }));
                            };
                            
                            const handleNextImage = (e) => {
                              e.stopPropagation();
                              setPostCarouselIndex(prev => ({
                                ...prev,
                                [post._id]: (prev[post._id] || 0) < media.length - 1 ? (prev[post._id] || 0) + 1 : 0
                              }));
                            };
                            
                            return (
                              <div
                                key={post._id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
                                onClick={() => setSelectedPost(post)}
                              >
                                <div className="relative aspect-square overflow-hidden bg-slate-100">
                                  <img
                                    src={image}
                                    alt={post.title || "Listing"}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                  />
                                  
                                  {/* Image navigation arrows */}
                                  {hasMultipleImages && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={handlePrevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                                      >
                                        <ChevronLeft className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleNextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                                      >
                                        <ChevronRight className="size-4" />
                                      </button>
                                      {/* Image indicator */}
                                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                        {media.map((_, idx) => (
                                          <div
                                            key={idx}
                                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                              idx === currentIndex ? 'bg-white' : 'bg-white/50'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                    </>
                                  )}
                                  
                                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${
                                        post.customBadge ? getCustomBadgeClasses(post.customBadge) : "bg-white/95 text-slate-700"
                                      }`}
                                    >
                                      {badge}
                                    </span>
                                    {post.isBlocked && (
                                      <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                                        <ShieldAlert className="size-3" />
                                        Blocked
                                      </span>
                                    )}
                                  </div>
                                  <div className="absolute right-3 bottom-3">
                                    <button
                                      type="button"
                                      className="size-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setPostToShare(post);
                                        setShowShareModal(true);
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                    </button>
                                  </div>
                                  {isOwnProfile && (
                                    <div className="absolute right-3 top-3">
                                      <div className="relative">
                                        <button
                                          type="button"
                                          className="btn btn-xs btn-circle border border-slate-200 bg-white/90 text-slate-600 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setMenuOpenPostId(menuOpenPostId === post._id ? null : post._id);
                                          }}
                                        >
                                          <MoreVertical className="size-3.5" />
                                        </button>
                                        {menuOpenPostId === post._id && (
                                          <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setPostToEdit(post);
                                                setShowEditModal(true);
                                                setNewImageFiles([]);
                                                setNewImagePreviews([]);
                                                setRemovedImageUrls([]);
                                                setMenuOpenPostId(null);
                                              }}
                                            >
                                              <Edit2 className="size-4 text-slate-500" />
                                              Edit Post
                                            </button>
                                            <div className="border-t border-slate-100" />
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setPostToDelete(post);
                                                setShowDeleteModal(true);
                                                setMenuOpenPostId(null);
                                              }}
                                            >
                                              <Trash2 className="size-4" />
                                              Delete Post
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <p className="text-lg font-bold text-slate-900">{formatMoney(post.price)}</p>
                                  <p className="mt-1 text-sm font-medium text-slate-800 line-clamp-1">{post.title || "Premium Listing"}</p>
                                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                    <MapPin className="size-3.5" />
                                    <span className="truncate">{post.city || "Location"}</span>
                                  </div>
                                  {post.isBlocked && (
                                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
                                      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                                        <ShieldAlert className="size-3.5" />
                                        Blocked by Admin
                                      </p>
                                      <p className="mt-1 text-[11px] text-red-600">
                                        Reason: {getBlockReasonLabel(post.blockReasonCode)}
                                      </p>
                                      {post.blockNote && <p className="mt-1 text-[11px] text-red-600">{post.blockNote}</p>}
                                    </div>
                                  )}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {post.bedrooms || 0} Beds
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {post.bathrooms || 0} Baths
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {Number(post.areaSqft || 0)} sqft
                                    </span>
                                  </div>
                                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-1">
                                        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={(event) => { event.stopPropagation(); toggleLike(post._id); }}><Heart className={`size-4 ${post.isLikedByMe ? "fill-red-500 text-red-500" : ""}`} /></button>
                                        <span className="text-[11px] text-slate-500">{post.likesCount || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Eye className="size-4 text-slate-400" />
                                        <span className="text-[11px] text-slate-500">{post.viewCount || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={(event) => { event.stopPropagation(); setSelectedPostForComments(post); }}><MessageCircle className="size-4" /></button>
                                        <span className="text-[11px] text-slate-500">{post.commentCount || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={(event) => { event.stopPropagation(); toggleSave(post._id); }}><Bookmark className={`size-4 ${post.isSavedByMe ? "fill-indigo-600 text-indigo-600" : ""}`} /></button>
                                        <span className="text-[11px] text-slate-500">{post.savesCount || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {hasNextPage ? (
                          <button
                            type="button"
                            className="btn mt-6 w-full rounded-xl border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                            disabled={isFetchingNextPage}
                            onClick={() => fetchNextPage()}
                          >
                            {isFetchingNextPage ? "Loading..." : "Load more posts"}
                          </button>
                        ) : null}
                      </>
                    )}
                  </section>
                </>
              ) : activeTab === "bookmarks" ? (
                <>
                  {/* Bookmarks Grid */}
                  <section>
                    {isBookmarksLoading ? (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                          <div key={item} className="aspect-square animate-pulse rounded-2xl bg-slate-100" />
                        ))}
                      </div>
                    ) : bookmarks.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-indigo-50">
                          <Save className="size-10 text-indigo-400" />
                        </div>
                        <h3 className="mt-6 text-lg font-semibold text-slate-900">No saved properties yet</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {isOwnProfile ? "Save properties from the marketplace to quickly find them later." : "This user has not saved any properties yet."}
                        </p>
                        {isOwnProfile && (
                          <Link to="/marketplace" className="btn btn-sm mt-6 rounded-full border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50">
                            Explore Properties
                          </Link>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {bookmarks.map((post) => {
                            const media = normalizeMedia(post);
                            const currentIndex = postCarouselIndex[post._id] || 0;
                            const image = media[currentIndex];
                            const badge = getListingBadge(post);
                            const hasMultipleImages = media.length > 1;
                            
                            const handlePrevImage = (e) => {
                              e.stopPropagation();
                              setPostCarouselIndex(prev => ({
                                ...prev,
                                [post._id]: (prev[post._id] || 0) > 0 ? (prev[post._id] || 0) - 1 : media.length - 1
                              }));
                            };
                            
                            const handleNextImage = (e) => {
                              e.stopPropagation();
                              setPostCarouselIndex(prev => ({
                                ...prev,
                                [post._id]: (prev[post._id] || 0) < media.length - 1 ? (prev[post._id] || 0) + 1 : 0
                              }));
                            };
                            
                            return (
                              <div
                                key={post._id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
                                onClick={() => setSelectedPost(post)}
                              >
                                <div className="relative aspect-square overflow-hidden bg-slate-100">
                                  <img
                                    src={image}
                                    alt={post.title || "Listing"}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                  />
                                  
                                  {/* Image navigation arrows */}
                                  {hasMultipleImages && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={handlePrevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                                      >
                                        <ChevronLeft className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleNextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                                      >
                                        <ChevronRight className="size-4" />
                                      </button>
                                      {/* Image indicator */}
                                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                        {media.map((_, idx) => (
                                          <div
                                            key={idx}
                                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                              idx === currentIndex ? 'bg-white' : 'bg-white/50'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                    </>
                                  )}
                                  
                                  <div className="absolute left-3 top-3">
                                    <PostAuthorLink
                                      author={post.author}
                                      sizeClass="size-6"
                                      textColor="white"
                                      meta={<p className="truncate text-[10px] text-white/90">{relativeDate(post.createdAt)}</p>}
                                    />
                                  </div>
                                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                                    {post.isBlocked && (
                                      <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                                        <ShieldAlert className="size-3" />
                                        Blocked
                                      </span>
                                    )}
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${
                                        post.customBadge ? getCustomBadgeClasses(post.customBadge) : "bg-white/95 text-slate-700"
                                      }`}
                                    >
                                      {badge}
                                    </span>
                                  </div>
                                  <div className="absolute right-3 bottom-3">
                                    <button
                                      type="button"
                                      className="size-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setPostToShare(post);
                                        setShowShareModal(true);
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="p-4">
                                  <p className="text-lg font-bold text-slate-900">{formatMoney(post.price)}</p>
                                  <p className="mt-1 text-sm font-medium text-slate-800 line-clamp-1">{post.title || "Premium Listing"}</p>
                                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                    <MapPin className="size-3.5" />
                                    <span className="truncate">{post.city || "Location"}</span>
                                  </div>
                                  {post.isBlocked && (
                                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
                                      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                                        <ShieldAlert className="size-3.5" />
                                        Blocked by Admin
                                      </p>
                                      <p className="mt-1 text-[11px] text-red-600">
                                        Reason: {getBlockReasonLabel(post.blockReasonCode)}
                                      </p>
                                      {post.blockNote && <p className="mt-1 text-[11px] text-red-600">{post.blockNote}</p>}
                                    </div>
                                  )}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {post.bedrooms || 0} Beds
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {post.bathrooms || 0} Baths
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {Number(post.areaSqft || 0)} sqft
                                    </span>
                                  </div>
                                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-1">
                                        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={(event) => { event.stopPropagation(); toggleLike(post._id); }}><Heart className={`size-4 ${post.isLikedByMe ? "fill-red-500 text-red-500" : ""}`} /></button>
                                        <span className="text-[11px] text-slate-500">{post.likesCount || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Eye className="size-4 text-slate-400" />
                                        <span className="text-[11px] text-slate-500">{post.viewCount || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={(event) => { event.stopPropagation(); setSelectedPostForComments(post); }}><MessageCircle className="size-4" /></button>
                                        <span className="text-[11px] text-slate-500">{post.commentCount || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={(event) => { event.stopPropagation(); toggleSave(post._id); }}><Bookmark className={`size-4 ${post.isSavedByMe ? "fill-indigo-600 text-indigo-600" : ""}`} /></button>
                                        <span className="text-[11px] text-slate-500">{post.savesCount || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {hasNextBookmarkPage ? (
                          <button
                            type="button"
                            className="btn mt-6 w-full rounded-xl border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                            disabled={isFetchingNextBookmarkPage}
                            onClick={() => fetchNextBookmarkPage()}
                          >
                            {isFetchingNextBookmarkPage ? "Loading..." : "Load more bookmarks"}
                          </button>
                        ) : null}
                      </>
                    )}
                  </section>
                </>
              ) : activeTab === "drafts" ? (
                <>
                  <section>
                    {isDraftsLoading ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {[1, 2].map((item) => (
                          <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                        ))}
                      </div>
                    ) : drafts.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-indigo-50">
                          <Edit2 className="size-10 text-indigo-400" />
                        </div>
                        <h3 className="mt-6 text-lg font-semibold text-slate-900">No drafts yet</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          Save a listing as a draft while creating it to pick up where you left off.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {drafts.map((post) => {
                            const media = normalizeMedia(post);
                            const image = media[0];
                            return (
                              <div key={post._id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                  {image ? (
                                    <img src={image} alt={post.title || "Draft"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-slate-300">
                                      <Grid3x3 className="size-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-800">{post.title || "Untitled draft"}</p>
                                  <p className="text-xs text-slate-500">
                                    {post.price ? formatMoney(post.price) : "No price set"} · Last edited {formatDate(post.updatedAt)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="btn btn-xs rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    onClick={() => {
                                      setPostToEdit(post);
                                      setShowEditModal(true);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs rounded-lg border-none bg-indigo-600 text-white hover:bg-indigo-500"
                                    disabled={updatingPost}
                                    onClick={() =>
                                      updatePost({
                                        postId: post._id,
                                        postData: {
                                          title: post.title,
                                          caption: post.caption,
                                          customBadge: post.customBadge,
                                          mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
                                          status: "PUBLISHED",
                                        },
                                        files: [],
                                        removedUrls: [],
                                      })
                                    }
                                  >
                                    Publish
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {hasNextDraftPage ? (
                          <button
                            type="button"
                            className="btn mt-6 w-full rounded-xl border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                            disabled={isFetchingNextDraftPage}
                            onClick={() => fetchNextDraftPage()}
                          >
                            {isFetchingNextDraftPage ? "Loading..." : "Load more drafts"}
                          </button>
                        ) : null}
                      </>
                    )}
                  </section>
                </>
              ) : activeTab === "about" ? (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                          <Calendar className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 uppercase">Member Since</p>
                          <p className="text-sm text-slate-600 truncate">
                            {profileUser.createdAt ? new Date(profileUser.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <BadgeCheck className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 uppercase">Verified Email</p>
                          <p className="text-sm text-slate-600 truncate">{profileUser.emailVerified ? "Verified" : "Not Verified"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                          <Phone className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 uppercase">Phone</p>
                          <p className="text-sm text-slate-600 truncate">{profileUser.phoneNumber || "Not provided"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <MapPin className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 uppercase">Locations</p>
                          <p className="text-sm text-slate-600 truncate">
                            {(profileUser.preferredLocalities || []).slice(0, 2).join(", ") || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              ) : activeTab === "activity" ? (
                <>
                  <section>
                    {isActivityLoading ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin text-indigo-600" />
                        <p className="mt-2 text-sm text-slate-500">Loading activity...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Likes Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Heart className="size-4 text-red-500" />
                            Liked Posts ({userActivityData?.likes?.length || 0})
                          </h3>
                          {userActivityData?.likes?.length === 0 ? (
                            <p className="text-sm text-slate-500">No liked posts yet</p>
                          ) : (
                            <div className="space-y-3">
                              {userActivityData?.likes?.map((like) => (
                                <div 
                                  key={like._id}
                                  className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition"
                                  onClick={() => setSelectedPost(like.post)}
                                >
                                  {like.post?.mediaUrls?.[0] && (
                                    <img 
                                      src={like.post.mediaUrls[0]} 
                                      alt="Post" 
                                      className="size-12 rounded-lg object-cover"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-slate-800">{like.post?.title || "Property"}</p>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <IndianRupee className="size-3" />
                                      <span>{like.post?.price?.toLocaleString()}</span>
                                      <span className="mx-1">·</span>
                                      <MapPin className="size-3" />
                                      <span>{like.post?.city}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Comments Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <MessageCircle className="size-4 text-blue-500" />
                            Comments ({userActivityData?.comments?.length || 0})
                          </h3>
                          {userActivityData?.comments?.length === 0 ? (
                            <p className="text-sm text-slate-500">No comments yet</p>
                          ) : (
                            <div className="space-y-3">
                              {userActivityData?.comments?.map((comment) => (
                                <div 
                                  key={comment._id}
                                  className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition"
                                  onClick={() => comment.post && setSelectedPost(comment.post)}
                                >
                                  {comment.post?.mediaUrls?.[0] && (
                                    <img 
                                      src={comment.post.mediaUrls[0]} 
                                      alt="Post" 
                                      className="size-12 rounded-lg object-cover"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-slate-800">{comment.post?.title || "Property"}</p>
                                    <p className="truncate text-xs text-slate-600">"{comment.commentText}"</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Saved Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Bookmark className="size-4 text-indigo-500" />
                            Saved Posts ({userActivityData?.saved?.length || 0})
                          </h3>
                          {userActivityData?.saved?.length === 0 ? (
                            <p className="text-sm text-slate-500">No saved posts yet</p>
                          ) : (
                            <div className="space-y-3">
                              {userActivityData?.saved?.map((save) => (
                                <div 
                                  key={save._id}
                                  className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition"
                                  onClick={() => setSelectedPost(save.post)}
                                >
                                  {save.post?.mediaUrls?.[0] && (
                                    <img 
                                      src={save.post.mediaUrls[0]} 
                                      alt="Post" 
                                      className="size-12 rounded-lg object-cover"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-slate-800">{save.post?.title || "Property"}</p>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <IndianRupee className="size-3" />
                                      <span>{save.post?.price?.toLocaleString()}</span>
                                      <span className="mx-1">·</span>
                                      <MapPin className="size-3" />
                                      <span>{save.post?.city}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <Grid3x3 className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Coming soon</p>
                  <p className="mt-1 text-sm text-slate-500">This section is under development.</p>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="hidden flex-col gap-4 lg:flex lg:sticky lg:top-24 lg:h-fit">
              {isOwnProfile ? (
                <>
                  {/* Owner Sidebar - Analytics */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Profile Overview</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{stats.postsCount || 0}</p>
                        <p className="text-xs text-slate-500">Posts</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{stats.viewsCount || 0}</p>
                        <p className="text-xs text-slate-500">Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{stats.likesCount || 0}</p>
                        <p className="text-xs text-slate-500">Likes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{stats.savedCount || 0}</p>
                        <p className="text-xs text-slate-500">Saved</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Quick Insights</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Response Rate</span>
                        <span className="text-xs font-semibold text-slate-900">N/A</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Avg Response Time</span>
                        <span className="text-xs font-semibold text-slate-900">N/A</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Total Views</span>
                        <span className="text-xs font-semibold text-slate-900">{stats.viewsCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Profile Visits</span>
                        <span className="text-xs font-semibold text-slate-900">0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Active Listings</span>
                        <span className="text-xs font-semibold text-slate-900">{stats.postsCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Activity</h3>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                          <Grid3x3 className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-900">Posted a property</p>
                          <p className="text-[10px] text-slate-500">Recently</p>
                        </div>
                      </div>
                      {posts.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center">No recent activity</p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Operating Areas</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="size-4 text-slate-400" />
                        <span>{profileUser?.city || profileUser?.homeBase || "Not specified"}</span>
                      </div>
                      {(profileUser?.preferredLocalities || []).slice(0, 3).map((locality, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="size-4 text-slate-400" />
                          <span>{locality}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">About</h3>
                    <p className="text-sm text-slate-600 line-clamp-4">
                      {profileUser?.bio?.trim() || "No bio information available."}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedPostForComments ? (
        <CommentSection
          post={selectedPostForComments}
          onClose={() => setSelectedPostForComments(null)}
        />
      ) : null}

      {selectedPost ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSelectedPost(null)}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <p className="text-lg font-black text-slate-800">Property Details</p>
                <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setSelectedPost(null)}><X className="size-4" /></button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="relative h-72 w-full rounded-2xl overflow-hidden bg-slate-100">
                  {(() => {
                    const media = normalizeMedia(selectedPost);
                    const currentImage = media[detailCarouselIndex] || media[0];
                    const isVideo = isVideoUrl(currentImage);
                    return isVideo ? (
                      <video
                        src={currentImage}
                        alt={selectedPost.title || "Property"}
                        className="h-full w-full object-cover"
                        controls
                      />
                    ) : (
                      <img
                        src={currentImage}
                        alt={selectedPost.title || "Property"}
                        className="h-full w-full object-cover"
                      />
                    );
                  })()}
                  {normalizeMedia(selectedPost).length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-xs btn-circle absolute left-2 top-1/2 -translate-y-1/2 z-20 border border-slate-200 bg-white/90 text-slate-600"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          event.nativeEvent.stopImmediatePropagation();
                          setDetailCarouselIndex((prev) => {
                            const media = normalizeMedia(selectedPost);
                            return prev === 0 ? media.length - 1 : prev - 1;
                          });
                        }}
                      >
                        <ChevronLeft className="size-3" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2 z-20 border border-slate-200 bg-white/90 text-slate-600"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          event.nativeEvent.stopImmediatePropagation();
                          setDetailCarouselIndex((prev) => {
                            const media = normalizeMedia(selectedPost);
                            return prev === media.length - 1 ? 0 : prev + 1;
                          });
                        }}
                      >
                        <ChevronRight className="size-3" />
                      </button>
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
                        {detailCarouselIndex + 1}/{normalizeMedia(selectedPost).length}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-2xl font-black text-slate-800">{formatMoney(selectedPost.price)}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      selectedPost.customBadge ? getCustomBadgeClasses(selectedPost.customBadge) : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {getListingBadge(selectedPost)}
                  </span>
                </div>

                <div>
                  <p className="text-lg font-semibold text-slate-800">{selectedPost.title || "Property Listing"}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500"><MapPin className="size-3.5" />{selectedPost.locality || selectedPost.city || "Location"}</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedPost.caption || "Beautifully designed property with excellent connectivity and amenities."}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Bedrooms: {selectedPost.bedrooms || 0}</div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Bathrooms: {selectedPost.bathrooms || 0}</div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Area: {Number(selectedPost.areaSqft || 0)} sqft</div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Parking: Available</div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Seller Profile</p>
                  <div className="mt-2 flex items-center gap-2">
                    <PostAuthorLink author={selectedPost.author} sizeClass="size-9" onClick={() => setSelectedPost(null)} />
                    <BadgeCheck className="ml-auto size-4 text-indigo-600" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Nearby & Market Context</p>
                  <div className="mt-2 grid gap-2 text-xs text-slate-600">
                    <p>Schools: 3 within 2.5 km</p>
                    <p>Hospitals: 2 within 3 km</p>
                    <p>Public Transport: Metro station in 1.1 km</p>
                    <p>Market Trend: +6.8% YoY in this locality</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 border-t border-slate-200 p-4">
                <button type="button" className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><MessageCircle className="size-4" />Chat</button>
                <button type="button" className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><CalendarDays className="size-4" />Visit</button>
                <button type="button" className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => toggleSave(selectedPost._id)}><Bookmark className="size-4" />Save</button>
                <button type="button" className="btn btn-sm border-none bg-indigo-600 text-white hover:bg-indigo-500"><Send className="size-4" />Call</button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2">
                <Trash2 className="size-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete Post</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShowDeleteModal(false);
                  setPostToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  if (postToDelete) {
                    deletePost(postToDelete._id);
                    setShowDeleteModal(false);
                    setPostToDelete(null);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {showEditModal && postToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Edit Post</h3>
              <button
                type="button"
                className="btn btn-ghost btn-circle"
                onClick={() => {
                  setShowEditModal(false);
                  setPostToEdit(null);
                }}
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const postData = {
                  title: formData.get('title'),
                  caption: formData.get('caption'),
                  customBadge: formData.get('customBadge'),
                  mediaUrls: Array.isArray(postToEdit.mediaUrls) ? postToEdit.mediaUrls : [],
                };
                updatePost({ postId: postToEdit._id, postData, files: newImageFiles, removedUrls: removedImageUrls });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Images ({(postToEdit.mediaUrls?.length || 0) + newImageFiles.length}/5)
                </label>
                
                {/* Combined image display in horizontal scroll */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {/* Current images */}
                  {postToEdit.mediaUrls && postToEdit.mediaUrls.map((url, index) => (
                    !removedImageUrls.includes(url) && (
                      <div key={`current-${index}`} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                        <img
                          src={url}
                          alt={`Current image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setRemovedImageUrls([...removedImageUrls, url])}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    )
                  ))}
                  
                  {/* New image previews */}
                  {newImagePreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                      <img
                        src={preview}
                        alt={`New image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 left-1 bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">New</div>
                      <button
                        type="button"
                        onClick={() => {
                          const newFiles = newImageFiles.filter((_, i) => i !== index);
                          const newPreviews = newImagePreviews.filter((_, i) => i !== index);
                          setNewImageFiles(newFiles);
                          setNewImagePreviews(newPreviews);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new images button */}
                {(postToEdit.mediaUrls?.filter(url => !removedImageUrls.includes(url)).length || 0) + newImageFiles.length < 5 && (
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={(postToEdit.mediaUrls?.filter(url => !removedImageUrls.includes(url)).length || 0) + newImageFiles.length >= 5}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const currentCount = (postToEdit.mediaUrls?.filter(url => !removedImageUrls.includes(url)).length || 0) + newImageFiles.length;
                      const remainingSlots = 5 - currentCount;
                      
                      if (remainingSlots <= 0) {
                        toast.error("Maximum 5 images allowed");
                        return;
                      }
                      
                      const filesToAdd = files.slice(0, remainingSlots);
                      if (files.length > remainingSlots) {
                        toast.warning(`Only ${remainingSlots} more image(s) can be added`);
                      }
                      
                      setNewImageFiles([...newImageFiles, ...filesToAdd]);
                      
                      // Create previews
                      const previews = filesToAdd.map(file => URL.createObjectURL(file));
                      setNewImagePreviews([...newImagePreviews, ...previews]);
                    }}
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:cursor-pointer hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
                
                {(postToEdit.mediaUrls?.filter(url => !removedImageUrls.includes(url)).length || 0) + newImageFiles.length >= 5 && (
                  <p className="text-sm text-slate-500">Maximum 5 images reached</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={postToEdit.title || ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Badge</label>
                <input
                  type="text"
                  name="customBadge"
                  defaultValue={postToEdit.customBadge || ""}
                  maxLength={40}
                  placeholder={`Leave blank to use the default (${getListingBadge(postToEdit)})`}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">Shown on the card in place of the default listing badge, e.g. "Looking for Rent".</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  name="caption"
                  defaultValue={postToEdit.caption || ""}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Add a description for your post..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setShowEditModal(false);
                    setPostToEdit(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm bg-indigo-600 text-white hover:bg-indigo-700"
                  disabled={updatingPost}
                >
                  {updatingPost ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setPostToShare(null);
        }}
        postUrl={postToShare ? `${window.location.origin}/property/${postToShare._id}` : ""}
        postTitle={postToShare?.title || "Property"}
      />

      {/* Followers / Following Modal */}
      <UserListModal
        isOpen={Boolean(connectionsModalTitle)}
        onClose={() => setConnectionsModalTitle(null)}
        title={connectionsModalTitle}
        users={connectionsData}
        isLoading={isConnectionsLoading}
        emptyMessage={connectionsForbidden ? "Only friends can view this list." : "Nobody here yet."}
      />

      {/* Avatar Preview — full-size photo, own profile or friends only */}
      {showAvatarPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowAvatarPreview(false)}
        >
          <button
            type="button"
            onClick={() => setShowAvatarPreview(false)}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <img
            src={profileUser.profilePic}
            alt={profileUser.fullName || "Profile photo"}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </AppShell>
  );
}
