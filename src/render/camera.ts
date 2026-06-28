/** Camera: world → screen (§7.10). screen = (world - {x,y}) * zoom. */
export class Camera {
  /** World-space coordinate that sits at the screen origin (top-left). */
  x = 0;
  y = 0;
  zoom = 1;

  worldToScreenX(wx: number): number {
    return (wx - this.x) * this.zoom;
  }
  worldToScreenY(wy: number): number {
    return (wy - this.y) * this.zoom;
  }
  screenToWorldX(sx: number): number {
    return sx / this.zoom + this.x;
  }
  screenToWorldY(sy: number): number {
    return sy / this.zoom + this.y;
  }
}
