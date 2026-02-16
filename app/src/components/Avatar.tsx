interface AvatarProps {
  name?: string;
  city?: string;
  neighborhood?: string;
  area?: string;
  /** User id for PocketBase avatar URL */
  id?: string;
  /** Avatar filename from PocketBase */
  avatar?: string;
  baseUrl?: string;
  size?: "sm" | "md";
  class?: string;
}

export function Avatar(props: AvatarProps) {
  const nameForInitials =
    props.name?.trim() || [props.city, props.neighborhood, props.area].filter(Boolean).join(" ") || "User";
  const size = props.size === "sm" ? 48 : 80;
  const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForInitials)}&size=${size}&background=d4a574&color=ffffff`;

  const src =
    props.avatar && props.id && props.baseUrl
      ? `${props.baseUrl}/api/files/users/${props.id}/${props.avatar}`
      : placeholderUrl;

  return (
    <img
      src={src}
      alt={props.name || "Avatar"}
      class={`avatar ${props.size === "sm" ? "avatar-sm" : ""} ${props.class ?? ""}`}
    />
  );
}
