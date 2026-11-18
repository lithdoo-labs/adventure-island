/**
 * Drive the real LoomRealm RendererRenderStore and WebProjector together.
 *
 * The eligibility predicate matches Renderer control's per-store check in
 * readPresentation(): current carrier, registry seen, every domain baselined.
 * Roots passed to WebProjector are the store replica's own roots. This module
 * does not reconcile DOM and does not keep a second scene tree.
 */

export function presentationViewFromStore(store, { sessionId, subsystemKey }) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new TypeError("Spike projection requires a sessionId");
  }
  if (typeof subsystemKey !== "string" || subsystemKey.length === 0) {
    throw new TypeError("Spike projection requires a subsystemKey");
  }
  const facts = store.readPresentationFacts();
  const eligible = facts.currentCarrier === true
    && facts.registrySeen === true
    && facts.domains.length > 0
    && facts.domains.every((domain) => domain.baselined === true);
  return {
    sessionId,
    subsystems: [{
      subsystemKey,
      generation: facts.generation,
      eligible,
      domains: eligible
        ? facts.domains.map((domain) => ({
          domainId: domain.domainId,
          zIndex: domain.zIndex,
          roots: domain.roots,
        }))
        : [],
    }],
  };
}

export function projectStore(projector, store, identity) {
  const view = presentationViewFromStore(store, identity);
  projector.reevaluate({ read: () => view }, () => {});
  return view;
}

function assertAccepted(disposition, label) {
  if (disposition?.kind !== "accepted") {
    const message = disposition?.cause?.message ?? disposition?.kind ?? "rejected";
    throw new Error(`${label} rejected by RendererRenderStore: ${message}`);
  }
}

function rootList(roots) {
  if (Array.isArray(roots)) return roots;
  if (roots === null || typeof roots !== "object") throw new TypeError("Spike snapshot requires a render root");
  return [roots];
}

export function createSpikeProjection({
  store,
  projector,
  sessionId,
  subsystemKey,
  domainId,
}) {
  if (typeof domainId !== "string" || domainId.length === 0) {
    throw new TypeError("Spike projection requires a domainId");
  }
  let revision = 0;
  let opened = false;
  const identity = { sessionId, subsystemKey };
  const publish = () => projectStore(projector, store, identity);

  return {
    get revision() {
      return revision;
    },
    open(roots, zIndex = 0) {
      if (opened) throw new Error("Spike projection is already open");
      store.beginCarrier();
      assertAccepted(store.onDomains({ type: "render.domains", domains: [domainId] }), "registry");
      revision = 1;
      assertAccepted(store.onSnapshot({
        type: "render.snapshot",
        domainId,
        revision,
        zIndex,
        roots: rootList(roots),
      }), "snapshot");
      opened = true;
      return publish();
    },
    replace(roots, zIndex = 0) {
      if (!opened) throw new Error("Spike projection is not open");
      revision += 1;
      assertAccepted(store.onSnapshot({
        type: "render.snapshot",
        domainId,
        revision,
        zIndex,
        roots: rootList(roots),
      }), "snapshot");
      return publish();
    },
    update(ops, zIndex) {
      if (!opened) throw new Error("Spike projection is not open");
      const baseRevision = revision;
      revision += 1;
      const message = {
        type: "render.patch",
        domainId,
        baseRevision,
        revision,
        ops,
      };
      if (zIndex !== undefined) message.zIndex = zIndex;
      assertAccepted(store.onPatch(message), "patch");
      return publish();
    },
    project: publish,
  };
}
