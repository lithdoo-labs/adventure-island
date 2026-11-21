import {
  resolveViewportFrame,
  VIEWPORT_RESOLUTION_CHANNEL,
  VIEWPORT_RESOLUTION_EVENT,
  viewportRangeAttributeNames,
  viewportRangeFromAttributes,
} from "./layout.mjs";

const HOST_STYLE = `
:host {
  position: fixed;
  inset: 0;
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}
.stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  overflow: hidden;
}
.stage ::slotted(*) {
  display: block;
  width: 100%;
  height: 100%;
}
`;

function cssNumber(value) {
  if (Object.is(value, -0) || value === 0) return "0";
  return String(value);
}

export class MsViewportFrame extends HTMLElement {
  static get observedAttributes() {
    return viewportRangeAttributeNames();
  }

  constructor() {
    super();
    this._context = null;
    this._layout = null;
    this._screenWidth = 0;
    this._screenHeight = 0;
    this._state = "pending";
    this._emittedWidth = null;
    this._emittedHeight = null;
    this._observer = null;
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = HOST_STYLE;
    this._stage = document.createElement("div");
    this._stage.className = "stage";
    this._stage.append(document.createElement("slot"));
    shadow.append(style, this._stage);
  }

  receiveRenderContext(context) {
    if (context === null || typeof context !== "object" || typeof context.emitCustomEvent !== "function") {
      throw new TypeError("Invalid WebPresentationContext");
    }
    this._context = context;
    this._publish();
  }

  connectedCallback() {
    if (this._observer === null && typeof ResizeObserver === "function") {
      this._observer = new ResizeObserver(() => this._apply());
      this._observer.observe(this);
    }
    this._apply();
  }

  disconnectedCallback() {
    this._observer?.disconnect();
    this._observer = null;
  }

  attributeChangedCallback() {
    this._apply();
  }

  diagnostics() {
    return {
      state: this._state,
      mode: this._layout?.mode ?? null,
      width: this._layout?.width ?? null,
      height: this._layout?.height ?? null,
      scaleX: this._layout?.scaleX ?? null,
      scaleY: this._layout?.scaleY ?? null,
      screenWidth: this._screenWidth,
      screenHeight: this._screenHeight,
    };
  }

  _apply() {
    if (!this.isConnected) return;
    const range = viewportRangeFromAttributes({
      "min-width": this.getAttribute("min-width"),
      "max-width": this.getAttribute("max-width"),
      "min-height": this.getAttribute("min-height"),
      "max-height": this.getAttribute("max-height"),
    });
    this._screenWidth = this.clientWidth;
    this._screenHeight = this.clientHeight;
    if (range === null) {
      this._layout = null;
      this._state = "invalid";
      this._stage.hidden = true;
      this._writeDiagnostics();
      return;
    }
    if (this._screenWidth <= 0 || this._screenHeight <= 0) {
      this._layout = null;
      this._state = "pending";
      this._stage.hidden = true;
      this._writeDiagnostics();
      return;
    }
    const layout = resolveViewportFrame(this._screenWidth, this._screenHeight, range);
    if (layout === null) {
      this._layout = null;
      this._state = "invalid";
      this._stage.hidden = true;
      this._writeDiagnostics();
      return;
    }
    this._layout = layout;
    this._state = "ready";
    this._stage.hidden = false;
    const offsetX = (this._screenWidth - layout.width * layout.scaleX) / 2;
    const offsetY = (this._screenHeight - layout.height * layout.scaleY) / 2;
    this._stage.style.width = `${layout.width}px`;
    this._stage.style.height = `${layout.height}px`;
    this._stage.style.transform = `translate(${cssNumber(offsetX)}px, ${cssNumber(offsetY)}px) scale(${cssNumber(layout.scaleX)}, ${cssNumber(layout.scaleY)})`;
    this._writeDiagnostics();
    this._publish();
  }

  _writeDiagnostics() {
    this.setAttribute("data-viewport-state", this._state);
    if (this._layout === null) {
      this.removeAttribute("data-viewport-mode");
      this.removeAttribute("data-viewport-width");
      this.removeAttribute("data-viewport-height");
      return;
    }
    this.setAttribute("data-viewport-mode", this._layout.mode);
    this.setAttribute("data-viewport-width", String(this._layout.width));
    this.setAttribute("data-viewport-height", String(this._layout.height));
  }

  _publish() {
    const layout = this._layout;
    if (this._context === null || layout === null) return;
    if (layout.width === this._emittedWidth && layout.height === this._emittedHeight) return;
    this._context.emitCustomEvent(
      VIEWPORT_RESOLUTION_EVENT,
      { width: layout.width, height: layout.height },
      { broadcast: false, channel: VIEWPORT_RESOLUTION_CHANNEL },
    );
    this._emittedWidth = layout.width;
    this._emittedHeight = layout.height;
  }
}

if (globalThis.customElements?.get("ms-viewport-frame") === undefined) {
  globalThis.customElements.define("ms-viewport-frame", MsViewportFrame);
}
