import { Sidekick } from "../lib/sidekick";
import { test, expect, mock } from "bun:test";
import type { SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";


test("resource updating", () => {
  // could be anything we just need to assert the calls
  const publishFunction = mock(async (topic: string, message: SidekickOutgoingMessage) => {});

  const sidekick = new Sidekick(publishFunction);

  sidekick.updateResources(["hello", "world"]);
  expect(publishFunction.mock.calls).toEqual([
    ["resource:hello", {
      type: "updated",
      resource: "hello",
    }],
    ["resource:world", {
      type: "updated",
      resource: "world",
    }],
  ]);
});
