import { useNavigate } from "react-router";
import AppShell from "../components/AppShell";
import ActivityContent from "../components/ActivityContent";

export default function ActivityPage() {
  const navigate = useNavigate();
  const handleNavigateToPost = (postId) => {
    navigate(`/property/${postId}`);
  };

  return (
    <AppShell
      title="Activity"
      subtitle="Your recent activity and interactions"
    >
      <ActivityContent onNavigateToPost={handleNavigateToPost} />
    </AppShell>
  );
}
