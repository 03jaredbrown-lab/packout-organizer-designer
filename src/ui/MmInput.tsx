import { useEffect, useState } from "react";
import type { DisplayUnit } from "../model/units";
import { formatLength, mmToIn, parseLength } from "../model/units";

interface Props {
  value: number | null;
  unit: DisplayUnit;
  onCommit: (mm: number | null) => void;
  placeholder?: string;
  allowNull?: boolean;
  min?: number;
}

/** Text input that displays/accepts a length in the active display unit but stores millimetres. */
export function MmInput({ value, unit, onCommit, placeholder, allowNull, min }: Props) {
  const display = value == null ? "" : unit === "in" ? mmToIn(value).toFixed(3) : value.toFixed(2);
  const [text, setText] = useState(display);

  useEffect(() => {
    setText(display);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit]);

  function commit() {
    if (text.trim() === "") {
      if (allowNull) onCommit(null);
      else setText(display);
      return;
    }
    const mm = parseLength(text, unit);
    if (mm == null || (min != null && mm < min)) {
      setText(display);
      return;
    }
    onCommit(mm);
  }

  return (
    <input
      className="mm-input"
      inputMode="decimal"
      value={text}
      placeholder={placeholder ?? (value == null ? "—" : formatLength(value, unit))}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
