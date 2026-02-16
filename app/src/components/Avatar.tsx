interface AvatarProps {
  name?: string;
  city?: string;
  neighborhood?: string;
  size?: "sm" | "md";
  class?: string;
}

export function Avatar(props: AvatarProps) {
  const seed = [props.name, props.city, props.neighborhood].filter(Boolean).join(" ") || "User";
  const size = props.size === "sm" ? 48 : 80;
  const url = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=d4a574,8b5a2b&textColor=ffffff`;

  return (
    <img
      src={url}
      alt={props.name || "Avatar"}
      class={`avatar ${props.size === "sm" ? "avatar-sm" : ""} ${props.class ?? ""}`}
    />
  );
}
