import { For, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import type { Conn } from "./types";
import type { DogRecord } from "./types";
import type { ListingItem } from "./helpers";
import { datesOverlap, genderLabel, sizeLabel, temperamentLabel } from "./helpers";

export function MatchDetailModal(props: {
  listing: ListingItem;
  baseUrl: string;
  getConnections: () => Conn[];
  myNeeds?: { start_date?: string; end_date?: string; flexible_dates?: boolean }[];
  myCapacities?: { start_date?: string; end_date?: string; flexible_dates?: boolean }[];
  refreshing: () => boolean;
  onInterestedClick: (userId: string, userName?: string) => void;
  onRespondClick?: (conn: Conn, fromUserName?: string) => void;
  onWithdraw?: (userId: string) => void;
  onUnmatch?: (userId: string) => void;
  onOpenChat?: (userId: string) => void;
  onClose: () => void;
  dateStr: (n: {
    flexible_dates?: boolean;
    open_any_duration?: boolean;
    duration_specific?: string;
    start_date?: string;
    end_date?: string;
  }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
}) {
  const {
    listing,
    baseUrl,
    getConnections,
    myNeeds = [],
    myCapacities = [],
    refreshing,
    onInterestedClick,
    onRespondClick,
    onWithdraw,
    onUnmatch,
    onOpenChat,
    onClose,
    dateStr,
    sizesStr,
  } = props;
  const conns = () => getConnections();
  const connFromThem = () =>
    conns().find((c) => c.from_user === listing.user.id && c.to_user === pb.authStore.model?.id);
  const mutual = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    const c = conns();
    return (
      c.some((x) => x.from_user === me && x.to_user === listing.user.id) &&
      c.some((x) => x.from_user === listing.user.id && x.to_user === me)
    );
  };
  const requested = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    return conns().some((x) => x.from_user === me && x.to_user === listing.user.id);
  };

  const compatibilityCallout = () => {
    let msg: string | null = null;
    for (const theirNeed of listing.needs) {
      const n = theirNeed as { start_date?: string; end_date?: string };
      for (const myCap of myCapacities) {
        if (datesOverlap(n.start_date, n.end_date, myCap.start_date, myCap.end_date)) {
          msg = `Dina datum överlappar med ${listing.user.name || "deras"} behov (${dateStr(theirNeed)}).`;
          break;
        }
      }
      if (msg) break;
    }
    if (!msg) {
      for (const theirCap of listing.capacities) {
        const c = theirCap as { start_date?: string; end_date?: string };
        for (const myNeed of myNeeds) {
          if (datesOverlap(c.start_date, c.end_date, myNeed.start_date, myNeed.end_date)) {
            msg = `Deras tillgänglighet överlappar med dina behov (${dateStr(theirCap)}).`;
            break;
          }
        }
        if (msg) break;
      }
    }
    return msg;
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={handleBackdropClick}
    >
      <div class="modal modal-detail" onClick={(e) => e.stopPropagation()}>
        <div class="modal-detail-header">
          <button type="button" class="match-detail-close" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </div>
        <section class="modal-detail-scroll">
          {connFromThem() && (
            <div class="modal-detail-connection-banner">
              <strong>{listing.user.name || "De"} vill ha kontakt med dig</strong>
              {connFromThem()!.message && (
                <p class="modal-detail-connection-message">"{connFromThem()!.message}"</p>
              )}
            </div>
          )}

          {compatibilityCallout() && (
            <div class="modal-detail-compatibility">
              <span class="modal-detail-compatibility-icon" aria-hidden="true">
                ✓
              </span>
              {compatibilityCallout()}
            </div>
          )}

          <div class="modal-detail-user-card">
            <Avatar
              name={listing.user.name}
              city={listing.user.city}
              neighborhood={listing.user.neighborhood}
              area={listing.user.area}
              id={listing.user.id}
              avatar={listing.user.avatar}
              baseUrl={baseUrl}
              class="modal-detail-avatar"
            />
            <div class="modal-detail-user-info">
              <h2 id="detail-modal-title" class="modal-detail-user-name">
                {listing.user.name || "Okänd"}
              </h2>
              {listing.dogs.length === 0 &&
                listing.needs.length === 0 &&
                listing.capacities.length > 0 && (
                  <p class="modal-detail-user-line" style="color: var(--color-paw); font-weight: 600;">
                    Vill bara passa hundar – har inte egen hund
                  </p>
                )}
              {listing.user.area && (
                <p class="modal-detail-user-line">{listing.user.area}</p>
              )}
              {"distanceKm" in listing && typeof listing.distanceKm === "number" && (
                <p class="modal-detail-user-line">~{Math.round(listing.distanceKm)} km bort</p>
              )}
              {listing.user.bio && (
                <div class="modal-detail-bio">
                  <strong class="modal-detail-bio-label">Om {listing.user.name || "dem"}</strong>
                  <p class="modal-detail-bio-text">{listing.user.bio}</p>
                </div>
              )}
              {listing.user.breeds_owned_before && (
                <p class="modal-detail-user-line">
                  <strong>Erfarenhet:</strong> {listing.user.breeds_owned_before}
                </p>
              )}
              {mutual() && listing.user.phone && (
                <p class="modal-detail-user-line">
                  <strong>Telefon:</strong>{" "}
                  <a href={`tel:${listing.user.phone}`}>{listing.user.phone}</a>
                </p>
              )}
              {mutual() && listing.user.address_private && (
                <p class="modal-detail-user-line">
                  <strong>Adress:</strong> {listing.user.address_private}
                </p>
              )}
            </div>
          </div>

          {listing.needs.length > 0 && (
            <div class="modal-detail-section">
              <strong>Behöver hundpassning</strong>
              <div class="modal-detail-cards">
                <For each={listing.needs}>
                  {(n) => {
                    const dog = listing.dogs.find((d) => d.id === n.dog) as DogRecord | undefined;
                    const d = dog ?? {};
                    const needWithNotes = n as { notes?: string };
                    return (
                      <div class="need-card">
                        <div class="need-card-image">
                          <DogImage dog={d} baseUrl={baseUrl} class="dog-card-img" />
                        </div>
                        <div class="need-card-content">
                          <strong class="need-card-title">{d.name ?? "Hund"}</strong>
                          <div class="need-card-columns">
                            <div class="need-card-col">
                              {d.size && (
                                <p class="need-card-line">
                                  <span class="need-card-label">Storlek:</span>{" "}
                                  {sizeLabel[d.size] ?? d.size}
                                </p>
                              )}
                              {d.breed && (
                                <p class="need-card-line">
                                  <span class="need-card-label">Ras:</span> {d.breed}
                                </p>
                              )}
                              {d.gender && (
                                <p class="need-card-line">
                                  <span class="need-card-label">Kön:</span>{" "}
                                  {genderLabel[d.gender] ?? d.gender}
                                </p>
                              )}
                              {d.age != null && (
                                <p class="need-card-line">
                                  <span class="need-card-label">Ålder:</span> {d.age} år
                                </p>
                              )}
                            </div>
                            <div class="need-card-col">
                              {(d.temperament_new_people ||
                                d.temperament_new_dogs_female ||
                                d.temperament_new_dogs_male) && (
                                <p class="need-card-line">
                                  <span class="need-card-label">Temperament:</span>
                                  <br />
                                  Nya människor:{" "}
                                  {temperamentLabel[d.temperament_new_people ?? ""] ||
                                    d.temperament_new_people ||
                                    "—"}{" "}
                                  · Nya hundar (Hona):{" "}
                                  {temperamentLabel[d.temperament_new_dogs_female ?? ""] ||
                                    d.temperament_new_dogs_female ||
                                    "—"}{" "}
                                  · Nya hundar (Hane):{" "}
                                  {temperamentLabel[d.temperament_new_dogs_male ?? ""] ||
                                    d.temperament_new_dogs_male ||
                                    "—"}
                                </p>
                              )}
                            </div>
                          </div>
                          {d.notes && (
                            <p class="need-card-notes">
                              <span class="need-card-label">Anteckningar:</span> {d.notes}
                            </p>
                          )}
                          {needWithNotes.notes && (
                            <p class="need-card-notes">
                              <span class="need-card-label">Behov:</span> {needWithNotes.notes}
                            </p>
                          )}
                          <div class="need-card-footer">
                            <span class="need-card-label">Datum:</span> {dateStr(n)}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}

          {listing.capacities.length > 0 && (
            <div class="modal-detail-section">
              <strong>Kan passa hundar</strong>
              <div class="modal-detail-cards">
                <For each={listing.capacities}>
                  {(c) => {
                    const capWithNotes = c as { notes?: string };
                    return (
                      <div class="capacity-card">
                        <div class="capacity-card-content">
                          <div class="capacity-card-row">
                            <span class="need-card-label">Datum:</span> {dateStr(c)}
                          </div>
                          <div class="capacity-card-row">
                            <span class="need-card-label">Storlekar:</span> {sizesStr(c.dog_sizes)}
                          </div>
                          <div class="capacity-card-row">
                            <span class="need-card-label">Kön:</span>{" "}
                            {genderLabel[c.dog_genders ?? "any"] ?? c.dog_genders}
                          </div>
                          <div class="capacity-card-row">
                            <span class="need-card-label">Max antal hundar:</span> {c.max_dogs}
                          </div>
                          {capWithNotes.notes && (
                            <p class="need-card-notes">
                              <span class="need-card-label">Anteckningar:</span> {capWithNotes.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </section>
        <div class="modal-detail-footer">
          <Show when={!mutual()}>
            {requested() ? (
              <>
                <span class="btn btn-secondary" style="cursor: default;">
                  Intresse skickat
                </span>
                <button
                  type="button"
                  class="btn btn-secondary"
                  disabled={refreshing()}
                  onClick={() => onWithdraw?.(listing.user.id)}
                >
                  Ångra
                </button>
              </>
            ) : connFromThem() && onRespondClick ? (
              <button
                type="button"
                class="btn"
                disabled={refreshing()}
                onClick={() => onRespondClick(connFromThem()!, listing.user.name)}
              >
                Svara
              </button>
            ) : (
              <button
                type="button"
                class="btn"
                disabled={refreshing()}
                onClick={() => onInterestedClick(listing.user.id, listing.user.name)}
              >
                Jag är intresserad
              </button>
            )}
          </Show>
          <Show when={mutual() && onUnmatch}>
            <Show when={onOpenChat}>
              <button
                type="button"
                class="btn"
                disabled={refreshing()}
                onClick={() => onOpenChat?.(listing.user.id)}
              >
                Öppna chatt
              </button>
            </Show>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={refreshing()}
              onClick={() => {
                if (
                  !confirm("Är du säker? Ni kommer inte längre se varandras kontaktuppgifter.")
                )
                  return;
                onUnmatch?.(listing.user.id);
              }}
            >
              Avmatcha
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
