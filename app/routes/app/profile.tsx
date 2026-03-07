import { useNavigate } from "@solidjs/router";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

/** Layout for /app/profile and /app/profile/edit – provides AppShell and auth guard */
export default function ProfileLayout(props: { children?: import("solid-js").JSX.Element }) {
  const nav = useNavigate();
  const myId = () => pb.authStore.model?.id;

  if (!myId()) {
    nav("/login", { replace: true });
    return null;
  }

  return <AppShell>{props.children}</AppShell>;
}
