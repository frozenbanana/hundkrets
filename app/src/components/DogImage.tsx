import { createResource, Show } from "solid-js";
import { fetchBreedImageUrl } from "~/lib/dog-ceo";
import { dogImageSrc } from "~/lib/media";

interface DogImageProps {
  dog: { id?: string; name?: string; breed?: string; image?: string; image_key?: string };
  baseUrl: string;
  class?: string;
  style?: string | Record<string, string>;
}

export function DogImage(props: DogImageProps) {
  const { dog, baseUrl, class: className, style } = props;

  const src = () => dogImageSrc(dog, baseUrl);

  const [placeholderUrl] = createResource(
    () => (src() ? null : dog.breed ?? ""),
    (breed) => (breed !== null ? fetchBreedImageUrl(breed || undefined) : Promise.resolve(null))
  );

  const styleValue = style;

  return (
    <Show
      when={src()}
      fallback={
        <Show
          when={placeholderUrl()}
          fallback={
            <div class="dog-card-img-placeholder" style={styleValue}>
              🐕
            </div>
          }
        >
          <img
            src={placeholderUrl()!}
            alt={dog.name ?? "Hund"}
            class={className ?? "dog-card-img"}
            style={styleValue}
          />
        </Show>
      }
    >
      <img
        src={src()!}
        alt={dog.name ?? "Hund"}
        class={className ?? "dog-card-img"}
        style={styleValue}
      />
    </Show>
  );
}
