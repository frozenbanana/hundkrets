import { For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import { ExchangeHandsIcon, HandLeftIcon, HandRightIcon } from "./ExchangeTypeIcon";
import type { Conn } from "./types";
import type { ListingItem } from "./helpers";
import { canPassStr, getFirstDog, getExchangeType, isPassOnly } from "./helpers";

export function MatchCard(props: {
  listing: ListingItem;
  baseUrl: string;
  getConnections: () => Conn[];
  dateStr: (n: {
    flexible_dates?: boolean;
    open_any_duration?: boolean;
    duration_specific?: string;
    start_date?: string;
    end_date?: string;
  }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
  onOpenDetail: (userId: string) => void;
}) {
  const { listing, baseUrl, getConnections, dateStr, sizesStr, onOpenDetail } = props;
  const conns = () => getConnections();
  const me = () => pb.authStore.model?.id;
  const mutual = () => {
    const m = me();
    if (!m) return false;
    const c = conns();
    return (
      c.some((x) => x.from_user === m && x.to_user === listing.user.id) &&
      c.some((x) => x.from_user === listing.user.id && x.to_user === m)
    );
  };
  const requestedMe = () => {
    const m = me();
    if (!m) return false;
    return conns().some((x) => x.from_user === listing.user.id && x.to_user === m);
  };
  const requestedOutgoing = () => {
    const m = me();
    if (!m) return false;
    return conns().some((x) => x.from_user === m && x.to_user === listing.user.id);
  };
  const firstDog = () => getFirstDog(listing);
  const passOnly = () => isPassOnly(listing);
  const exchangeType = () => getExchangeType(listing);
  const firstNeed = () => listing.needs[0];
  const firstCapacity = () => listing.capacities[0];
  const needDatesStr = () => (firstNeed() ? dateStr(firstNeed()!) : null);
  const capacityDatesStr = () => (firstCapacity() ? dateStr(firstCapacity()!) : null);
  const canPass = () => (firstCapacity() ? canPassStr(firstCapacity()!.dog_sizes) : null);

  const locationStr = () => {
    const loc = listing.user.neighborhood || listing.user.city || listing.user.area;
    const dist =
      "distanceKm" in listing && typeof listing.distanceKm === "number"
        ? `~${Math.round(listing.distanceKm)} km`
        : null;
    if (loc && dist) return `${loc} · ${dist}`;
    if (loc) return loc;
    if (dist) return dist;
    return null;
  };

  const extraNeedsHint = () => (listing.needs.length > 1 ? `+${listing.needs.length - 1}` : null);
  const extraCapacitiesHint = () =>
    listing.capacities.length > 1 ? `+${listing.capacities.length - 1}` : null;

  return (
    <div
      class="card match-card match-card-compact"
      classList={{
        "match-card-pass-only-layout": passOnly(),
        "match-card-receive-only": exchangeType() === "receive",
      }}
      data-listing-id={listing.user.id}
      onClick={() => onOpenDetail(listing.user.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpenDetail(listing.user.id)}
    >
      {mutual() && <span class="match-card-badge">matchad</span>}
      {!mutual() && requestedMe() && (
        <span class="match-card-badge match-card-badge-request">Vill ha kontakt</span>
      )}
      {!mutual() && requestedOutgoing() && (
        <span class="match-card-badge match-card-badge-outgoing">Intresse skickat</span>
      )}
      <Show when={exchangeType()}>
        {(type) => (
          <div
            class="match-card-exchange-badge"
            classList={{
              "match-card-exchange-receive": type() === "receive",
              "match-card-exchange-give": type() === "give",
              "match-card-exchange-mutual": type() === "mutual",
            }}
          >
            {type() === "receive" && (
              <>
                <HandLeftIcon class="match-card-exchange-icon" aria-hidden={true} />
                <span>Söker passning</span>
              </>
            )}
            {type() === "give" && (
              <>
                <HandRightIcon class="match-card-exchange-icon" aria-hidden={true} />
                <span>Vill endast passa</span>
              </>
            )}
            {type() === "mutual" && (
              <>
                <ExchangeHandsIcon class="match-card-exchange-icon" aria-hidden={true} />
                <span>Utbyte</span>
              </>
            )}
          </div>
        )}
      </Show>
      <div class="match-card-body">
        <div class="match-card-info">
          <div class="match-card-header">
            <Avatar
              name={listing.user.name}
              city={listing.user.city}
              neighborhood={listing.user.neighborhood}
              area={listing.user.area}
              id={listing.user.id}
              avatar={listing.user.avatar}
              baseUrl={baseUrl}
              class="match-card-avatar"
            />
            <span class="match-card-username">{listing.user.name || "Okänd"}</span>
          </div>
          <div class="match-card-info-text">
            <div class="match-card-need-section">
              <Show
                when={!passOnly()}
                fallback={
                  <p class="match-card-main match-card-pass-only-text">Erbjuder passning</p>
                }
              >
                <p class="match-card-main">
                  Behöver passning av{" "}
                  <span class="match-card-dog-name">{firstDog()?.name ?? "hund"}</span>
                  {extraNeedsHint() && (
                    <span class="match-card-hint"> {extraNeedsHint()}</span>
                  )}
                </p>
              </Show>
              {!passOnly() && needDatesStr() && (
                <div class="match-card-row">
                  <span class="match-card-pill">Behöver</span>
                  <span class="match-card-value">{needDatesStr()}</span>
                </div>
              )}
            </div>
            {(canPass() || (passOnly() && capacityDatesStr())) && (
              <div class="match-card-capacity-section">
                {(passOnly() || canPass()) && capacityDatesStr() && (
                  <div class="match-card-row">
                    <span class="match-card-pill">Tillgänglig</span>
                    <span class="match-card-value">{capacityDatesStr()}</span>
                  </div>
                )}
                {canPass() && (
                  <div class="match-card-row">
                    <span class="match-card-pill">Storlekar</span>
                    <span class="match-card-value">{canPass()}</span>
                    {extraCapacitiesHint() && (
                      <span class="match-card-hint">{extraCapacitiesHint()}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {locationStr() && (
            <div class="match-card-footer">
              <span class="match-card-pill">Plats</span>
              <span class="match-card-value">{locationStr()}</span>
            </div>
          )}
        </div>
        <div class="match-card-image">
          <Show
            when={!passOnly() && firstDog()}
            fallback={
              <Avatar
                name={listing.user.name}
                city={listing.user.city}
                neighborhood={listing.user.neighborhood}
                area={listing.user.area}
                id={listing.user.id}
                avatar={listing.user.avatar}
                baseUrl={baseUrl}
                class="match-card-img"
              />
            }
          >
            {(dog) => (
              <DogImage dog={dog()} baseUrl={baseUrl} class="match-card-img" />
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

export function MatchCards(props: {
  listings: ListingItem[];
  baseUrl: string;
  getConnections: () => Conn[];
  dateStr: (n: {
    flexible_dates?: boolean;
    open_any_duration?: boolean;
    duration_specific?: string;
    start_date?: string;
    end_date?: string;
  }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
  onOpenDetail: (userId: string) => void;
}) {
  return (
    <div class="match-cards-list">
      <For each={props.listings}>
        {(listing) => (
          <MatchCard
            listing={listing}
            baseUrl={props.baseUrl}
            getConnections={props.getConnections}
            dateStr={props.dateStr}
            sizesStr={props.sizesStr}
            onOpenDetail={props.onOpenDetail}
          />
        )}
      </For>
    </div>
  );
}
