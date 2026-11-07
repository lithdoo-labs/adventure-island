// Canonical Base: the only owner of the unified controls producer.
//
// Base creates one game-controls-input RenderDomain and keeps it alive for
// the whole child Frame. It does not listen to the DOM, interpret directions,
// or touch the actor. adventure-map is the top active Frame and therefore
// receives the producer's controls.state / controls.event broadcast.
import { defineSubsystem } from "@loomrealm/subsystem";

export default defineSubsystem((scope) => ({
  async frame(frame) {
    const controls = scope.createRenderDomain({
      zIndex: 0,
      roots: [{
        key: "game-controls-input",
        tag: "game-controls-input",
        attrs: {},
        data: {},
        children: [],
      }],
    });
    try {
      return await frame.call("adventure-map", frame.params);
    } finally {
      controls.close();
    }
  },
}));
