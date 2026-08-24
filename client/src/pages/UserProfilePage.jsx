import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Building2,
  Calendar,
  Clock,
  Edit2,
  Eye,
  Flag,
  Grid3x3,
  Heart,
  IndianRupee,
  Loader2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  Save,
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
import ReportPostModal from "../components/ReportPostModal";
import { getCustomBadgeClasses } from "../lib/badgeColors";
import UserListModal from "../components/UserListModal";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import CommentSection from "../components/CommentSection";
import { getRecentlyViewed } from "../utils/recentlyViewed";
import HighlightsBar from "../components/HighlightsBar";
import PropertyPostCard from "../components/PropertyPostCard";
import ClampedCaption from "../components/ClampedCaption";
import CompareToggleButton from "../components/CompareToggleButton";
import CompareFloatingBar from "../components/CompareFloatingBar";
import FullscreenMediaViewer from "../components/FullscreenMediaViewer";
import { buildPropertyDetailBadges } from "../lib/propertyDetailBadges";
import { toggleCompareSelection } from "../lib/compareSelection";
import PostAuthorLink from "../components/PostAuthorLink";
import EmailVerification from "../components/EmailVerification";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
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
  const [recentlyViewed, setRecentlyViewed] = useState([]);
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
  // Shared across both the Posts and Saved grids — comparing a mix of your
  // own listings and saved ones is a reasonable use case, same as
  // Marketplace's single feed grid.
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [likedBurstPostId, setLikedBurstPostId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  // Report menu for posts that aren't your own — reuses menuOpenPostId,
  // the same single-open-dropdown state the edit/delete menu already uses.
  const [reportTargetPost, setReportTargetPost] = useState(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [connectionsModalTitle, setConnectionsModalTitle] = useState(null);

  // Reset tab to posts when userId changes (viewing different user)
  useEffect(() => {
    setActiveTab("posts");
  }, [userId]);

  // Also populates the shared ["authUser"] cache entry that other components
  // read via queryClient.getQueryData.
  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const res = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });
  const authUser = authData?.data?.user || authData?.data || null;

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
  const [showAboutModal, setShowAboutModal] = useState(false);
  // Full-size preview is limited to your own profile and confirmed friends —
  // not something a stranger/pending connection can zoom into.
  const canPreviewAvatar = isOwnProfile || relationship.connectionStatus === "friends";

  // Real presence, not a decorative always-on dot — only shown on someone
  // else's profile (you already know you're online). Same mechanism
  // ChatContent.jsx uses for the friends list: Stream only reports presence
  // for users it's actively watching, so we opt in per-profile via
  // queryUsers({ presence: true }) and keep it live with presence.changed.
  const { streamClient, currentUserId } = useStreamContext();
  const [isProfileUserOnline, setIsProfileUserOnline] = useState(false);

  useEffect(() => {
    if (isOwnProfile || !streamClient || !currentUserId || !userId) {
      setIsProfileUserOnline(false);
      return undefined;
    }

    let cancelled = false;

    streamClient
      .queryUsers({ id: userId }, {}, { presence: true })
      .then((response) => {
        if (cancelled) return;
        setIsProfileUserOnline(Boolean(response.users?.[0]?.online));
      })
      .catch(() => {});

    const handlePresenceChanged = (event) => {
      if (event.user?.id !== userId) return;
      setIsProfileUserOnline(Boolean(event.user.online));
    };
    streamClient.on("user.presence.changed", handlePresenceChanged);

    return () => {
      cancelled = true;
      streamClient.off("user.presence.changed", handlePresenceChanged);
    };
  }, [isOwnProfile, streamClient, currentUserId, userId]);

  const { data: postsData, isLoading: isPostsLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["userPosts", userId],
    enabled: Boolean(userId),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "12");
      params.set("authorId", userId);
      // Explicit, so this tab keeps showing only published posts even on
      // your own profile — drafts are managed from the create-post
      // composer's own Drafts view instead (MarketplacePage.jsx).
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

  // Recently Viewed lives in localStorage (per-browser, not per-account —
  // see utils/recentlyViewed.js), so it's read fresh whenever this tab
  // opens rather than fetched from the server.
  useEffect(() => {
    if (isOwnProfile && activeTab === "activity") {
      setRecentlyViewed(getRecentlyViewed());
    }
  }, [isOwnProfile, activeTab]);

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

  const { mutate: submitPostReport, isPending: isReportPending } = useMutation({
    mutationFn: async ({ postId, reasonCode, description }) => {
      const response = await axiosInstance.post(`/posts/${postId}/report`, { reasonCode, description });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      setReportSubmitted(true);
      // Hide it from this profile's grids immediately rather than waiting on a refetch.
      const dropReportedPost = (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: (page.posts || []).filter((post) => post._id !== variables.postId),
          })),
        };
      };
      queryClient.setQueriesData({ queryKey: ["userPosts", userId] }, dropReportedPost);
      queryClient.setQueriesData({ queryKey: ["userBookmarks", userId] }, dropReportedPost);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to submit report");
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

  // Shared between the desktop header (auto-width buttons) and the mobile
  // header (equal-width, full-row buttons) so the 5 relationship states
  // don't drift out of sync between the two layouts.
  const renderProfileActions = (buttonClass) => {
    if (isOwnProfile) {
      return (
        <>
          <Link to="/marketplace?section=profile" className={`btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${buttonClass}`}>
            Edit Profile
          </Link>
          {/* "About" replaces Instagram's "View archive" slot on mobile,
              where About isn't its own visible tab — see the mobile-only
              tab bar below. */}
          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className={`btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:hidden ${buttonClass}`}
          >
            About
          </button>
        </>
      );
    }
    if (relationship.connectionStatus === "friends") {
      return (
        <>
          <Link to="/chat" className={`btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${buttonClass}`}>
            <MessageCircle className="size-4" />
            Message
          </Link>
          <button type="button" className={`btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${buttonClass}`}>
            Share
          </button>
        </>
      );
    }
    if (relationship.connectionStatus === "pending_sent") {
      return (
        <button type="button" className={`btn btn-sm rounded-full border border-slate-200 bg-slate-50 text-slate-500 ${buttonClass}`} disabled>
          Request Sent
        </button>
      );
    }
    if (relationship.connectionStatus === "pending_received") {
      return (
        <Link to="/connections" className={`btn btn-sm rounded-full border-none bg-indigo-600 text-white hover:bg-indigo-500 ${buttonClass}`}>
          Respond to Request
        </Link>
      );
    }
    return (
      <button
        type="button"
        className={`btn btn-sm rounded-full border-none bg-indigo-600 text-white hover:bg-indigo-500 ${buttonClass}`}
        disabled={isConnecting}
        onClick={() => sendConnectionRequest()}
      >
        <UserRoundPlus className="size-4" />
        {isConnecting ? "Connecting..." : "Connect"}
      </button>
    );
  };

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

          {/* Profile Header — mobile: Instagram layout (avatar + stats in
              one row, name/bio full-width below, then equal-split action
              buttons). Structurally different enough from the desktop
              header (avatar+stats+button side by side) that it's a
              separate block rather than a responsive reflow of one. */}
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:hidden">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (canPreviewAvatar && profileUser.profilePic) setShowAvatarPreview(true);
                }}
                className={`relative shrink-0 ${canPreviewAvatar && profileUser.profilePic ? "cursor-zoom-in" : "cursor-default"}`}
                aria-label={canPreviewAvatar ? "View full-size profile photo" : undefined}
              >
                <UserAvatar
                  src={profileUser.profilePic}
                  name={profileUser.fullName || "User"}
                  sizeClass="size-20"
                  className="ring-4 ring-slate-100"
                />
                {isProfileUserOnline && (
                  <div className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full bg-emerald-500 ring-2 ring-white"></div>
                )}
              </button>

              <div className="flex flex-1 justify-around">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{stats.postsCount || 0}</p>
                  <p className="text-xs text-slate-500">posts</p>
                </div>
                <button type="button" onClick={() => setConnectionsModalTitle("Followers")} className="text-center">
                  <p className="text-lg font-bold text-slate-900">{stats.followersCount || 0}</p>
                  <p className="text-xs text-slate-500">followers</p>
                </button>
                <button type="button" onClick={() => setConnectionsModalTitle("Following")} className="text-center">
                  <p className="text-lg font-bold text-slate-900">{stats.followingCount || 0}</p>
                  <p className="text-xs text-slate-500">following</p>
                </button>
              </div>
            </div>

            <div className="mt-3">
              <h1 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                {profileUser.fullName || "Unknown User"}
                {verified ? <BadgeCheck className="size-4 text-emerald-600" /> : null}
              </h1>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3.5" />
                {cityLabel}
              </p>
              <p className="mt-1 text-sm text-slate-600">{profileUser.bio?.trim() || "No bio added yet."}</p>
            </div>

            <div className="mt-3 flex gap-2">{renderProfileActions("flex-1")}</div>
          </section>

          {/* Profile Header — desktop/tablet */}
          <section className="hidden rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm sm:flex sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:text-left">
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
                {isProfileUserOnline && (
                  <div className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-white"></div>
                )}
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
            <div className="flex shrink-0 items-center gap-2">{renderProfileActions("")}</div>
          </section>

          <HighlightsBar
            userId={userId}
            isOwnProfile={isOwnProfile}
            isFriend={relationship.connectionStatus === "friends"}
            authUser={authUser}
          />

          {/* Content Area */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
              {/* Navigation Tabs — desktop/tablet: full labeled set. About and
                  Reviews move out of the mobile tab bar (About becomes a
                  header button, see above; Reviews isn't part of the
                  simplified mobile view at all). */}
              <div className="hidden border-b border-slate-200 sm:block">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(() => {
                    const tabs = isOwnProfile ? [
                      { id: "posts", label: "Posts", icon: Grid3x3 },
                      { id: "listings", label: "Listings", icon: Building2 },
                      { id: "bookmarks", label: "Saved", icon: Save },
                      { id: "about", label: "About", icon: User },
                      { id: "reviews", label: "Reviews", icon: Star },
                      { id: "activity", label: "Recently Viewed", icon: Clock },
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

              {/* Navigation Tabs — mobile: Instagram-style icon-only row,
                  limited to Posts (+ Saved / Recently Viewed on your own
                  profile, since those are private to you). */}
              <div className="border-b border-slate-200 sm:hidden">
                <div className="flex items-center justify-around">
                  {(() => {
                    const tabs = isOwnProfile
                      ? [
                          { id: "posts", icon: Grid3x3, label: "Posts" },
                          { id: "bookmarks", icon: Save, label: "Saved" },
                          { id: "activity", icon: Clock, label: "Recently Viewed" },
                        ]
                      : [{ id: "posts", icon: Grid3x3, label: "Posts" }];
                    return tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          aria-label={tab.label}
                          className={`flex-1 border-b-2 py-3 flex items-center justify-center ${
                            activeTab === tab.id
                              ? "border-indigo-600 text-indigo-600"
                              : "border-transparent text-slate-400"
                          }`}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <Icon className="size-5" />
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === "posts" ? (
                <>
                  {/* Filter Chips — desktop/tablet only, hidden on the mobile
                      Instagram-style layout to keep it clean */}
                  <div className="hidden flex-wrap gap-2 sm:flex">
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
                            const badge = getListingBadge(post);
                            const detailBadges = buildPropertyDetailBadges(post);

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
                            
                            const handleDoubleClickMedia = (event) => {
                              event.stopPropagation();
                              toggleLike(post._id);
                              setLikedBurstPostId(post._id);
                              setTimeout(() => {
                                setLikedBurstPostId((current) => (current === post._id ? null : current));
                              }, 700);
                            };

                            return (
                              <PropertyPostCard
                                key={post._id}
                                post={post}
                                media={media}
                                imageIndex={currentIndex}
                                onPrevImage={handlePrevImage}
                                onNextImage={handleNextImage}
                                onDoubleClickMedia={handleDoubleClickMedia}
                                mediaHeightClass="aspect-square"
                                mediaOverlay={
                                  likedBurstPostId === post._id ? (
                                    <Heart className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 fill-white/95 text-white drop-shadow-md animate-pulse" />
                                  ) : null
                                }
                                badge={badge}
                                badgeClassName={post.customBadge ? getCustomBadgeClasses(post.customBadge) : undefined}
                                extraTopRight={
                                  post.isBlocked ? (
                                    <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                                      <ShieldAlert className="size-3" />
                                      Blocked
                                    </span>
                                  ) : null
                                }
                                menu={
                                  isOwnProfile ? (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-circle border-none bg-transparent text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75"
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
                                  ) : (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-circle border-none bg-transparent text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75"
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
                                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setReportTargetPost(post);
                                              setMenuOpenPostId(null);
                                            }}
                                          >
                                            <Flag className="size-3.5" />
                                            Report
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                                compareControl={
                                  <CompareToggleButton
                                    postId={post._id}
                                    selected={selectedForComparison}
                                    onToggle={(id) => setSelectedForComparison((prev) => toggleCompareSelection(prev, id))}
                                  />
                                }
                                onShare={() => {
                                  setPostToShare(post);
                                  setShowShareModal(true);
                                }}
                                onFullscreen={(img) => setSelectedImage(img)}
                                priceBlock={
                                  <>
                                    <p className="text-lg font-bold text-slate-900">{formatMoney(post.price)}</p>
                                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{post.title || "Premium Listing"}</p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <MapPin className="size-3" />
                                      <span>{post.city || "City"}</span>
                                      {post.locality && <><span>·</span><span>{post.locality}</span></>}
                                      {post.latitude && post.longitude && (
                                        <button
                                          type="button"
                                          className="flex items-center gap-1 text-indigo-600 hover:underline"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(`/map-view?propertyId=${post._id}`);
                                          }}
                                        >
                                          <span className="size-1.5 rounded-full bg-indigo-600"></span>
                                          <span>Live Location</span>
                                        </button>
                                      )}
                                    </div>
                                    {post.isBlocked && (
                                      <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
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
                                    {detailBadges.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {detailBadges.slice(0, 6).map((detail, idx) => (
                                          <span
                                            key={idx}
                                            className={`rounded-full ${detail.color} px-2.5 py-1 text-xs font-medium ${detail.textColor}`}
                                          >
                                            {detail.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                }
                                description={
                                  <ClampedCaption text={post.caption || "A beautifully curated property with modern design and premium amenities."} />
                                }
                                onLike={() => toggleLike(post._id)}
                                isLiked={post.isLikedByMe}
                                likesCount={post.likesCount || 0}
                                viewsCount={post.viewCount || 0}
                                onComment={() => setSelectedPostForComments(post)}
                                commentsCount={post.commentCount || 0}
                                onSave={() => toggleSave(post._id)}
                                isSaved={post.isSavedByMe}
                                savesCount={post.savesCount || 0}
                                onContact={!isOwnProfile ? () => navigate(`/property/${post._id}`) : undefined}
                                onOpenPost={() => navigate(`/property/${post._id}`)}
                                className={selectedForComparison.includes(post._id) ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-100"}
                              />
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
                            const badge = getListingBadge(post);
                            const detailBadges = buildPropertyDetailBadges(post);

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

                            const isOwnPost = post.author?._id && String(post.author._id) === String(authUser?._id);

                            const handleDoubleClickMedia = (event) => {
                              event.stopPropagation();
                              toggleLike(post._id);
                              setLikedBurstPostId(post._id);
                              setTimeout(() => {
                                setLikedBurstPostId((current) => (current === post._id ? null : current));
                              }, 700);
                            };

                            return (
                              <PropertyPostCard
                                key={post._id}
                                post={post}
                                media={media}
                                imageIndex={currentIndex}
                                onPrevImage={handlePrevImage}
                                onNextImage={handleNextImage}
                                onDoubleClickMedia={handleDoubleClickMedia}
                                mediaHeightClass="aspect-square"
                                mediaOverlay={
                                  likedBurstPostId === post._id ? (
                                    <Heart className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 fill-white/95 text-white drop-shadow-md animate-pulse" />
                                  ) : null
                                }
                                badge={badge}
                                badgeClassName={post.customBadge ? getCustomBadgeClasses(post.customBadge) : undefined}
                                extraTopRight={
                                  post.isBlocked ? (
                                    <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                                      <ShieldAlert className="size-3" />
                                      Blocked
                                    </span>
                                  ) : null
                                }
                                menu={
                                  !isOwnPost ? (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-circle border-none bg-transparent text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75"
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
                                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setReportTargetPost(post);
                                              setMenuOpenPostId(null);
                                            }}
                                          >
                                            <Flag className="size-3.5" />
                                            Report
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : null
                                }
                                compareControl={
                                  <CompareToggleButton
                                    postId={post._id}
                                    selected={selectedForComparison}
                                    onToggle={(id) => setSelectedForComparison((prev) => toggleCompareSelection(prev, id))}
                                  />
                                }
                                onShare={() => {
                                  setPostToShare(post);
                                  setShowShareModal(true);
                                }}
                                onFullscreen={(img) => setSelectedImage(img)}
                                priceBlock={
                                  <>
                                    <p className="text-lg font-bold text-slate-900">{formatMoney(post.price)}</p>
                                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{post.title || "Premium Listing"}</p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <MapPin className="size-3" />
                                      <span>{post.city || "City"}</span>
                                      {post.locality && <><span>·</span><span>{post.locality}</span></>}
                                      {post.latitude && post.longitude && (
                                        <button
                                          type="button"
                                          className="flex items-center gap-1 text-indigo-600 hover:underline"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(`/map-view?propertyId=${post._id}`);
                                          }}
                                        >
                                          <span className="size-1.5 rounded-full bg-indigo-600"></span>
                                          <span>Live Location</span>
                                        </button>
                                      )}
                                    </div>
                                    {post.isBlocked && (
                                      <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
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
                                    {detailBadges.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {detailBadges.slice(0, 6).map((detail, idx) => (
                                          <span
                                            key={idx}
                                            className={`rounded-full ${detail.color} px-2.5 py-1 text-xs font-medium ${detail.textColor}`}
                                          >
                                            {detail.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                }
                                description={
                                  <ClampedCaption text={post.caption || "A beautifully curated property with modern design and premium amenities."} />
                                }
                                onLike={() => toggleLike(post._id)}
                                isLiked={post.isLikedByMe}
                                likesCount={post.likesCount || 0}
                                viewsCount={post.viewCount || 0}
                                onComment={() => setSelectedPostForComments(post)}
                                commentsCount={post.commentCount || 0}
                                onSave={() => toggleSave(post._id)}
                                isSaved={post.isSavedByMe}
                                savesCount={post.savesCount || 0}
                                onContact={!isOwnPost ? () => navigate(`/property/${post._id}`) : undefined}
                                onOpenPost={() => navigate(`/property/${post._id}`)}
                                className={selectedForComparison.includes(post._id) ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-100"}
                              />
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
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Clock className="size-4 text-slate-500" />
                        Recently Viewed ({recentlyViewed.length})
                      </h3>
                      {recentlyViewed.length === 0 ? (
                        <p className="text-sm text-slate-500">No recently viewed properties yet</p>
                      ) : (
                        <div className="space-y-3">
                          {recentlyViewed.map((item) => (
                            <Link
                              key={item.id}
                              to={`/property/${item.id}`}
                              className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 hover:bg-slate-100 transition"
                            >
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt="Property"
                                  className="size-12 rounded-lg object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-slate-800">{item.title || "Property"}</p>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <IndianRupee className="size-3" />
                                  <span>{item.price?.toLocaleString()}</span>
                                  <span className="mx-1">·</span>
                                  <MapPin className="size-3" />
                                  <span>{item.city}</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
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
        postId={postToShare?._id}
        postImage={postToShare ? normalizeMedia(postToShare)[0] : ""}
      />

      <ReportPostModal
        isOpen={Boolean(reportTargetPost)}
        isPending={isReportPending}
        isSubmitted={reportSubmitted}
        onCancel={() => setReportTargetPost(null)}
        onConfirm={({ reasonCode, description }) =>
          submitPostReport({ postId: reportTargetPost._id, reasonCode, description })
        }
        onDone={() => {
          setReportTargetPost(null);
          setReportSubmitted(false);
        }}
      />

      <CompareFloatingBar selected={selectedForComparison} />
      <FullscreenMediaViewer src={selectedImage} onClose={() => setSelectedImage(null)} />

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

      {/* About Modal — mobile only entry point (the About header button);
          desktop reaches the same content through its own visible tab
          instead, so this modal is never triggered there. */}
      {showAboutModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:hidden"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">About</h3>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
          </div>
        </div>
      )}
    </AppShell>
  );
}
