import { useLayoutEffect, useRef, useState } from "react";

export interface LensTabBarItem {
  key: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** An external link (e.g. "Open on gnoweb") instead of a same-window tab. */
  href?: string;
}

/** A tab/action bar that collapses overflowing trailing items into a
 * "•••" dropdown once they no longer fit, instead of wrapping or spilling
 * out of the window — a realm window can get quite narrow, and this bar
 * holds every lens plus the gnoweb link (realm-browser.tsx). Widths are
 * measured via an invisible copy of every item (real widths aren't known
 * until something has actually rendered), then re-measured on resize. */
export function LensTabBar({ items, ariaLabel }: { items: LensTabBarItem[]; ariaLabel: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function recompute() {
      const containerWidth = container!.clientWidth;
      const moreWidth = moreButtonRef.current?.offsetWidth ?? 28;
      let used = 0;
      let count = 0;
      for (const item of items) {
        const width = itemRefs.current.get(item.key)?.offsetWidth ?? 0;
        const isLast = count === items.length - 1;
        const budget = isLast ? containerWidth : containerWidth - moreWidth;
        if (used + width > budget) break;
        used += width;
        count++;
      }
      setVisibleCount(count);
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [items]);

  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return (
    <div className="lens-tab-bar" role="tablist" aria-label={ariaLabel} ref={containerRef}>
      <div className="lens-tab-bar__measure" aria-hidden="true">
        {items.map((item) => (
          <span
            key={item.key}
            ref={(el) => {
              if (el) itemRefs.current.set(item.key, el);
            }}
            className="lens-tab-bar__item"
          >
            {item.label}
          </span>
        ))}
      </div>
      {visible.map((item) => (
        <LensTabBarButton key={item.key} item={item} />
      ))}
      {overflow.length > 0 && (
        <div className="lens-tab-bar__overflow">
          <button
            type="button"
            ref={moreButtonRef}
            className="lens-tab-bar__item lens-tab-bar__more"
            aria-label="More tabs"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            •••
          </button>
          {menuOpen && (
            <div className="lens-tab-bar__menu" role="menu">
              {overflow.map((item) => (
                <LensTabBarButton key={item.key} item={item} onAfterClick={() => setMenuOpen(false)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LensTabBarButton({ item, onAfterClick }: { item: LensTabBarItem; onAfterClick?: () => void }) {
  if (item.href) {
    return (
      <a
        className="lens-tab-bar__item"
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onAfterClick}
      >
        {item.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={item.active}
      data-active={item.active}
      className="lens-tab-bar__item"
      onClick={() => {
        item.onClick?.();
        onAfterClick?.();
      }}
    >
      {item.label}
    </button>
  );
}
