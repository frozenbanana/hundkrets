import { Navigate } from "@solidjs/router";
import { pb } from "~/lib/pocketbase";

export default function Profile() {
  const myId = pb.authStore.model?.id ?? "";
  return <Navigate href={myId ? `/users/${myId}?from=app` : "/app"} />;
}
