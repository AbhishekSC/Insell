import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import RequestedCommunityCard from "../components/RequestedCommunityCard";
import axiosInstance from "../lib/axios";

export default function RequestedCommunitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Same reasoning as DiscoverCommunitiesPage — this only exists as a
  // mobile workaround for the inline row on the Communities tab; on desktop
  // that row already works fine, so bounce back to avoid a second flow.
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
      return res.data?.data || { requestedCircles: [] };
    },
    refetchInterval: 30000,
  });

  const requestedCommunities = communitiesData?.requestedCircles || [];

  const cancelJoinRequestMutation = useMutation({
    mutationFn: async (circleId) => {
      const res = await axiosInstance.delete(`/community/circles/${circleId}/join-request`);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Join request cancelled");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to cancel join request");
    },
  });

  return (
    <AppShell hideHero title="Requested" subtitle="Communities you've asked to join, awaiting admin approval">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : requestedCommunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
            <Clock className="mb-3 text-slate-400" size={48} />
            <p className="text-slate-500">No pending join requests right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {requestedCommunities.map((community) => (
              <RequestedCommunityCard
                key={community._id}
                community={community}
                onCancel={() => cancelJoinRequestMutation.mutate(community._id)}
                isCancelling={cancelJoinRequestMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
