import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Camera, Link2, MapPin, Phone, Sparkles, UploadCloud, UserCircle } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import LocationPicker from "./LocationPicker";
import EmailVerification from "./EmailVerification";

export default function ProfileContent() {
  const queryClient = useQueryClient();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;
  const availableRoles = Array.isArray(authUser?.userRoles) && authUser.userRoles.length > 0
    ? authUser.userRoles
    : [authUser?.activeRole || authUser?.primaryRole || "Buyer"].filter(Boolean);

  const [form, setForm] = useState({
    fullName: authUser?.fullName || "",
    bio: authUser?.bio || "",
    city: authUser?.city || authUser?.homeBase || authUser?.location || "",
    primaryRole: authUser?.primaryRole || authUser?.travelStyle || "",
    activeRole: authUser?.activeRole || authUser?.primaryRole || authUser?.travelStyle || "",
    profilePic: authUser?.profilePic || "",
    mobileNumber: authUser?.mobileNumber || "",
  });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imageMode, setImageMode] = useState("upload");
  const [localPreview, setLocalPreview] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationDetails, setLocationDetails] = useState(authUser?.locationDetails || null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    if (!profileImageFile) {
      setLocalPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(profileImageFile);
    setLocalPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [profileImageFile]);

  const previewUrl = useMemo(() => {
    if (localPreview) {
      return localPreview;
    }
    return form.profilePic || "";
  }, [form.profilePic, localPreview]);

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: async () => {
      const payload = new FormData();
      payload.append("fullName", form.fullName);
      payload.append("bio", form.bio);
      payload.append("city", form.city);
      payload.append("primaryRole", form.primaryRole);
      payload.append("activeRole", form.activeRole || form.primaryRole);
      payload.append("profilePic", form.profilePic);
      payload.append("mobileNumber", form.mobileNumber);
      if (profileImageFile && imageMode === "upload") {
        payload.append("profileImage", profileImageFile);
      }

      const response = await axiosInstance.patch("/users/profile", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    },
    onSuccess: (response) => {
      const user = response?.data?.user;
      queryClient.setQueryData(["authUser"], (prev) => {
        const prevData = prev?.data?.user || prev?.data || {};
        return {
          status: "success",
          data: {
            user: {
              ...prevData,
              ...user,
            },
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success("Profile updated");
      setProfileImageFile(null);
      setImageMode("upload");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update profile");
    },
  });

  const { mutate: saveLocation, isPending: isSavingLocation } = useMutation({
    mutationFn: async (locationData) => {
      const response = await axiosInstance.patch("/users/location", locationData);
      return response.data;
    },
    onSuccess: (response) => {
      const user = response?.data?.user;
      queryClient.setQueryData(["authUser"], (prev) => {
        const prevData = prev?.data?.user || prev?.data || {};
        return {
          status: "success",
          data: {
            user: {
              ...prevData,
              ...user,
            },
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success("Location updated successfully");
      setShowLocationPicker(false);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update location");
    },
  });

  return (
    <div className="grid gap-3 sm:gap-5 lg:grid-cols-3 pb-6">
      <section className="space-y-3 sm:space-y-5 lg:col-span-2">
        <div className="rounded-3xl border border-base-300 bg-base-100 p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-9 sm:size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-info ring-1 ring-primary/20">
              <Sparkles className="size-4 sm:size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs sm:text-sm font-semibold text-base-content/70">Profile Studio</p>
                {authUser?.isVerified && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <BadgeCheck className="size-3.5 sm:size-4" />
                    <span className="text-[11px] sm:text-xs font-semibold">Verified</span>
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-xl font-extrabold text-base-content break-words">Update your profile</h2>
            </div>
          </div>
        </div>

        {/* Verification Banner - only show if not verified */}
        {!authUser?.isVerified && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
            <div className="flex items-center gap-2.5">
              <div className="shrink-0 rounded-full bg-warning/15 p-1.5">
                <Sparkles className="size-4 text-warning" />
              </div>
              <p className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-warning">Get verified</p>
              <button
                type="button"
                onClick={() => setShowVerification(!showVerification)}
                className="btn btn-xs sm:btn-sm bg-warning text-white hover:bg-warning shrink-0"
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

        <div className="rounded-3xl border border-base-300 bg-base-100 p-4 sm:p-5 shadow-sm">
          <div className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-base-content/70">
            <UserCircle className="size-3.5 sm:size-4 text-primary" />
            Basics
          </div>

          <div className="space-y-3 sm:space-y-4">
            <label className="form-control">
              <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Full name</span>
              <input
                type="text"
                className="input input-sm sm:input-md input-bordered border-base-300 bg-base-200 focus:border-primary/30"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Bio</span>
              <textarea
                className="textarea textarea-bordered min-h-16 sm:min-h-24 text-sm border-base-300 bg-base-200 focus:border-primary/30"
                value={form.bio}
                onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              />
            </label>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs sm:text-sm text-base-content">City</span>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50 z-10" />
                  <input
                    type="text"
                    className="input input-sm sm:input-md input-bordered w-full border-base-300 bg-base-200 focus:border-primary/30"
                    style={{ paddingLeft: "2.5rem" }}
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div>
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Location</span>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(!showLocationPicker)}
                  className="btn btn-xs sm:btn-sm border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                >
                  <MapPin className="size-4" />
                  {locationDetails?.city ? locationDetails.city : "Set precise location"}
                </button>
              </label>

              <label className="form-control sm:col-span-2">
                <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Mobile number</span>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50 z-10" />
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    className="input input-sm sm:input-md input-bordered w-full border-base-300 bg-base-200 focus:border-primary/30"
                    style={{ paddingLeft: "2.5rem" }}
                    value={form.mobileNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                  />
                </div>
              </label>
            </div>

            {locationDetails && !showLocationPicker && (
              <div className="mt-3 p-3 rounded-lg bg-base-200 border border-base-300">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-base-content/60 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-base-content">
                      {locationDetails.city}, {locationDetails.state}
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">{locationDetails.country}</p>
                    {locationDetails.formattedAddress && (
                      <p className="text-xs text-base-content/50 mt-1 line-clamp-2">{locationDetails.formattedAddress}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showLocationPicker && (
              <div className="mt-4 p-4 rounded-xl border border-base-300 bg-base-200">
                <LocationPicker
                  onLocationChange={(data) => {
                    setLocationDetails(data);
                    setForm((prev) => ({ ...prev, city: data.city || prev.city }));
                  }}
                  initialPosition={
                    locationDetails?.latitude && locationDetails?.longitude
                      ? [locationDetails.latitude, locationDetails.longitude]
                      : null
                  }
                />
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (locationDetails) {
                        saveLocation(locationDetails);
                      }
                    }}
                    disabled={isSavingLocation || !locationDetails}
                    className="btn btn-sm bg-primary text-white hover:bg-primary disabled:opacity-50"
                  >
                    {isSavingLocation ? "Saving..." : "Save Location"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(false)}
                    className="btn btn-sm border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <label className="form-control">
              <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Primary role</span>
              <input
                type="text"
                className="input input-sm sm:input-md input-bordered border-base-300 bg-base-200 focus:border-primary/30"
                value={form.primaryRole}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryRole: e.target.value }))}
              />
            </label>

            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Active role (role switcher)</span>
              <select
                className="select select-sm sm:select-md select-bordered border-base-300 bg-base-200 focus:border-primary/30"
                value={form.activeRole}
                onChange={(e) => setForm((prev) => ({ ...prev, activeRole: e.target.value }))}
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-100 p-4 sm:p-5 shadow-sm">
          <div className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-base-content/70">
            <Camera className="size-3.5 sm:size-4 text-secondary" />
            Profile Photo
          </div>

          <div className="mb-3 sm:mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-xs sm:btn-sm ${imageMode === "upload" ? "bg-primary text-white hover:bg-primary" : "border-base-300 bg-base-100 text-base-content hover:bg-base-200"}`}
              onClick={() => setImageMode("upload")}
            >
              <UploadCloud className="size-4" />
              Upload from device
            </button>
            <button
              type="button"
              className={`btn btn-xs sm:btn-sm ${imageMode === "url" ? "bg-primary text-white hover:bg-primary" : "border-base-300 bg-base-100 text-base-content hover:bg-base-200"}`}
              onClick={() => setImageMode("url")}
            >
              <Link2 className="size-4" />
              Use image URL
            </button>
          </div>

          {imageMode === "url" ? (
            <label className="form-control">
              <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Profile image URL</span>
              <input
                type="url"
                className="input input-sm sm:input-md input-bordered border-base-300 bg-base-200 focus:border-primary/30"
                placeholder="https://..."
                value={form.profilePic}
                onChange={(e) => {
                  setProfileImageFile(null);
                  setForm((prev) => ({ ...prev, profilePic: e.target.value }));
                }}
              />
            </label>
          ) : (
            <label className="form-control">
              <span className="label-text mb-1 text-xs sm:text-sm text-base-content">Upload image file</span>
              <input
                type="file"
                className="file-input file-input-sm sm:file-input-md file-input-bordered border-base-300 bg-base-200"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, profilePic: "" }));
                  setProfileImageFile(e.target.files?.[0] || null);
                }}
              />
            </label>
          )}

          <p className="mt-2 text-[11px] sm:text-xs text-base-content/60">
            Upload mode and URL mode are mutually exclusive for clarity.
          </p>
        </div>

        <button
          type="button"
          className="btn w-full rounded-xl bg-primary text-white hover:bg-primary sm:w-auto"
          disabled={isPending}
          onClick={() => saveProfile()}
        >
          {isPending ? "Saving..." : "Save profile"}
        </button>
      </section>

      <aside className="rounded-3xl border border-base-300 bg-base-100 p-4 sm:p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Live preview</p>

        <div className="mt-4 rounded-3xl border border-base-300/80 bg-gradient-to-br from-base-300 to-base-300 p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <img
              src={previewUrl || "https://placehold.co/240x240?text=Profile"}
              alt="Profile preview"
              className="h-24 w-24 sm:h-36 sm:w-36 rounded-3xl object-cover ring-2 ring-base-300"
            />
            <p className="text-base sm:text-lg font-bold text-base-content">{form.fullName || "Your Name"}</p>
            <p className="max-w-xs text-xs sm:text-sm text-base-content/70">{form.bio || "Your bio will appear here."}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-2 text-[11px] sm:text-xs text-base-content/70">
              {form.city ? <span className="badge badge-outline border-base-300 bg-base-100">{form.city}</span> : null}
              {form.primaryRole ? <span className="badge badge-outline border-base-300 bg-base-100">{form.primaryRole}</span> : null}
              {form.activeRole ? <span className="badge badge-primary badge-outline border-primary/30 bg-primary/10 text-primary">Active: {form.activeRole}</span> : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
