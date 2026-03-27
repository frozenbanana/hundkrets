import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";

export default function UtflykterRedirect() {
  const nav = useNavigate();
  onMount(() => {
    nav("/app/excursions", { replace: true });
  });
  return null;
}
