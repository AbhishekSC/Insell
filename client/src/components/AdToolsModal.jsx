import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Megaphone,
  X,
  ExternalLink,
  Pause,
  Play,
  Upload,
  Coins,
  Share2,
  Calendar,
  Eye,
  MousePointerClick,
  PlusCircle,
  Building,
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
        mediaUrl,
        targetUrl,
        ctaText,
        badgeText: "Sponsored",
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
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-3xl rounded-3xl p-0 overflow-hidden bg-base-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-200 bg-primary/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-base-content flex items-center gap-1.5">
                Ad Tools & Promotions
                <span className="badge badge-primary badge-sm">Instagram Style</span>
              </h3>
              <p className="text-xs text-base-content/60">
                Run feed ads to boost inquiries and reach thousands of buyers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost text-base-content/60"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Coins Wallet Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-base-200 bg-amber-500/10 px-6 py-3">
          <div className="flex items-center gap-2">
            <Coins className="size-5 text-amber-600" />
            <div>
              <span className="text-sm font-black text-amber-950">
                {coinBalance} Coins Available
              </span>
              <span className="ml-2 text-xs font-semibold text-amber-800">
                (Value: ₹{((coinBalance || 0) * 0.1).toFixed(2)})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-900">
            <span>🎁 4 Coins = ₹0.40 • Refer friends to earn 65 Coins!</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-base-200 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === "create"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <PlusCircle className="size-4" />
              Create Campaign
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === "campaigns"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4" />
              My Running Campaigns ({campaigns.length})
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="max-h-[68vh] overflow-y-auto p-6">
          {activeTab === "create" ? (
            <div className="space-y-5">
              {/* Promotion Mode Selection */}
              <div>
                <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Promotion Source
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode("post");
                      if (myPostsData?.length > 0 && !selectedPostId) {
                        handleSelectPost(myPostsData[0]._id);
                      }
                    }}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      creationMode === "post"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-base-content">
                      <Building className="size-4 text-primary" />
                      Promote a Listing
                    </div>
                    <p className="mt-1 text-[11px] text-base-content/60">
                      Auto-fill from one of your active property listings.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode("custom");
                    }}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      creationMode === "custom"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-base-content">
                      <Upload className="size-4 text-primary" />
                      Custom Ad Banner
                    </div>
                    <p className="mt-1 text-[11px] text-base-content/60">
                      Upload your own flyer, logo, or website promo.
                    </p>
                  </button>
                </div>
              </div>

              {/* Select Existing Property */}
              {creationMode === "post" && (
                <div>
                  <label className="text-xs font-bold text-base-content">Select Property Listing</label>
                  {myPostsData?.length === 0 ? (
                    <div className="mt-1.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-content">
                      You haven&apos;t posted any properties yet. Switch to &quot;Custom Ad Banner&quot; or create a post first.
                    </div>
                  ) : (
                    <select
                      className="select select-bordered select-sm mt-1.5 w-full rounded-xl"
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

              {/* Custom Banner Upload */}
              {creationMode === "custom" && (
                <div>
                  <label className="text-xs font-bold text-base-content">Banner Image</label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadBanner}
                      className="file-input file-input-bordered file-input-sm w-full max-w-xs rounded-xl"
                    />
                    {uploadingImage && <span className="loading loading-spinner loading-xs text-primary" />}
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-base-content">Ad Headline *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. 3BHK Luxury Villa at 40% Off"
                    className="input input-bordered input-sm mt-1 w-full rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-base-content">Destination Link (Target URL) *</label>
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://... or /property/123"
                    className="input input-bordered input-sm mt-1 w-full rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content">Short Ad Text / Caption *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your offer, amenities, or contact details..."
                  rows={2}
                  className="textarea textarea-bordered textarea-sm mt-1 w-full rounded-xl"
                />
              </div>

              {/* Targeting Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-base-content">Target City</label>
                  <input
                    type="text"
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    placeholder="Leave blank for All Cities"
                    className="input input-bordered input-sm mt-1 w-full rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-base-content">Audience Intent</label>
                  <select
                    value={targetIntent}
                    onChange={(e) => setTargetIntent(e.target.value)}
                    className="select select-bordered select-sm mt-1 w-full rounded-xl"
                  >
                    <option value="All">All Feed Users</option>
                    <option value="Buy">Buyers Only</option>
                    <option value="Rent">Renters Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-base-content">Button Text (CTA)</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Learn More"
                    className="input input-bordered input-sm mt-1 w-full rounded-xl"
                  />
                </div>
              </div>

              {/* Duration & Coin Package Selection */}
              <div>
                <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Select Campaign Duration
                </label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan.durationDays === plan.durationDays;
                    return (
                      <button
                        key={plan.durationDays}
                        type="button"
                        onClick={() => setDurationDays(plan.durationDays)}
                        className={`rounded-2xl border p-3 text-center transition ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary"
                            : "border-base-300 hover:border-base-content/30"
                        }`}
                      >
                        {plan.popular && (
                          <span className="badge badge-primary badge-xs mb-1">Most Popular</span>
                        )}
                        <p className="text-sm font-black text-base-content">{plan.label}</p>
                        <div className="mt-1 flex items-center justify-center gap-1 text-primary font-bold text-xs">
                          <Coins className="size-3.5 text-amber-500" />
                          {plan.coins} Coins
                        </div>
                        <p className="text-[10px] text-base-content/50 mt-0.5">(₹{plan.rupeeValue} value)</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Launch Action */}
              <div className="pt-2 border-t border-base-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-base-content/70">
                    Campaign Cost: <span className="font-bold text-primary">{selectedPlan.coins} Coins</span>
                  </p>
                  {!hasEnoughCoins && (
                    <p className="text-xs text-error font-medium mt-0.5">
                      Need {selectedPlan.coins - coinBalance} more coins. Invite friends to get 65 coins each!
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!hasEnoughCoins || launching || !title || !description || !mediaUrl || !targetUrl}
                  onClick={() => launchCampaign()}
                  className="btn btn-primary rounded-xl px-6"
                >
                  {launching ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Launch with {selectedPlan.coins} Coins
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* My Campaigns Tab */
            <div className="space-y-4">
              {loadingCampaigns ? (
                <div className="py-12 text-center">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 py-12 text-center">
                  <Megaphone className="mx-auto size-10 text-base-content/30" />
                  <p className="mt-2 text-sm font-bold text-base-content">No campaigns yet</p>
                  <p className="text-xs text-base-content/60">
                    Promote your first property or flyer to reach thousands of feed users.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className="btn btn-primary btn-sm mt-4 rounded-xl"
                  >
                    <PlusCircle className="size-4 mr-1" />
                    Create Campaign
                  </button>
                </div>
              ) : (
                campaigns.map((camp) => (
                  <div
                    key={camp._id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-base-300 p-4 transition hover:border-primary/40 bg-base-100"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={camp.mediaUrl}
                        alt={camp.title}
                        className="h-16 w-16 rounded-xl object-cover border border-base-200"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-base-content line-clamp-1">{camp.title}</h4>
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
                        <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{camp.description}</p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-base-content/50">
                          <span>📍 {camp.targetCity || "Pan-India"}</span>
                          <span>•</span>
                          <span>⏳ {camp.isExpired ? "Ended" : `${camp.daysRemaining} days left`}</span>
                          <span>•</span>
                          <span>🪙 {camp.coinsSpent || 0} coins</span>
                        </div>
                      </div>
                    </div>

                    {/* Analytics & Controls */}
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-base-200">
                      <div className="flex items-center gap-4 text-center">
                        <div>
                          <div className="flex items-center gap-1 text-xs font-bold text-base-content">
                            <Eye className="size-3.5 text-primary" />
                            {camp.impressionsCount}
                          </div>
                          <span className="text-[10px] text-base-content/50">Views</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1 text-xs font-bold text-base-content">
                            <MousePointerClick className="size-3.5 text-secondary" />
                            {camp.clicksCount}
                          </div>
                          <span className="text-[10px] text-base-content/50">Clicks ({camp.ctr})</span>
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
                              <Pause className="size-3" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="size-3" />
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
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
}
