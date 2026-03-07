import { Navigate } from "@solidjs/router";

/** Redirect to profile settings section */
export default function Settings() {
  return <Navigate href="/app/profile#inställningar" replace />;
}
