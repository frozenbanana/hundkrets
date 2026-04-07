import { A } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import {
  explainOnboardingListingMatch,
  findListings,
  rankOnboardingTopListings,
  type Dog,
  type ListingWithDistance,
  type WatchCapacity,
  type WatchNeed,
} from "~/lib/matching";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";
import { formatDogInfo } from "~/components/DogInfo";
import { InterestModal } from "../../routes/app/explore/InterestModal";
import { isUserVerified } from "~/lib/auth";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

type UserRow = {
  id: string;
  name?: string;
  city?: string;
  neighborhood?: string;
  area?: string;
  avatar?: string;
  verified?: boolean;
  latitude?: number;
  longitude?: number;
  last_login_at?: string;
};

type RecommendedRow = {
  listing: ListingWithDistance;
  lines: string[];
  alreadyInterested: boolean;
};

function dogSummaryLine(dogs: Dog[]): string | null {
  const d = dogs[0];
  if (!d?.name) return null;
  const summary = formatDogInfo({
    name: d.name,
    age: typeof d.age === "number" ? d.age : undefined,
    breed: d.breed,
    gender: d.gender,
    showSize: !d.breed && Boolean(d.size),
    size: d.size,
  });
  return summary ? `Hund: ${summary}` : null;
}

const rowBox =
  "display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.75rem 1rem; padding: 0.85rem 1rem; border-radius: var(--radius); border: 1px solid var(--color-border); background: rgba(255,255,255,0.55); box-shadow: var(--shadow-paw);";

