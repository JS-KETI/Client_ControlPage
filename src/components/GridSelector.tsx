interface Props {
  value: number;
  onChange: (count: number) => void;
}

const GRID_OPTIONS = [1, 2, 4, 8] as const;

/**
 * Bottom toolbar that switches the video grid between 1 / 2 / 4 / 8 cells.
 * Mutually exclusive selection (segmented control), wired to App's gridCount state.
 */
export function GridSelector({ value, onChange }: Props) {
  return (
    <div className="grid-selector">
      <span className="grid-selector-label">Layout</span>
      {GRID_OPTIONS.map((count) => (
        <button
          key={count}
          type="button"
          className={`grid-selector-btn ${value === count ? 'active' : ''}`}
          aria-pressed={value === count}
          onClick={() => onChange(count)}
        >
          {count}
        </button>
      ))}
    </div>
  );
}
