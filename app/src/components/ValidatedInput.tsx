import { createSignal, splitProps } from "solid-js";

export type ValidationRule = "required" | "email" | "optional";

function validate(value: string, rule: ValidationRule): boolean {
  const trimmed = value.trim();
  if (rule === "optional") return true;
  if (rule === "required") return trimmed.length > 0;
  if (rule === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return true;
}

interface ValidatedInputProps extends Omit<import("solid-js").JSX.InputHTMLAttributes<HTMLInputElement>, "onBlur"> {
  validation?: ValidationRule;
  onBlur?: (e: FocusEvent) => void;
}

export function ValidatedInput(props: ValidatedInputProps) {
  const [local, rest] = splitProps(props, ["validation", "onBlur", "class", "classList"]);
  const [touched, setTouched] = createSignal(false);
  const [valid, setValid] = createSignal<boolean | null>(null);

  const rule = () => local.validation ?? "optional";

  function handleBlur(e: FocusEvent) {
    const el = e.currentTarget as HTMLInputElement;
    setTouched(true);
    setValid(validate(el.value, rule()));
    local.onBlur?.(e);
  }

  return (
    <input
      {...rest}
      class={local.class}
      classList={{
        ...(typeof local.classList === "object" && local.classList ? local.classList : {}),
        "input-valid": touched() && valid() === true,
        "input-invalid": touched() && valid() === false,
      }}
      onBlur={handleBlur}
    />
  );
}
