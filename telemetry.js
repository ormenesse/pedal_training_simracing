/**
 * TelemetryGraph — scrolling strip-chart: X = time, Y = value.
 * Ring buffer capped by time window; configurable yMin/yMax and secondsPer1080px.
 */
class TelemetryGraph {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.yMin = options.yMin ?? 0;
    this.yMax = options.yMax ?? 100;
    this.secondsPer1080px = options.secondsPer1080px ?? 10;
    this.widthPx = options.widthPx ?? 1080;
    this.buffer = [];
    this.startTime = performance.now();
  }

  /**
   * Update config (e.g. when user changes settings).
   */
  setConfig(options) {
    if (options.yMin !== undefined) this.yMin = options.yMin;
    if (options.yMax !== undefined) this.yMax = options.yMax;
    if (options.secondsPer1080px !== undefined) this.secondsPer1080px = options.secondsPer1080px;
    if (options.widthPx !== undefined) this.widthPx = options.widthPx;
  }

  /**
   * Push a sample. timestamp in ms (e.g. performance.now()), value in graph units.
   */
  push(timestamp, value) {
    const windowMs = this.secondsPer1080px * 1000;
    this.buffer.push({ timestamp, value });
    const cutoff = timestamp - windowMs;
    while (this.buffer.length > 1 && this.buffer[0].timestamp < cutoff) {
      this.buffer.shift();
    }
  }

  /**
   * Draw the graph. Call every frame.
   */
  draw() {
    const { canvas, ctx, buffer, yMin, yMax, secondsPer1080px, widthPx } = this;
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotLeft = padding.left;
    const plotRight = width - padding.right;
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    if (buffer.length < 2) {
      this._drawEmpty(ctx, plotLeft, plotTop, plotWidth, plotHeight);
      return;
    }

    const now = buffer[buffer.length - 1].timestamp;
    const windowMs = secondsPer1080px * 1000;
    const tMin = now - windowMs;
    const tMax = now;
    const tRange = tMax - tMin;
    const yRange = yMax - yMin;

    const toX = (t) => plotLeft + ((t - tMin) / tRange) * plotWidth;
    const toY = (v) => plotBottom - ((v - yMin) / yRange) * plotHeight;

    // Grid and axis labels
    this._drawGridAndLabels(ctx, tMin, tMax, yMin, yMax, plotLeft, plotTop, plotRight, plotBottom, toX, toY);

    // Vertical "now" line at right edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotRight, plotTop);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Line chart
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (const point of buffer) {
      const x = toX(point.timestamp);
      const y = toY(point.value);
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  _drawEmpty(ctx, plotLeft, plotTop, plotWidth, plotHeight) {
    ctx.fillStyle = '#333';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', plotLeft + plotWidth / 2, plotTop + plotHeight / 2);
  }

  _drawGridAndLabels(ctx, tMin, tMax, yMin, yMax, plotLeft, plotTop, plotRight, plotBottom, toX, toY) {
    const yRange = yMax - yMin;
    const tRange = tMax - tMin;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#888';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';

    // Horizontal grid lines and Y labels (5 steps)
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const v = yMin + (i / ySteps) * yRange;
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(yRange > 10 ? 0 : 1), plotLeft - 8, y + 4);
    }

    // Vertical grid lines and X labels (time, 5 steps)
    ctx.textAlign = 'center';
    const tSteps = 5;
    for (let i = 0; i <= tSteps; i++) {
      const t = tMin + (i / tSteps) * tRange;
      const x = plotLeft + (i / tSteps) * (plotRight - plotLeft);
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
      const sec = (t - tMin) / 1000;
      ctx.fillText('-' + (tRange / 1000 - sec).toFixed(1) + 's', x, plotBottom + 18);
    }
  }
}
