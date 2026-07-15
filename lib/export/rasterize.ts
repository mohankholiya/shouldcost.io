import "server-only";
import sharp from "sharp";

/** Rasterize an SVG string to a PNG buffer at 2× scale for crisp embedding. */
export async function svgToPng(svg: string): Promise<Buffer> {
  // Read intrinsic size from the <svg width=… height=…>; render at 2× for retina fidelity.
  const wMatch = svg.match(/width="(\d+)"/);
  const hMatch = svg.match(/height="(\d+)"/);
  const w = wMatch ? Number(wMatch[1]) : 480;
  const h = hMatch ? Number(hMatch[1]) : 240;
  return sharp(Buffer.from(svg)).resize(w * 2, h * 2, { fit: "fill" }).png().toBuffer();
}
