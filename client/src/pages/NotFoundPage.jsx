import { useNavigate } from "react-router";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100 px-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-8xl font-extrabold tracking-tight text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-base-content">
          Page not found
        </h2>
        <p className="mt-2 text-base-content/60">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate("/marketplace")}
          className="btn btn-primary mt-8 gap-2 rounded-xl"
        >
          <Home className="size-4" />
          Back to Marketplace
        </button>
      </div>
    </div>
  );
}
