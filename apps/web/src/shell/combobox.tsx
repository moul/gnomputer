import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
} from "react";

export interface ComboboxOption {
  /** What lands in the input when this option is taken. */
  value: string;
  /** What is shown. Defaults to `value`; set it to display something shorter
   * or friendlier than what gets committed. */
  label?: string;
  /** Secondary text, shown after the label and used as the option's title.
   * For an elided label, this is where the full thing goes. */
  hint?: string;
}

/**
 * An ARIA combobox: a text input with a listbox of suggestions.
 *
 * Replaces `<datalist>`, which the app used in four places. A datalist's popup
 * is drawn by the browser, outside the page: the rendered text cannot be
 * controlled, the popup cannot be inspected, and it does not appear in a
 * screenshot — so a long realm path was cut off at the right edge, hiding the
 * part that identifies it, with no way to fix or even verify a fix (#197).
 * Here the options are real DOM, so they can be elided, styled, and asserted.
 *
 * The input is rendered as a plain `<input>` inside a wrapper, so callers keep
 * whatever selectors and form behaviour they already had.
 */
export function Combobox({
  options,
  value,
  onChange,
  onSelect,
  onKeyDown,
  listLabel,
  className,
  inputRef,
  inputProps,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** An option was taken, by Enter or by click. */
  onSelect: (option: ComboboxOption) => void;
  /** Keys the caller wants, delivered only when the listbox is closed — so
   * Shell's history recall on Arrow keys does not fight option navigation. */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  listLabel: string;
  className?: string;
  /** The input element itself, for callers that focus it — Shell focuses on a
   * click anywhere in its window. */
  inputRef?: Ref<HTMLInputElement>;
  /** Spread onto the input. `data-*` is allowed explicitly: callers pass the
   * password-manager opt-outs (`data-1p-ignore` and friends) that React types
   * do not know about, and the realm bar passes `data-status` for styling. */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onKeyDown"> &
    Record<`data-${string}`, string | undefined>;
}) {
  const id = useId();
  const listId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement | null>(null);

  const expanded = open && options.length > 0;
  const activeOption = expanded && activeIndex >= 0 ? options[activeIndex] : undefined;

  // A shrinking list can leave the active index past the end — pointing at
  // nothing, so Enter would do nothing while an option still looked chosen.
  useEffect(() => {
    setActiveIndex((current) => (current >= options.length ? options.length - 1 : current));
  }, [options.length]);

  // Keeps the active option in view when arrowing past the visible edge.
  // Optional call: scrollIntoView is absent in jsdom, and a missing nicety
  // should not throw out of a keypress handler.
  useEffect(() => {
    if (!expanded || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [expanded, activeIndex]);

  function take(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(option);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const forward = event.key === "ArrowDown";
      if (!expanded) {
        // Nothing to navigate. ArrowDown opens the list if there is one;
        // otherwise the caller gets the key (Shell recalls history with it).
        if (forward && options.length > 0) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex(0);
          return;
        }
        onKeyDown?.(event);
        return;
      }
      event.preventDefault();
      setActiveIndex((current) => {
        const next = current + (forward ? 1 : -1);
        // Wraps, so the list has no dead ends — same rule as the realm tabstrip.
        return (next + options.length) % options.length;
      });
      return;
    }

    if (event.key === "Enter" && activeOption) {
      // Only when an option is genuinely highlighted: otherwise Enter must
      // still submit the form with whatever was typed.
      event.preventDefault();
      take(activeOption);
      return;
    }

    if (event.key === "Escape") {
      // Closes the list but deliberately lets the key carry on. The ARIA
      // pattern would swallow it and make a second press close whatever is
      // behind — but the control this matters most for is inside the command
      // palette, where Escape means "get me out of here" and needing it twice
      // reads as the first one having been ignored.
      setOpen(false);
      setActiveIndex(-1);
    }

    onKeyDown?.(event);
  }

  return (
    <div className={className ? `combobox ${className}` : "combobox"}>
      <input
        {...inputProps}
        ref={inputRef}
        type={inputProps?.type ?? "text"}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(event) => {
          setOpen(true);
          inputProps?.onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          setActiveIndex(-1);
          inputProps?.onBlur?.(event);
        }}
        onKeyDown={handleKeyDown}
      />
      {/* Always rendered so `aria-controls` points at something real, which
          axe requires; emptied rather than removed when there is nothing to
          show. */}
      <ul
        className="combobox__list"
        id={listId}
        role="listbox"
        aria-label={listLabel}
        data-open={expanded}
        ref={listRef}
      >
        {expanded &&
          options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-active={index === activeIndex}
              // Always leads with the value, never only the hint: when the
              // label is elided, the full value is exactly what the reader
              // came to the tooltip for.
              title={option.hint ? `${option.value} — ${option.hint}` : option.value}
              // mousedown, not click: blur would fire first and close the list
              // out from under the pointer, so the click would land on nothing.
              onMouseDown={(event) => {
                event.preventDefault();
                take(option);
              }}
            >
              <span className="combobox__label">{option.label ?? option.value}</span>
              {option.hint && <span className="combobox__hint">{option.hint}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}
