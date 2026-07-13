import { describe, it, expect, vi } from 'vitest';
import { drawChart } from '../src/components/chart/drawChart.js';

// 순수 함수라 실제 캔버스 없이 mock CanvasRenderingContext2D로 검증 가능.
function makeCtx(width = 200, height = 60) {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    canvas: { width, height },
    calls,
    fillRect: rec('fillRect'),
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    stroke: rec('stroke'),
    fill: rec('fill'),
    arc: rec('arc'),
    closePath: rec('closePath'),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set lineCap(v) {},
    set lineJoin(v) {},
  };
}

describe('drawChart', () => {
  it('no-ops safely without a ctx/canvas', () => {
    expect(() => drawChart(null, [{ value: 1 }], '#fff', 100)).not.toThrow();
    expect(() => drawChart({}, [{ value: 1 }], '#fff', 100)).not.toThrow();
  });

  it('draws only the grid when there is no data', () => {
    const ctx = makeCtx();
    drawChart(ctx, [], '#35e0d0', 100);
    // background fillRect + grid strokes, but no data lineTo beyond the grid
    expect(ctx.calls.some((c) => c[0] === 'fillRect')).toBe(true);
    expect(ctx.calls.some((c) => c[0] === 'arc')).toBe(false); // no data points
  });

  it('plots data points for a multi-point series', () => {
    const ctx = makeCtx();
    drawChart(ctx, [{ value: 10 }, { value: 50 }, { value: 90 }], '#35e0d0', 100);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBe(3); // one dot per data point
  });

  it('handles a single data point', () => {
    const ctx = makeCtx();
    drawChart(ctx, [{ value: 42 }], '#ff003f', 100);
    expect(ctx.calls.filter((c) => c[0] === 'arc').length).toBe(1);
  });
});
