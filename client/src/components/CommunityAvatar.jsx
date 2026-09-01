export default function CommunityAvatar({ name, photo, uploading }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-primary to-secondary shadow-lg sm:h-20 sm:w-20 sm:border-4">
      {photo ? (
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-base font-bold text-white sm:text-2xl">{initial}</div>
      )}
      {uploading ? (
        <div className="absolute inset-0 grid place-items-center bg-black/50">
          <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent sm:size-5" />
        </div>
      ) : null}
    </div>
  );
}
