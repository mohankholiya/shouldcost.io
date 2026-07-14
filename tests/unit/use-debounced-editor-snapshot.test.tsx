import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useDebouncedEditorSnapshot } from "@/components/models/charts/use-debounced-editor-snapshot";

describe("useDebouncedEditorSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.setState({
      nodes: {},
      order: [],
      rollup: { total: 0, byNodeId: {} },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("returns the latest snapshot after the debounce window", () => {
    const { result } = renderHook(() => useDebouncedEditorSnapshot(200));
    expect(result.current.rollup.total).toBe(0);

    act(() => {
      useEditorStore.setState({
        nodes: { a: { id: "a", rate: 100, quantity: 2, node_type: "line" } } as never,
        order: ["a"],
        rollup: { total: 200, byNodeId: { a: 200 } },
      });
    });
    // not yet
    expect(result.current.rollup.total).toBe(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.rollup.total).toBe(200);
  });
});
