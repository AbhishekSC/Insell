import logoMobile from "../assets/brand/logo-mobile.png";

// Full-screen branded loading state — used while the app boots (auth
// verification) and anywhere a whole-page wait is nicer than a bare
// spinner. Mirrors the pre-React splash in index.html so the handoff
// between them is seamless.
export default function BrandLoader({ label }) {
  return (
    <div className="grid min-h-screen place-items-center bg-base-200">
      <div className="flex flex-col items-center gap-5">
        <img
          src={logoMobile}
          alt="NearMySpace"
          className="w-28 animate-[brand-breathe_2.4s_ease-in-out_infinite]"
        />
        <div className="h-[3px] w-24 overflow-hidden rounded-full bg-base-content/10">
          <div className="h-full w-2/5 rounded-full bg-primary animate-[brand-slide_1.15s_ease-in-out_infinite]" />
        </div>
        {label && <p className="text-sm text-base-content/60">{label}</p>}
      </div>
    </div>
  );
}
