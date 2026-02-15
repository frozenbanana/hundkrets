import { A, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";

export default function Home() {
  const nav = useNavigate();

  onMount(() => {
    if (pb.authStore.isValid) {
      nav("/app", { replace: true });
    }
  });

  return (
    <div class="container">
      <h1>Dog Watch Match</h1>
      <p>Find dog owners who'll watch your dog when you travel—and you watch theirs. No money, mutual help.</p>
      <p>
        <A href="/login">Log in</A> or <A href="/register">Register</A>
      </p>
    </div>
  );
}
