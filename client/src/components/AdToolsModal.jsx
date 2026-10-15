import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  X,
  ExternalLink,
  Pause,
  Play,
  Upload,
  Coins,
  Eye,
  MousePointerClick,
  PlusCircle,
  Building,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

export default function AdToolsModal({ isOpen, onClose, preselectedPost = null }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(preselectedPost ? "create" : "campaigns");

  // Form state
  const [creationMode, setCreationMode] = useState(preselectedPost ? "post" : "custom");
  const [selectedPostId, setSelectedPostId] = useState(preselectedPost?._id || "");
  const [title, setTitle] = useState(preselectedPost?.title || "");
  const [description, setDescription] = useState(preselectedPost?.caption || preselectedPost?.description || "");
  const [companyName, setCompanyName] = useState("");
  const [badgeText, setBadgeText] = useState("Ad");
  const [mediaUrl, setMediaUrl] = useState(preselectedPost?.media?.[0]?.url || preselectedPost?.photos?.[0] || "");
  const [targetUrl, setTargetUrl] = useState(preselectedPost ? `/property/${preselectedPost._id}` : "");
  const [ctaText, setCtaText] = useState("View Listing");
  const [targetCity, setTargetCity] = useState(preselectedPost?.city || "");
  const [targetIntent, setTargetIntent] = useState("All");
  const [durationDays, setDurationDays] = useState(3);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fetch my campaigns and coins balance
  const { data: myData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["myCampaigns"],
    queryFn: async () => {
      const res = await axiosInstance.get("/advertisements/user/my-campaigns");
      return res.data?.data;
    },
    enabled: isOpen,
  });

  // Fetch user's own property listings for easy 1-click promotion
  const { data: myPostsData } = useQuery({
    queryKey: ["myPropertiesForAds"],
    queryFn: async () => {
      const res = await axiosInstance.get("/posts/me");
      return res.data?.data?.posts || [];
    },
    enabled: isOpen,
  });

  const campaigns = myData?.campaigns || [];
  const coinBalance = myData?.coinBalance ?? 0;
  const plans = myData?.plans || [
    { durationDays: 1, coins: 200, label: "1 Day", rupeeValue: 20 },
    { durationDays: 3, coins: 500, label: "3 Days", rupeeValue: 50, popular: true },
    { durationDays: 7, coins: 1000, label: "7 Days", rupeeValue: 100 },
    { durationDays: 14, coins: 1800, label: "14 Days", rupeeValue: 180 },
  ];

  const selectedPlan = plans.find((p) => p.durationDays === Number(durationDays)) || plans[1];

  // Select an existing post to promote
  const handleSelectPost = (postId) => {
    setSelectedPostId(postId);
    const post = (myPostsData || []).find((p) => p._id === postId);
    if (post) {
      setTitle(post.title || "");
      setDescription(post.caption || post.description || "");
      const img = post.media?.[0]?.url || post.photos?.[0] || "";
      setMediaUrl(img);
      setTargetUrl(`/property/${post._id}`);
      setTargetCity(post.city || "");
      setTargetIntent(post.listingType === "Rent" ? "Rent" : post.listingType === "Sell" ? "Buy" : "All");
      setCtaText("View Property");
    }
  };

  // Upload custom ad banner
  const handleUploadBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    setUploadingImage(true);

    try {
      const res = await axiosInstance.post("/advertisements/user/upload-banner", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMediaUrl(res.data?.data?.url);
      toast.success("Banner uploaded!");
    } catch {
      toast.error("Failed to upload image. Try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Launch campaign mutation
  const { mutate: launchCampaign, isPending: launching } = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        companyName,
        badgeText: badgeText || "Ad",
        mediaUrl,
        targetUrl,
        ctaText,
        targetCity,
        targetIntent,
        durationDays: selectedPlan.durationDays,
        associatedPostId: creationMode === "post" ? selectedPostId : null,
      };
      const res = await axiosInstance.post("/advertisements/user/create-with-coins", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Campaign launched successfully!");
      queryClient.invalidateQueries({ queryKey: ["myCampaigns"] });
      queryClient.invalidateQueries({ queryKey: ["activeAdvertisements"] });
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      setActiveTab("campaigns");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Could not launch campaign.");
    },
  });

  // Toggle pause/resume
  const { mutate: toggleStatus } = useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.patch(`/advertisements/user/my-campaigns/${id}/status`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Campaign updated");
      queryClient.invalidateQueries({ queryKey: ["myCampaigns"] });
      queryClient.invalidateQueries({ queryKey: ["activeAdvertisements"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Action failed");
    },
  });

  if (!isOpen) return null;

  const hasEnoughCoins = coinBalance >= selectedPlan.coins;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-base-100 p-5 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-base-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-base-content">
                Advertisement Campaigns
              </h3>
              <p className="text-xs text-base-content/60">
                Promote properties or services in the feed using Referral Coins
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-xs btn-circle text-base-content/60"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Coins Wallet Bar */}
        <div className="flex flex-wrap items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 mt-3">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-950">
              {coinBalance} Coins Available
            </span>
            <span className="text-xs font-medium text-amber-800">
              (≈ ₹{((coinBalance || 0) * 0.1).toFixed(2)})
            </span>
          </div>

          <div className="text-[11px] font-semibold text-amber-900">
            4 Coins = ₹0.40 • Earn 65 Coins per Referral
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-base-200 mt-3">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`border-b-2 py-2.5 px-4 text-xs font-bold transition-all ${
              activeTab === "create"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <PlusCircle className="size-3.5" />
              Create Campaign
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`border-b-2 py-2.5 px-4 text-xs font-bold transition-all ${
              activeTab === "campaigns"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              My Running Campaigns ({campaigns.length})
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 pr-1">
          {activeTab === "create" ? (
            <div className="space-y-3.5">
              {/* Promotion Mode Selection */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1.5 block">
                  Campaign Source
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode("post");
                      if (myPostsData?.length > 0 && !selectedPostId) {
                        handleSelectPost(myPostsData[0]._id);
                      }
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      creationMode === "post"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-base-content">
                      <Building className="size-3.5 text-primary" />
                      Promote a Listing
                    </div>
                    <p className="mt-0.5 text-[11px] text-base-content/60">
                      Auto-fill from one of your active property posts.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode("custom");
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      creationMode === "custom"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-base-content">
                      <Upload className="size-3.5 text-primary" />
                      Custom Ad Banner
                    </div>
                    <p className="mt-0.5 text-[11px] text-base-content/60">
                      Upload your own flyer, banner, or promotional creative.
                    </p>
                  </button>
                </div>
              </div>

              {/* Select Existing Property */}
              {creationMode === "post" && (
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Select Property Listing *
                  </label>
                  {myPostsData?.length === 0 ? (
                    <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-content">
                      You haven&apos;t posted any properties yet. Switch to &quot;Custom Ad Banner&quot; or create a post first.
                    </div>
                  ) : (
                    <select
                      className="select select-bordered select-sm w-full rounded-xl text-xs"
                      value={selectedPostId}
                      onChange={(e) => handleSelectPost(e.target.value)}
                    >
                      <option value="">-- Choose a property --</option>
                      {(myPostsData || []).map((post) => (
                        <option key={post._id} value={post._id}>
                          {post.title} (₹{post.price?.toLocaleString("en-IN") || "N/A"} in {post.city})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Campaign Title */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Luxury 3 BHK in Whitefield with Zero Brokerage"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input input-sm input-bordered w-full rounded-xl text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Description / Copy *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Spacious modern apartment with pool and gym amenities. Available immediately."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="textarea textarea-bordered textarea-sm w-full rounded-xl text-xs"
                />
              </div>

              {/* Advertiser & Badge */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Advertiser / Brand Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sunrise Realty or Your Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    placeholder="Ad"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Banner Image Upload & Preview */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Banner Image *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Image URL or upload banner"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="input input-sm input-bordered flex-1 rounded-xl text-xs"
                  />
                  <label className="btn btn-sm btn-outline gap-1.5 rounded-xl text-xs cursor-pointer">
                    {uploadingImage ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="size-3.5" />
                    )}
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadBanner}
                    />
                  </label>
                </div>

                {mediaUrl && (
                  <div className="mt-2 relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-base-200">
                    <img
                      src={mediaUrl}
                      alt="Banner Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Target Link & CTA Text */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Destination URL / Link *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://... or /property/123"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    placeholder="View Listing"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Targeting Options */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Target City (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    placeholder="Leave blank for Pan-India"
                    className="input input-sm input-bordered w-full rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Audience Intent
                  </label>
                  <select
                    value={targetIntent}
                    onChange={(e) => setTargetIntent(e.target.value)}
                    className="select select-bordered select-sm w-full rounded-xl text-xs"
                  >
                    <option value="All">All Feed Users</option>
                    <option value="Buy">Buyers Only</option>
                    <option value="Rent">Renters Only</option>
                  </select>
                </div>
              </div>

              {/* Duration & Coin Package Selection */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1.5 block">
                  Select Campaign Duration & Budget
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan.durationDays === plan.durationDays;
                    return (
                      <button
                        key={plan.durationDays}
                        type="button"
                        onClick={() => setDurationDays(plan.durationDays)}
                        className={`rounded-xl border p-2.5 text-center transition ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                            : "border-base-300 hover:border-base-content/30"
                        }`}
                      >
                        {plan.popular && (
                          <span className="badge badge-primary badge-xs mb-1">Popular</span>
                        )}
                        <p className="text-xs font-bold text-base-content">{plan.label}</p>
                        <div className="mt-1 flex items-center justify-center gap-1 text-primary font-bold text-xs">
                          <Coins className="size-3 text-amber-500" />
                          {plan.coins} Coins
                        </div>
                        <p className="text-[10px] text-base-content/50 mt-0.5">(₹{plan.rupeeValue} value)</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* My Campaigns Tab */
            <div className="space-y-3">
              {loadingCampaigns ? (
                <div className="py-12 text-center">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 py-12 text-center">
                  <Sparkles className="mx-auto size-10 text-base-content/30" />
                  <p className="mt-2 text-sm font-bold text-base-content">No active campaigns</p>
                  <p className="text-xs text-base-content/60 mt-1">
                    Promote your first listing or custom banner to reach verified feed users.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className="btn btn-primary btn-sm mt-4 rounded-xl gap-1 text-xs"
                  >
                    <PlusCircle className="size-3.5" />
                    Create Campaign
                  </button>
                </div>
              ) : (
                campaigns.map((camp) => (
                  <div
                    key={camp._id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border border-base-300 p-3.5 transition hover:border-primary/40 bg-base-100"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={camp.mediaUrl}
                        alt={camp.title}
                        className="h-14 w-14 rounded-xl object-cover border border-base-200"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-base-content line-clamp-1">{camp.title}</h4>
                          <span
                            className={`badge badge-xs font-bold uppercase ${
                              camp.status === "active" && !camp.isExpired
                                ? "badge-success text-white"
                                : camp.status === "paused"
                                ? "badge-warning"
                                : "badge-ghost"
                            }`}
                          >
                            {camp.isExpired ? "Expired" : camp.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-base-content/60 line-clamp-1 mt-0.5">{camp.description}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-base-content/50">
                          <span>📍 {camp.targetCity || "Pan-India"}</span>
                          <span>•</span>
                          <span>⏳ {camp.isExpired ? "Ended" : `${camp.daysRemaining} days left`}</span>
                          <span>•</span>
                          <span>🪙 {camp.coinsSpent || 0} coins</span>
                        </div>
                      </div>
                    </div>

                    {/* Analytics & Controls */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-base-200">
                      <div className="flex items-center gap-3 text-center">
                        <div>
                          <div className="flex items-center gap-1 text-xs font-bold text-base-content">
                            <Eye className="size-3 text-primary" />
                            {camp.impressionsCount}
                          </div>
                          <span className="text-[9px] text-base-content/50">Views</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1 text-xs font-bold text-base-content">
                            <MousePointerClick className="size-3 text-secondary" />
                            {camp.clicksCount}
                          </div>
                          <span className="text-[9px] text-base-content/50">Clicks ({camp.ctr}%)</span>
                        </div>
                      </div>

                      {!camp.isExpired && (
                        <button
                          type="button"
                          onClick={() => toggleStatus(camp._id)}
                          className="btn btn-xs btn-outline rounded-lg"
                        >
                          {camp.status === "active" ? (
                            <>
                              <Pause className="size-3 mr-0.5" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="size-3 mr-0.5" />
                              Resume
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Action (when in Create tab) */}
        {activeTab === "create" && (
          <div className="pt-3 border-t border-base-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-base-content/80">
                Cost: <span className="font-bold text-primary">{selectedPlan.coins} Coins</span>
              </p>
              {!hasEnoughCoins && (
                <p className="text-[11px] text-error font-medium">
                  Need {selectedPlan.coins - coinBalance} more coins. Refer friends for 65 coins each.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hasEnoughCoins || launching || !title || !description || !mediaUrl || !targetUrl}
                onClick={() => launchCampaign()}
                className="btn btn-primary btn-sm rounded-xl px-5 text-xs font-bold"
              >
                {launching ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    <Sparkles className="size-3.5 mr-1" />
                    Launch Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
