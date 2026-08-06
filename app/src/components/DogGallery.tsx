import { createResource, For, Show } from "solid-js";
import { fetchGalleryDogImages } from "~/lib/dog-ceo";

export function DogGallery() {
  const [gallery] = createResource(() => fetchGalleryDogImages(12));

  return (
    <div class="dog-gallery">
      <Show when={!gallery.loading && gallery()}>
        {(g) => (
          <p class="landing-gallery-heading">
            {g().fromCommunity
              ? "Hundar som finns på Hundkrets"
              : "Hundar som snart kan vara i din krets"}
          </p>
        )}
      </Show>
      <Show when={gallery.loading}>
        <div class="dog-gallery-loading">
          <span class="dog-gallery-loading-dot" />
          <span class="dog-gallery-loading-dot" />
          <span class="dog-gallery-loading-dot" />
        </div>
      </Show>
      <Show when={gallery() && gallery()!.urls.length > 0}>
        <div class="dog-gallery-grid">
          <For each={gallery()!.urls}>
            {(url, i) => (
              <div
                class="dog-gallery-item"
                style={{
                  "animation-delay": `${(i() % 6) * 0.15}s`,
                  "animation-duration": `${3 + (i() % 4) * 0.5}s`,
                }}
              >
                <img src={url} alt="" loading="lazy" />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
