declare module "canvas-nest.js" {
  interface NestPoint { x: number; y: number; xa: number; ya: number; max: number }
  export default class CanvasNest {
    constructor(element: HTMLElement, config?: {
      color?: string;
      pointColor?: string;
      opacity?: number;
      count?: number;
      zIndex?: number;
    });
    points: NestPoint[];
    current: { x: number | null; y: number | null; max: number };
    canvas: HTMLCanvasElement;
    onmousemove: typeof window.onmousemove;
    onmouseout: typeof window.onmouseout;
    drawCanvas: () => void;
    destroy: () => void;
  }
}
