import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import DiscoverCommunityCard from "../components/DiscoverCommunityCard";
import axiosInstance from "../lib/axios";

export default function DiscoverCommunitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // This page only exists as a mobile workaround — the desktop Communities
  // tab already has Discover Communities inline (the sm:hidden button that
  // links here doesn't even render past that breakpoint). Reachable
  // directly by URL, it'd otherwise become a second, inconsistent flow for
  // the same thing on desktop, so bounce back to the tab it belongs to.
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 640px)");
    if (desktopQuery.matches) {
      navigate("/marketplace?section=communities", { replace: true });
      return;
    }

    const handleChange = (event) => {
      if (event.matches) {
        navigate("/marketplace?section=communities", { replace: true });
      }
    };
    desktopQuery.addEventListener("change", handleChange);
    return () => desktopQuery.removeEventListener("change", handleChange);
  }, [navigate]);

  const { data: communitiesData, isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const res = await axiosInstance.get("/community");
      return res.data?.data || { studyCircles: [], suggestedCircles: [] };
    },
    refetchInterval: 30000,
  });

  const suggestedCommunities = communitiesData?.suggestedCircles || [];

  const joinCommunityMutation = useMutation({
    mutationFn: async (circleId) => {
      const res = await axiosInstance.post(`/community/circles/${circleId}/join-request`);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Join request sent! Waiting for admin approval.");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send join request");
    },
  });

  const filteredSuggested = suggestedCommunities.filter((community) =>
    community.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    community.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell hideHero title="Discover Communities" subtitle="Find and join communities that match your interests">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" size={20} />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-base-300 pl-10 pr-4 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-base-200" />
            ))}
          </div>
        ) : filteredSuggested.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-300 py-16">
            <Users className="mb-3 text-base-content/50" size={48} />
            <p className="text-base-content/60">
              {suggestedCommunities.length === 0 ? "No communities to discover right now" : "No communities match your search"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredSuggested.map((community) => (
              <DiscoverCommunityCard
                key={community._id}
                community={community}
                onJoin={(circleId) => joinCommunityMutation.mutate(circleId)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
