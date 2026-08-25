import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Combobox, type ComboboxOption } from "./combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "gno.land/r/one", label: "r/one" },
  { value: "gno.land/r/two", label: "r/two", hint: "Two" },
  { value: "gno.land/r/three", label: "r/three" },
];

function Harness({
  options = OPTIONS,
  onSelect = () => {},
  onKeyDown,
}: {
  options?: ComboboxOption[];
  onSelect?: (option: ComboboxOption) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Combobox
      options={options}
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      onKeyDown={onKeyDown}
      listLabel="Suggestions"
      inputProps={{ "aria-label": "Query" }}
    />
  );
}

function input(): HTMLInputElement {
  return screen.getByRole("combobox") as HTMLInputElement;
}

function activeLabel(): string | null {
  const id = input().getAttribute("aria-activedescendant");
  return id ? (document.getElementById(id)?.textContent ?? null) : null;
}

afterEach(cleanup);

describe("Combobox", () => {
  it("renders its options as real elements, unlike a datalist", () => {
    // The whole reason for the control: a datalist's popup is drawn by the
    // browser outside the page, so its text could not be controlled or
    // asserted (#197).
    render(<Harness />);
    fireEvent.focus(input());

    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("shows the label but commits the value", () => {
    // The elided path is what is displayed; the full one is what the caller
    // receives and what lands in the input.
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.mouseDown(screen.getByText("r/two"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: "gno.land/r/two" }));
    expect(input().value).toBe("gno.land/r/two");
  });

  it("puts the full value in the title, so eliding never hides it", () => {
    render(<Harness />);
    fireEvent.focus(input());

    expect(screen.getByText("r/two").closest("[role=option]")?.getAttribute("title")).toBe(
      "gno.land/r/two — Two"
    );
  });

  it("moves through options with the arrow keys, and wraps", () => {
    render(<Harness />);
    fireEvent.focus(input());

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(activeLabel()).toContain("r/one");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(activeLabel()).toContain("r/two");
    // Wraps rather than stopping, so the list has no dead ends.
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(activeLabel()).toContain("r/three");
  });

  it("takes the highlighted option on Enter", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: "gno.land/r/one" }));
  });

  it("leaves Enter alone when nothing is highlighted, so the form still submits", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());

    const event = fireEvent.keyDown(input(), { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
    // Not prevented: whatever was typed is what the caller submits.
    expect(event).toBe(true);
  });

  it("closes on Escape without swallowing it", () => {
    // The palette closes on Escape, and needing a second press to get out of
    // it reads as the first having been ignored.
    render(<Harness />);
    fireEvent.focus(input());
    expect(input().getAttribute("aria-expanded")).toBe("true");

    const event = fireEvent.keyDown(input(), { key: "Escape" });

    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(event).toBe(true);
  });

  it("hands arrow keys to the caller when there is no list to navigate", () => {
    // Shell recalls history with the arrows; the list only takes them while
    // it is open.
    const onKeyDown = vi.fn();
    render(<Harness options={[]} onKeyDown={onKeyDown} />);
    fireEvent.focus(input());

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });

    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it("keeps arrow keys away from the caller while the list is open", () => {
    const onKeyDown = vi.fn();
    render(<Harness onKeyDown={onKeyDown} />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });

    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("reports itself as collapsed when there is nothing to show", () => {
    // aria-expanded must describe the listbox, not the focus state, or a
    // screen reader announces a popup that is not there.
    render(<Harness options={[]} />);
    fireEvent.focus(input());

    expect(input().getAttribute("aria-expanded")).toBe("false");
  });
});
