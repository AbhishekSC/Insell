import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  X,
  Pause,
  Play,
  Upload,
  PlusCircle,
  Building,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MapPin,
  Clock,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

const CAMPAIGN_TILE_COLORS = [
  "bg-slate-900 text-amber-400",
  "bg-red-700 text-white",
  "bg-emerald-700 text-white",
  "bg-indigo-600 text-white",
  "bg-amber-500 text-white",
  "bg-sky-600 text-white",
];

const SECTION_CLASS = "space-y-2.5 rounded-xl border border-base-300/60 bg-base-100 p-3";
const LABEL_CLASS = "mb-1 block text-[11px] font-semibold text-base-content/70";
const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-base-300 bg-base-100 px-3 text-xs text-base-content placeholder:text-base-content/35 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

const tileColorFor = (name = "") => {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CAMPAIGN_TILE_COLORS[hash % CAMPAIGN_TILE_COLORS.length];
};

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
  const [brokenImages, setBrokenImages] = useState({});

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
      const img = post.mediaUrls?.[0] || post.media?.[0]?.url || post.photos?.[0] || "";
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-base-200 px-4 pb-4 pt-2 shadow-2xl sm:rounded-3xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile sheet) */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-base-content/20 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Megaphone className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold leading-tight text-base-content">Ad campaigns</h3>
              <p className="truncate text-[11px] text-base-content/60">Promote listings in the feed with coins</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-base-300/60 text-base-content/70 transition-colors hover:bg-base-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-base-300/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === "create"
                ? "bg-base-100 text-base-content shadow-sm"
                : "text-base-content/55 hover:text-base-content"
            }`}
          >
            <Plus className="size-3.5" />
            Create
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "campaigns"
                ? "bg-base-100 text-base-content shadow-sm"
                : "text-base-content/55 hover:text-base-content"
            }`}
          >
            Running
            {campaigns.length > 0 && (
              <span className="grid min-w-4 h-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {campaigns.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="-mx-1 flex-1 overflow-y-auto px-1 py-3">
          {activeTab === "create" ? (
            <div className="space-y-3">
              {/* Source */}
              <div>
              <label className={LABEL_CLASS}>Campaign Source</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "post", icon: Building, label: "Promote a Listing", hint: "Auto-fill from one of your active property posts." },
                  { id: "custom", icon: Upload, label: "Custom Ad Banner", hint: "Upload your own flyer, banner, or promotional creative." },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const selected = creationMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setCreationMode(opt.id);
                        if (opt.id === "post" && myPostsData?.length > 0 && !selectedPostId) {
                          handleSelectPost(myPostsData[0]._id);
                        }
                      }}
                      className={`flex items-start gap-2.5 rounded-xl border bg-base-100 p-2.5 text-left transition ${
                        selected ? "border-primary ring-1 ring-primary" : "border-base-300/60 hover:border-base-300"
                      }`}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                          selected ? "bg-primary text-white" : "bg-base-200 text-base-content/60"
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-base-content">{opt.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-base-content/55">{opt.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              </div>

              {/* Creative */}
              <section className={SECTION_CLASS}>

                {creationMode === "post" && (
                  <div>
                    <label className={LABEL_CLASS}>Select Property Listing *</label>
                    {myPostsData?.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                        You haven&apos;t posted any properties yet. Switch to &quot;Custom Ad Banner&quot; or create a post first.
                      </p>
                    ) : (
                      <select
                        className={INPUT_CLASS}
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

                {/* Banner */}
                <div>
                  <label className={LABEL_CLASS}>Banner Image *</label>
                  {mediaUrl ? (
                    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-base-300/60 bg-base-200">
                      <img src={mediaUrl} alt="Banner preview" className="h-full w-full object-cover" />
                      <div className="absolute bottom-2 right-2 flex gap-1.5">
                        <label className="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-black/60 px-2.5 text-[11px] font-bold text-white backdrop-blur-sm">
                          {uploadingImage ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
                          Change
                          <input type="file" accept="image/*" className="hidden" onChange={handleUploadBanner} />
                        </label>
                        <button
                          type="button"
                          onClick={() => setMediaUrl("")}
                          aria-label="Remove banner"
                          className="grid size-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="flex aspect-[21/9] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-base-300 bg-base-200/50 text-base-content/55 transition hover:border-primary hover:text-primary">
                        {uploadingImage ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <ImageIcon className="size-5" />
                        )}
                        <span className="text-xs font-bold">{uploadingImage ? "Uploading…" : "Upload banner"}</span>
                        <span className="text-[10px]">Wide image works best (21:9)</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleUploadBanner} />
                      </label>
                      <input
                        type="text"
                        placeholder="Image URL or upload banner"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        className={`${INPUT_CLASS} mt-2`}
                      />
                    </>
                  )}
                </div>

                <div>
                  <label className={LABEL_CLASS}>Campaign Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Luxury 3 BHK in Whitefield with Zero Brokerage"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Description / Copy *</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Spacious modern apartment with pool and gym amenities. Available immediately."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${INPUT_CLASS} h-auto resize-none py-2`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL_CLASS}>Advertiser / Brand Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunrise Realty or Your Name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Badge Label</label>
                    <input
                      type="text"
                      placeholder="Ad"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </section>

              {/* Link */}
              <section className={SECTION_CLASS}>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <label className={LABEL_CLASS}>Destination URL / Link *</label>
                    <input
                      type="text"
                      placeholder="https://... or /property/123"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>CTA Button Text</label>
                    <input
                      type="text"
                      placeholder="View Listing"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </section>

              {/* Audience */}
              <section className={SECTION_CLASS}>
                <div>
                  <label className={LABEL_CLASS}>Target City (Optional)</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-base-content/40" />
                    <input
                      type="text"
                      value={targetCity}
                      onChange={(e) => setTargetCity(e.target.value)}
                      placeholder="Leave blank for Pan-India"
                      className={`${INPUT_CLASS} pl-8`}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Audience Intent</label>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-base-200 p-1">
                    {[
                      { value: "All", label: "All Feed Users" },
                      { value: "Buy", label: "Buyers Only" },
                      { value: "Rent", label: "Renters Only" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTargetIntent(opt.value)}
                        className={`h-7 rounded-md text-xs font-bold transition ${
                          targetIntent === opt.value
                            ? "bg-base-100 text-base-content shadow-sm"
                            : "text-base-content/55 hover:text-base-content"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Duration */}
              <section className={SECTION_CLASS}>
                <label className={LABEL_CLASS}>Select Campaign Duration &amp; Budget</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan.durationDays === plan.durationDays;
                    return (
                      <button
                        key={plan.durationDays}
                        type="button"
                        onClick={() => setDurationDays(plan.durationDays)}
                        className={`relative rounded-xl border px-1 py-2 text-center transition ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-base-300/70 hover:border-base-300"
                        }`}
                      >
                        {plan.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 text-[9px] font-bold leading-4 text-white">
                            Popular
                          </span>
                        )}
                        <p className="text-xs font-extrabold text-base-content">{plan.label}</p>
                        <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-bold text-base-content/70">
                          <span className="size-2 rounded-full bg-amber-400" />
                          {plan.coins} Coins
                        </p>
                        <p className="text-[10px] text-base-content/45">(₹{plan.rupeeValue} value)</p>
                      </button>
                    );
                  })}
                </div>
              </section>
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
                campaigns.map((camp) => {
                  const isActive = camp.status === "active" && !camp.isExpired;
                  const name = camp.companyName || camp.title || "Ad";
                  const endingSoon = !camp.isExpired && camp.daysRemaining <= 1;
                  return (
                    <div key={camp._id} className="rounded-xl border border-base-300/60 bg-base-100 p-3">
                      <div className="flex gap-2.5">
                        {camp.mediaUrl && !brokenImages[camp._id] ? (
                          <img
                            src={camp.mediaUrl}
                            alt={camp.title}
                            onError={() => setBrokenImages((prev) => ({ ...prev, [camp._id]: true }))}
                            className="size-10 shrink-0 rounded-xl border border-base-200 object-cover"
                          />
                        ) : (
                          <div
                            className={`grid size-10 shrink-0 place-items-center rounded-xl text-base font-extrabold ${tileColorFor(name)}`}
                          >
                            {name.trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <h4 className="truncate text-sm font-extrabold text-base-content">{camp.title}</h4>
                            <span
                              className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold ${
                                isActive
                                  ? "bg-green-100 text-green-700"
                                  : camp.isExpired
                                  ? "bg-base-200 text-base-content/60"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  isActive ? "bg-green-600" : camp.isExpired ? "bg-base-content/40" : "bg-amber-500"
                                }`}
                              />
                              {camp.isExpired ? "Expired" : isActive ? "Active" : "Paused"}
                            </span>
                          </div>
                          <p className="truncate text-xs text-base-content/60">{camp.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-base-content/60">
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              {camp.targetCity || "Pan-India"}
                            </span>
                            <span className={`flex items-center gap-1 ${endingSoon ? "text-orange-600" : ""}`}>
                              <Clock className="size-3" />
                              {camp.isExpired
                                ? "Ended"
                                : `${camp.daysRemaining} ${camp.daysRemaining === 1 ? "day" : "days"} left`}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="size-2 rounded-full bg-amber-400" />
                              {camp.coinsSpent || 0} coins
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="grid flex-1 grid-cols-3 divide-x divide-base-300/70 rounded-lg bg-base-200/60 py-1.5">
                          {[
                            { label: "Views", value: camp.impressionsCount ?? 0 },
                            { label: "Clicks", value: camp.clicksCount ?? 0 },
                            { label: "CTR", value: `${String(camp.ctr ?? 0).replace(/%$/, "")}%`, accent: true },
                          ].map((stat) => (
                            <div key={stat.label} className="px-2.5">
                              <p className="text-[10px] font-medium text-base-content/50">{stat.label}</p>
                              <p
                                className={`text-[13px] font-semibold tabular-nums leading-tight ${
                                  stat.accent ? "text-primary" : "text-base-content/85"
                                }`}
                              >
                                {stat.value}
                              </p>
                            </div>
                          ))}
                        </div>

                        {!camp.isExpired && (
                          <button
                            type="button"
                            onClick={() => toggleStatus(camp._id)}
                            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-base-300 bg-base-100 px-3 text-xs font-medium text-base-content/75 transition-colors hover:bg-base-200 hover:text-base-content"
                          >
                            {camp.status === "active" ? (
                              <>
                                <Pause className="size-3 fill-current" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="size-3 fill-current" />
                                Resume
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer Action (when in Create tab) */}
        {activeTab === "create" && (
          <div className="border-t border-base-300/60 pt-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-base-content/60">
                Cost: <span className="font-bold text-primary">{selectedPlan.coins} Coins</span>
              </span>
              <span className={`font-semibold ${hasEnoughCoins ? "text-base-content/60" : "text-error"}`}>
                {hasEnoughCoins
                  ? `Balance: ${coinBalance}`
                  : `Need ${selectedPlan.coins - coinBalance} more coins`}
              </span>
            </div>
            <button
              type="button"
              disabled={!hasEnoughCoins || launching || !title || !description || !mediaUrl || !targetUrl}
              onClick={() => launchCampaign()}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-base-300 disabled:text-base-content/40"
            >
              {launching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Megaphone className="size-4" />
                  Launch Campaign
                </>
              )}
            </button>
            {!hasEnoughCoins && (
              <p className="mt-1.5 text-center text-[10px] text-base-content/50">
                Refer friends for 65 coins each.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
