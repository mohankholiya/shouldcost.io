export type Pos = { row: number; col: number };
export type Dims = { rows: number; cols: number };

const clamp = (n: number, max: number) => Math.max(0, Math.min(max - 1, n));

/** Excel-like cell movement. Tab advances left-to-right then to the next row. */
export function nextCell(pos: Pos, key: string, d: Dims): Pos {
  switch (key) {
    case "Tab": {
      const flat = pos.row * d.cols + pos.col + 1;
      return { row: Math.min(d.rows - 1, Math.floor(flat / d.cols)), col: flat % d.cols };
    }
    case "ArrowRight":
      return { row: pos.row, col: clamp(pos.col + 1, d.cols) };
    case "ArrowLeft":
      return { row: pos.row, col: clamp(pos.col - 1, d.cols) };
    case "ArrowDown":
    case "Enter":
      return { row: clamp(pos.row + 1, d.rows), col: pos.col };
    case "ArrowUp":
      return { row: clamp(pos.row - 1, d.rows), col: pos.col };
    default:
      return pos;
  }
}
