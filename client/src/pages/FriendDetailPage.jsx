import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { Link, useParams } from "react-router";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import axiosInstance from "../lib/axios";

export default function FriendDetailPage() {
  const { friendId } = useParams();

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
  });

  const friends = friendsData || [];

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend?._id === friendId) || null,
    [friends, friendId]
  );

  if (isLoading) {
    return (
      <AppShell title="Traveler Detail" subtitle="Loading traveler profile..." lockPageScroll>
        <div className="grid min-h-[360px] place-items-center">
          <div className="rounded-2xl border border-base-300/80 bg-base-100/90 px-6 py-5 text-center shadow-sm">
            <Loader2 className="mx-auto size-5 animate-spin text-primary" />
            <p className="mt-2 text-sm text-base-content/70">Loading friend details...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!selectedFriend) {
    return (
      <AppShell title="Traveler Detail" subtitle="This profile is available only for users in your friends list." lockPageScroll>
        <div className="grid min-h-[360px] place-items-center">
          <div className="rounded-2xl border border-base-300/80 bg-base-100/90 px-6 py-6 text-center shadow-sm">
            <p className="text-base font-semibold text-base-content">Friend not found</p>
            <p className="mt-1 text-sm text-base-content/70">Open profiles only from Your Friends cards.</p>
            <Link to="/notification" className="btn btn-sm btn-primary mt-4">
              <ArrowLeft className="size-4" />
              Back to Friends
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Traveler Detail"
      subtitle="Travel profile view for users in your friends list."
      lockPageScroll
      actions={
        <Link to="/notification" className="btn btn-outline btn-sm rounded-full">
          <ArrowLeft className="size-4" />
          Back
        </Link>
      }
    >
      <div className="shell-panel w-full overflow-hidden p-0">
        <div className="h-24 w-full bg-gradient-to-r from-success/20 via-primary/10 to-info/20"></div>

        <div className="-mt-12 px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="rounded-2xl border border-base-300/80 bg-base-100/92 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <UserAvatar
                src={selectedFriend?.profilePic}
                name={selectedFriend?.fullName || "User"}
                sizeClass="size-24"
                roundedClass="rounded-2xl"
                className="ring-2 ring-base-300/80"
              />

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-black tracking-tight text-base-content sm:text-3xl">
                  {selectedFriend?.fullName || "Unknown"}
                </h2>
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-base-content/70">
                  <MapPin className="size-4" />
                  {selectedFriend?.homeBase || selectedFriend?.location || "Home base not set"}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-base-300/80 bg-base-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Travel style</p>
                    <p className="mt-1 text-sm font-medium text-base-content">{selectedFriend?.travelStyle || selectedFriend?.learningLanguage || "Unknown"}</p>
                  </div>
                  <div className="rounded-xl border border-base-300/80 bg-base-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Top interest</p>
                    <p className="mt-1 text-sm font-medium text-base-content">{selectedFriend?.travelInterests?.[0] || selectedFriend?.nativeLanguage || "Unknown"}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-base-300/80 bg-base-100 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Bio</p>
                  <p className="mt-1 text-sm text-base-content/80">
                    {selectedFriend?.bio?.trim() || "No bio shared yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
