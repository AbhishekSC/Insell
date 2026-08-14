import { useNavigate } from "react-router";
import EmailVerification from "../components/EmailVerification";

export default function VerifyEmailPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen app-ambient">
      <EmailVerification
        dismissible={false}
        onClose={() => navigate("/marketplace", { replace: true })}
      />
    </div>
  );
}
