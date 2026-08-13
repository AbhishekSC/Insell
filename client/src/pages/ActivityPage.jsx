import { useState } from "react";
import AppShell from "../components/AppShell";
import ActivityContent from "../components/ActivityContent";

export default function ActivityPage() {
  const [selectedPostId, setSelectedPostId] = useState(null);

  const handleNavigateToPost = (postId) => {
    setSelectedPostId(postId);
    // Navigate to marketplace with the post selected
    // This would typically use react-router navigation
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
