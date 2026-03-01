interface AvatarProps {
  name?: string;
  city?: string;
  neighborhood?: string;
  area?: string;
  /** User id for PocketBase avatar URL */
  id?: string;
  /** Avatar filename from PocketBase */
  avatar?: string;
  /** Override src (e.g. blob URL for new file preview) – takes precedence over avatar */
  src?: string;
  baseUrl?: string;
  size?: "sm" | "md";
  class?: string;
  /** When set, shows a verification badge (green checkmark when true, gray when false) in bottom right */
  verified?: boolean;
}

export function Avatar(props: AvatarProps) {
  const nameForInitials =
    props.name?.trim() || [props.city, props.neighborhood, props.area].filter(Boolean).join(" ") || "User";
  const size = props.size === "sm" ? 48 : 80;
  const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForInitials)}&size=${size}&background=d4a574&color=ffffff`;

  const src =
    props.src ??
    (props.avatar && props.id && props.baseUrl
      ? `${props.baseUrl}/api/files/users/${props.id}/${props.avatar}`
      : placeholderUrl);

  const showBadge = props.verified !== undefined;

  return (
    <div class="avatar-wrapper">
      <img
        src={src}
        alt={props.name || "Avatar"}
        class={`avatar ${props.size === "sm" ? "avatar-sm" : ""} ${props.class ?? ""}`}
      />
      {showBadge && (
        <span
          class={`avatar-verified-badge avatar-verified-badge-${props.verified ? "verified" : "unverified"}`}
          aria-label={props.verified ? "Verifierad" : "Ej verifierad"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="2,5 4,7 8,3" />
          </svg>
        </span>
      )}
    </div>
  );
}
