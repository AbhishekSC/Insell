import AppShell from "../components/AppShell";
import ActivityContent from "../components/ActivityContent";

export default function ActivityPage() {
  const handleNavigateToPost = (postId) => {
    window.location.href = `/marketplace?post=${postId}`;
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
