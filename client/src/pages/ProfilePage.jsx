import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ClipboardCheck, Link2, MapPin, Sparkles, UploadCloud, UserCircle } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

export default function ProfilePage() {
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
  });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imageMode, setImageMode] = useState("upload");
  const [localPreview, setLocalPreview] = useState("");

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

  return (
    <AppShell
      title="Profile"
      subtitle="Keep your marketplace identity fresh with role, city, and profile details."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          {!authUser?.isOnboarded ? (
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-base-content/70">Finish setting up</p>
                    <h2 className="text-lg font-extrabold">Complete onboarding for better matches</h2>
                    <p className="mt-1 text-sm text-base-content/65">
                      Add your budget, property preferences, and role details to get personalized recommendations.
                    </p>
                  </div>
                </div>
                <Link to="/onboarding" className="btn btn-primary btn-sm shrink-0">
                  Complete onboarding
                </Link>
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/20 ring-1 ring-primary/20">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-base-content/70">Profile Studio</p>
                <h2 className="text-xl font-extrabold">Update your public buyer-seller card</h2>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-content/80">
              <UserCircle className="size-4 text-primary" />
              Basics
            </div>

            <div className="space-y-4">
              <label className="form-control">
                <span className="label-text mb-1">Full name</span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1">Bio</span>
                <textarea
                  className="textarea textarea-bordered min-h-24"
                  value={form.bio}
                  onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1">City</span>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
                    <input
                      type="text"
                      className="input input-bordered w-full pl-9"
                      value={form.city}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Primary role</span>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={form.primaryRole}
                    onChange={(e) => setForm((prev) => ({ ...prev, primaryRole: e.target.value }))}
                  />
                </label>

                <label className="form-control sm:col-span-2">
                  <span className="label-text mb-1">Active role (role switcher)</span>
                  <select
                    className="select select-bordered"
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
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-content/80">
              <Camera className="size-4 text-secondary" />
              Profile Photo
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-sm ${imageMode === "upload" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setImageMode("upload")}
              >
                <UploadCloud className="size-4" />
                Upload from device
              </button>
              <button
                type="button"
                className={`btn btn-sm ${imageMode === "url" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setImageMode("url")}
              >
                <Link2 className="size-4" />
                Use image URL
              </button>
            </div>

            {imageMode === "url" ? (
              <label className="form-control">
                <span className="label-text mb-1">Profile image URL</span>
                <input
                  type="url"
                  className="input input-bordered"
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
                <span className="label-text mb-1">Upload image file</span>
                <input
                  type="file"
                  className="file-input file-input-bordered"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, profilePic: "" }));
                    setProfileImageFile(e.target.files?.[0] || null);
                  }}
                />
              </label>
            )}

            <p className="mt-2 text-xs text-base-content/65">
              Upload mode and URL mode are mutually exclusive for clarity.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            disabled={isPending}
            onClick={() => saveProfile()}
          >
            {isPending ? "Saving..." : "Save profile"}
          </button>
        </section>

        <aside className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Live preview</p>

          <div className="mt-4 rounded-3xl border border-base-300/80 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--p)/0.12),transparent_35%),radial-gradient(circle_at_90%_15%,hsl(var(--s)/0.12),transparent_35%),hsl(var(--b1))] p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <input
                type="hidden"
                value=""
              />
              <img
                src={previewUrl || "https://placehold.co/240x240?text=Profile"}
                alt="Profile preview"
                className="h-36 w-36 rounded-3xl object-cover ring-2 ring-base-300"
              />
              <p className="text-lg font-bold">{form.fullName || "Your Name"}</p>
              <p className="max-w-xs text-sm text-base-content/70">{form.bio || "Your bio will appear here."}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-2 text-xs text-base-content/70">
                {form.city ? <span className="badge badge-outline">{form.city}</span> : null}
                {form.primaryRole ? <span className="badge badge-outline">{form.primaryRole}</span> : null}
                {form.activeRole ? <span className="badge badge-primary badge-outline">Active: {form.activeRole}</span> : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
