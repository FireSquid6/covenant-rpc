import { test, expect } from "bun:test";
import { z } from "zod";
import { declareCovenant, type Covenant, type ProcedureMap, type ChannelMap } from "../lib/index";

test("declareCovenant should return the same covenant object", () => {
  const testCovenant = {
    procedures: {
      getUser: {
        type: "query" as const,
        input: z.object({ id: z.string() }),
        output: z.object({ name: z.string() })
      }
    },
    channels: {}
  };

  const result = declareCovenant(testCovenant);
  expect(result).toEqual(testCovenant);
  expect(result).toBe(testCovenant);
});

test("declareCovenant should work with empty procedures and channels", () => {
  const emptyCovenant = {
    procedures: {},
    channels: {}
  };

  const result = declareCovenant(emptyCovenant);
  expect(result).toEqual(emptyCovenant);
});

test("declareCovenant should work with multiple procedures", () => {
  const multiProcedureCovenant = {
    procedures: {
      getUser: {
        type: "query" as const,
        input: z.object({ id: z.string() }),
        output: z.object({ name: z.string(), email: z.string() })
      },
      createUser: {
        type: "mutation" as const,
        input: z.object({ name: z.string(), email: z.string() }),
        output: z.object({ id: z.string(), created: z.boolean() })
      },
      deleteUser: {
        type: "mutation" as const,
        input: z.object({ id: z.string() }),
        output: z.object({ deleted: z.boolean() })
      }
    },
    channels: {}
  };

  const result = declareCovenant(multiProcedureCovenant);
  expect(result).toEqual(multiProcedureCovenant);
  expect(Object.keys(result.procedures)).toHaveLength(3);
});

test("declareCovenant should work with channels", () => {
  const channelCovenant = {
    procedures: {},
    channels: {
      chat: {
        clientMessage: z.object({ message: z.string() }),
        serverMessage: z.object({ response: z.string(), timestamp: z.number() })
      }
    }
  };

  const result = declareCovenant(channelCovenant);
  expect(result).toEqual(channelCovenant);
  expect(Object.keys(result.channels)).toHaveLength(1);
});

test("declareCovenant should work with both procedures and channels", () => {
  const fullCovenant = {
    procedures: {
      auth: {
        type: "mutation" as const,
        input: z.object({ token: z.string() }),
        output: z.object({ valid: z.boolean() })
      }
    },
    channels: {
      notifications: {
        clientMessage: z.object({ subscribe: z.string() }),
        serverMessage: z.object({ event: z.string(), data: z.any() })
      }
    }
  };

  const result = declareCovenant(fullCovenant);
  expect(result).toEqual(fullCovenant);
  expect(Object.keys(result.procedures)).toHaveLength(1);
  expect(Object.keys(result.channels)).toHaveLength(1);
});

test("covenant types should be properly inferred", () => {
  const covenant = declareCovenant({
    procedures: {
      test: {
        type: "query" as const,
        input: z.object({ value: z.number() }),
        output: z.object({ result: z.string() })
      }
    },
    channels: {
      stream: {
        clientMessage: z.object({ cmd: z.string() }),
        serverMessage: z.object({ data: z.string() })
      }
    }
  });

  // Type assertions to ensure proper inference
  const procedureKeys: keyof typeof covenant.procedures = "test";
  const channelKeys: keyof typeof covenant.channels = "stream";
  
  expect(procedureKeys).toBe("test");
  expect(channelKeys).toBe("stream");
});