export function RecommendedMembersSection(props: {
  profileFrom: "onboarding" | "chats";
  showNeedsCapacityHint?: boolean;
  showFooterActions?: boolean;
}) {
  const [interestModalTarget, setInterestModalTarget] = createSignal<
    { userId: string; userName?: string } | undefined
  >();
  const [interestModalMessage, setInterestModalMessage] = createSignal("");
  const [interestSubmitting, setInterestSubmitting] = createSignal(false);

  const [data, { refetch }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return null;
      const [needs, capacities, users, dogs, outgoing] = await Promise.all([
        pb.collection("watch_needs").getFullList(),
        pb.collection("watch_capacity").getFullList(),
        pb.collection("users").getFullList(),
        pb.collection("dogs").getFullList(),
        pb.collection("connection_requests").getFullList({ filter: `from_user = "${userId}"` }),
      ]);
      const allNeeds = needs as WatchNeed[];
      const allCapacities = capacities as WatchCapacity[];
      const allUsers = users as UserRow[];
      const myNeeds = allNeeds.filter((n) => n.user === userId);
      const myCapacities = allCapacities.filter((c) => c.user === userId);
      const listings = findListings(allNeeds, allCapacities, userId, allUsers, dogs as Dog[], 100);
      const topListings = rankOnboardingTopListings(listings, myNeeds, myCapacities).slice(0, 3);
      const outgoingTo = new Set(
        (outgoing as { to_user?: string }[]).map((r) => r.to_user).filter(Boolean) as string[]
      );
      const top: RecommendedRow[] = topListings.map((listing) => {
        const { lines } = explainOnboardingListingMatch(listing, myNeeds, myCapacities);
        return {
          listing,
          lines,
          alreadyInterested: outgoingTo.has(listing.user.id),
        };
      });
      return { top, myNeedsCount: myNeeds.length, myCapacitiesCount: myCapacities.length };
    }
  );

  const canShowRecommendations = createMemo(() => {
    const d = data();
    if (!d) return false;
    return d.myNeedsCount > 0 || d.myCapacitiesCount > 0;
  });

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  function openInterestModal(userId: string, userName?: string) {
    setInterestModalTarget({ userId, userName });
    setInterestModalMessage("");
  }

  function closeInterestModal() {
    setInterestModalTarget(undefined);
    setInterestModalMessage("");
  }

  async function submitInterestModal() {
    const target = interestModalTarget();
    if (!target) return;
    const fromUserId = pb.authStore.model?.id;
    if (!fromUserId) return;
    setInterestSubmitting(true);
    try {
      await pb.collection("connection_requests").create({
        from_user: fromUserId,
        to_user: target.userId,
        ...(interestModalMessage().trim() && { message: interestModalMessage().trim() }),
      });
      showToast("Intresse skickat");
      closeInterestModal();
      void refetch();
    } catch (e) {
      console.error("[RecommendedMembersSection] connection_requests create", e);
      showToast(parseApiError(e), "error");
    } finally {
      setInterestSubmitting(false);
    }
  }

  return (
    <>
      <Show
        when={props.showNeedsCapacityHint}
        fallback={
          <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
            Baserat på din onboarding har vi valt ut tre profiler som kan passa dig.
          </p>
        }
      >
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          Baserad på dina{" "}
          <A href="/app/needs" style="text-decoration: underline;">
            behov
          </A>{" "}
          och{" "}
          <A href="/app/capacity" style="text-decoration: underline;">
            tillgänglighet
          </A>{" "}
          har vi valt ut tre profiler som kan passa dig.
        </p>
      </Show>

      <Show when={data.loading}>
        <p>Laddar rekommendationer...</p>
      </Show>

      <Show when={!data.loading && !canShowRecommendations()}>
        <p style="margin-bottom: 1rem;">
          Lägg till behov eller kapacitet för att få personliga rekommendationer.
        </p>
        <A class="btn" href="/app/explore">
          Gå till Utforska
        </A>
      </Show>

      <Show when={!data.loading && canShowRecommendations() && (data()?.top.length ?? 0) === 0}>
        <p style="margin-bottom: 1rem;">
          Vi hittade inga tydliga matchningar just nu. Du kan fortfarande hitta fler i Utforska.
        </p>
        <A class="btn" href="/app/explore">
          Gå till Utforska
        </A>
      </Show>

      <Show when={!data.loading && (data()?.top.length ?? 0) > 0}>
        <div style="display: grid; gap: 0.75rem;">
          <For each={data()?.top ?? []}>
            {(row) => {
              const listing = row.listing;
              const location = listing.user.neighborhood || listing.user.city || listing.user.area || "Okänt område";
              const distance = typeof listing.distanceKm === "number" ? `~${Math.round(listing.distanceKm)} km` : null;
              const profileHref =
                props.profileFrom === "chats"
                  ? `/users/${listing.user.id}?from=chat`
                  : `/users/${listing.user.id}?from=${props.profileFrom}`;
              const dogLine = dogSummaryLine(listing.dogs);
              const displayName = listing.user.name || "Okänd användare";
              return (
                <div style={rowBox}>
                  <div class="recommended-member-row__body">
                    <A
                      href={profileHref}
                      class="recommended-member-profile-avatar-link"
                      aria-label={`Öppna profil för ${displayName}`}
                    >
                      <Avatar
                        name={listing.user.name}
                        city={listing.user.city}
                        neighborhood={listing.user.neighborhood}
                        area={listing.user.area}
                        id={listing.user.id}
                        avatar={listing.user.avatar}
                        baseUrl={baseUrl}
                        size="sm"
                        verified={(listing.user as { verified?: boolean }).verified}
                      />
                    </A>
                    <A href={profileHref} class="recommended-member-profile-name-link">
                      <span class="recommended-member-profile-name">{displayName}</span>
                    </A>
                    <div class="recommended-member-row__meta">
                      <div style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 0.25rem;">
                        {location}
                        {distance ? ` · ${distance}` : ""}
                      </div>
                      <For each={row.lines}>
                        {(line) => (
                          <div style="font-size: 0.88rem; color: var(--color-text); line-height: 1.45; margin-top: 0.2rem;">
                            {line}
                          </div>
                        )}
                      </For>
                      <Show when={dogLine}>
                        {(text) => (
                          <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.35rem;">
                            {text()}
                          </div>
                        )}
                      </Show>
                    </div>
                  </div>
                  <div class="recommended-member-row__actions">
                    <Show
                      when={row.alreadyInterested}
                      fallback={
                        <button
                          type="button"
                          class="btn"
                          disabled={!isUserVerified()}
                          title={
                            !isUserVerified()
                              ? "Verifiera din e-post för att skicka intresseanmälningar."
                              : undefined
                          }
                          onClick={() => openInterestModal(listing.user.id, listing.user.name)}
                        >
                          Skicka intresse
                        </button>
                      }
                    >
                      <span
                        class="btn btn-secondary"
                        style="text-align: center; opacity: 0.92; cursor: default; pointer-events: none;"
                        aria-disabled="true"
                      >
                        Intresse skickat
                      </span>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
        <Show when={props.showFooterActions !== false}>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <A class="btn" href="/app/explore">
              Se fler i Utforska
            </A>
            <A class="btn btn-secondary" href="/app/chats">
              Gå till chattar
            </A>
          </div>
        </Show>
      </Show>

      <Show when={interestModalTarget()}>
        {(target) => (
          <InterestModal
            target={target()}
            message={interestModalMessage()}
            onMessageChange={setInterestModalMessage}
            onClose={closeInterestModal}
            onSubmit={() => void submitInterestModal()}
            loading={interestSubmitting()}
            isVerified={isUserVerified()}
          />
        )}
      </Show>
    </>
  );
}
