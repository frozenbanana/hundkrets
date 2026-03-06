import { Navigate } from "@solidjs/router";

export default function AppIndex() {
  return <Navigate href="/app/explore" replace />;
}
