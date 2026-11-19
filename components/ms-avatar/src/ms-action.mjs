import { validateActionClip } from "./action-clip.mjs";

export class MsAction extends (globalThis.HTMLElement ?? class {}) {
  constructor() {
    super();
    this._revision = 0;
    this._snapshot = Object.freeze({ status: "pending", name: null, localRevision: 0 });
    this._name = null;
  }

  static get observedAttributes() {
    return ["name"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "name" && oldValue !== newValue) {
      this._name = newValue;
      this._publishSnapshot({ status: "pending", name: newValue ?? null, localRevision: this._revision });
      const parent = this.parentElement;
      if (parent && typeof parent._actionChildUpdated === "function") parent._actionChildUpdated(this);
    }
  }

  receiveRenderData(data) {
    const name = this.getAttribute("name");
    try {
      if (!data?.clip) throw new TypeError("clip is required");
      validateActionClip(data.clip);
      this._revision += 1;
      const clip = Object.freeze(structuredClone(data.clip));
      this._publishSnapshot({
        status: "valid",
        name: name ?? null,
        localRevision: this._revision,
        clip,
      });
    } catch (cause) {
      this._revision += 1;
      this._publishSnapshot({
        status: "invalid",
        name: name ?? null,
        localRevision: this._revision,
        diagnostic: {
          code: "ACTION_INVALID",
          detail: cause instanceof Error ? cause.message : String(cause),
        },
      });
    }
    const parent = this.parentElement;
    if (parent && typeof parent._actionChildUpdated === "function") parent._actionChildUpdated(this);
  }

  getClipSnapshot() {
    return this._snapshot;
  }

  _publishSnapshot(snapshot) {
    this._snapshot = Object.freeze(snapshot);
    if (typeof this.dispatchEvent === "function") {
      this.dispatchEvent(new Event("ms-action-change", { bubbles: false, composed: false }));
    }
  }
}
