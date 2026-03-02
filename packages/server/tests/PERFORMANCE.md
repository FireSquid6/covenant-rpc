# Sidekick Performance Testing

This document describes the performance test suite for the Sidekick server and how to interpret the results.

## Running Performance Tests

Performance tests are skipped by default (they're marked with `describe.skip`). To run them:

```bash
# Run all performance tests
bun test packages/server/tests/performance.test.ts

# Run specific test
bun test packages/server/tests/performance.test.ts -t "Connection scaling"
```

**Note:** These tests can take several minutes to complete and may consume significant system resources.

## Test Scenarios

### 1. Connection Scaling Test

**Purpose:** Determine the maximum number of concurrent WebSocket connections the Sidekick server can handle.

**What it measures:**
- Number of concurrent connections established
- Memory usage per connection
- Time to establish connections

**Expected results:**
- Linear memory growth with connection count
- Connection establishment time should remain relatively constant

**When to scale:**
- Memory usage becomes prohibitive for your deployment
- Connection establishment time increases significantly
- System resources (file descriptors, memory) become constrained

### 2. Message Throughput Test

**Purpose:** Measure how many resource invalidation messages the server can process per second.

**What it measures:**
- Messages processed per second
- System behavior under message load

**Expected results:**
- Consistent throughput regardless of message volume
- No significant degradation with sustained load

**When to scale:**
- Throughput drops below application requirements
- Message processing latency increases
- CPU usage consistently high

### 3. Broadcast Latency Test

**Purpose:** Understand how broadcast latency scales with the number of subscribers to a resource.

**What it measures:**
- Average (mean) latency
- P95 latency (95th percentile)
- P99 latency (99th percentile)

**Expected results:**
- Latency increases roughly linearly with subscriber count (O(n) iteration)
- P99 should be within acceptable bounds for your application

**When to scale:**
- P95/P99 latencies exceed application requirements
- Latency grows super-linearly (indicates additional bottlenecks)

**Optimization strategies:**
- Use more specific resource identifiers to reduce fan-out
- Consider splitting into multiple Sidekick instances by resource namespace
- Implement resource partitioning

### 4. Resource Fan-out Test

**Purpose:** Test selective invalidation performance when many clients are connected but only a subset are affected.

**What it measures:**
- Time to invalidate a subset of resources
- Efficiency of selective broadcasting

**Expected results:**
- Invalidation time proportional to number of affected subscribers, not total connections
- Demonstrates that the pub/sub topic system works efficiently

**When to scale:**
- Selective invalidation time increases beyond acceptable limits
- Total connection count affects unrelated resource invalidations

### 5. Baseline Performance Profile

**Purpose:** Create a comprehensive performance profile across multiple connection counts.

**What it measures:**
- Combined metrics at different scales
- Performance degradation trends

**Expected results:**
- Identifies inflection points where performance degrades
- Shows whether degradation is linear or super-linear

**When to scale:**
- Non-linear degradation detected (latency increases faster than connection count)
- Any metric exceeds application requirements

## Interpreting Results

### Memory Usage

Sidekick stores per-connection state:
- WebSocket connection object
- Set of subscribed topics
- Connection ID and metadata

**Typical memory per connection:** ~10-50KB depending on number of subscriptions.

**When to scale:** If memory usage limits your target connection count.

### Latency Characteristics

Broadcast latency is primarily driven by:
1. **O(n) iteration** through all connections (checking topic membership)
2. **Serialization overhead** (ION.stringify for each message)
3. **WebSocket send buffering**

**Expected latency:**
- 100 subscribers: ~1-5ms
- 1,000 subscribers: ~5-20ms
- 10,000 subscribers: ~50-200ms

**Critical thresholds:**
- If P99 > 100ms with <1000 subscribers, investigate system bottlenecks
- If latency growth is super-linear, consider architectural changes

### Throughput

Message throughput is limited by:
1. HTTP request processing (for resource invalidations from server)
2. Broadcast iteration speed
3. Network bandwidth

**Expected throughput:**
- 100-1000 messages/second for typical deployments
- Higher throughput possible with optimizations

## Scaling Strategies

### Horizontal Scaling

**When:** Connection count or throughput exceeds single-instance capacity.

**How:**
1. Run multiple Sidekick instances
2. Partition clients by resource namespace or tenant
3. Use load balancer with sticky sessions (WebSocket affinity)

**Limitations:** Cross-instance resource invalidation requires additional coordination.

### Vertical Scaling

**When:** Current instance has room to grow (memory, CPU).

**How:**
- Increase instance size
- Tune Node.js heap size (`--max-old-space-size`)
- Increase file descriptor limits

**Limitations:** Single-instance limits (typically 10k-50k connections).

### Optimization Before Scaling

Before adding instances, consider:

1. **Resource granularity:** Use specific resource IDs to reduce fan-out
   ```typescript
   // ❌ Broad invalidation
   resources: ["todos"]

   // ✅ Specific invalidation
   resources: [`user/${userId}/todos`, `todo/${todoId}`]
   ```

2. **Connection pooling:** Reuse connections where possible

3. **Batching:** Batch resource invalidations when possible
   ```typescript
   // ✅ Single call
   await sidekick.updateResources(["resource1", "resource2", "resource3"]);

   // ❌ Multiple calls
   await sidekick.updateResources(["resource1"]);
   await sidekick.updateResources(["resource2"]);
   await sidekick.updateResources(["resource3"]);
   ```

4. **Unsubscribe aggressively:** Clean up listeners when components unmount

## Performance Monitoring in Production

Add instrumentation to track:

```typescript
const sidekick = new Sidekick(publishFn, serverConnection, "info");

// Monitor via server logs
// - Connection counts
// - Message rates
// - Error rates
```

Key metrics to monitor:
- Active WebSocket connections
- Messages broadcast per second
- Average broadcast latency
- Memory usage
- CPU usage
- WebSocket connection errors

## Benchmarking Tips

1. **Isolate tests:** Run performance tests on dedicated hardware
2. **Multiple runs:** Run tests multiple times, results can vary
3. **Warm-up:** First run may be slower due to JIT compilation
4. **System resources:** Check file descriptor limits (`ulimit -n`)
5. **Network conditions:** localhost vs network can show different characteristics
6. **Realistic scenarios:** Match test patterns to your actual usage

## Known Limitations

1. **O(n) broadcast:** Every broadcast iterates all connections
2. **In-memory state:** All connection state is in-memory (lost on restart)
3. **Single-threaded:** Node.js event loop is single-threaded
4. **No persistence:** Messages not delivered to offline clients

## Example Performance Targets

For reference, here are example targets for different deployment scales:

**Small deployment (100-500 users):**
- Connections: 100-500
- Throughput: 50-100 msg/s
- P99 latency: <50ms

**Medium deployment (1k-10k users):**
- Connections: 1,000-5,000
- Throughput: 500-1000 msg/s
- P99 latency: <100ms

**Large deployment (10k+ users):**
- Connections: 10,000+
- Throughput: 1000+ msg/s
- P99 latency: <200ms
- Requires: Multiple Sidekick instances with partitioning

## Next Steps

After running performance tests:

1. **Establish baseline:** Run tests to understand current capacity
2. **Set targets:** Define acceptable latency/throughput for your app
3. **Monitor production:** Track metrics in real deployments
4. **Plan scaling:** Scale before hitting limits (aim for 70% capacity max)
5. **Re-test:** Re-run tests after Sidekick updates or infrastructure changes
