# Infinite Loop Prevention

This document explains how the React hooks prevent infinite loops and what patterns to watch for when using them.

## How We Prevent Infinite Loops

### 1. **useQuery Hook**

**Potential Issue:** Object inputs with different references but same values could trigger infinite re-fetches.

**Solution:**
```typescript
useEffect(() => {
  // ... fetch logic
}, [procedure, JSON.stringify(inputs)]);
```

- We use `JSON.stringify(inputs)` in the dependency array
- This ensures the effect only re-runs when the *content* of inputs changes
- New object references with the same values won't trigger refetches

**Test Coverage:**
- `useQuery - no infinite loop with object inputs`
- `useQuery - does not refetch when inputs are structurally the same`

### 2. **useMutation Hook**

**Potential Issue:** New options object on every render could cause mutate function to change constantly.

**Solution:**
```typescript
const mutate = useCallback(
  async (input: InferProcedureInputs<P[M]>) => {
    // ... mutation logic
  },
  [procedure, options]
);
```

- We use `useCallback` with `options` as a dependency
- If users pass new options objects on every render, the mutate function will be recreated
- **However**, this doesn't cause infinite loops because:
  - The mutate function doesn't trigger any effects
  - It's only called manually by user code
  - The state updates inside mutate are controlled and don't trigger the callback recreation

**Best Practice for Users:**
```typescript
// ✅ GOOD - Define options outside component or memoize
const options = useMemo(() => ({
  onSuccess: (data) => console.log(data)
}), []);

const [mutate, state] = client.useMutation("addTodo", options);

// ⚠️ WORKS BUT INEFFICIENT - Creates new mutate function on every render
const [mutate, state] = client.useMutation("addTodo", {
  onSuccess: (data) => console.log(data)
});
```

**Test Coverage:**
- `useMutation - mutate function is stable across renders`
- `useMutation - with options object doesn't cause infinite loops`

### 3. **useListenedQuery Hook**

**Potential Issue:** Re-subscribing to listeners on every render could cause memory leaks and multiple fetches.

**Solution:**
```typescript
useEffect(() => {
  const unsubscribe = this.listen(/* ... */);
  return () => {
    unsubscribe();
  };
}, [procedure, JSON.stringify(inputs), remote]);
```

- Uses `JSON.stringify(inputs)` for structural equality
- Unsubscribes on cleanup to prevent memory leaks
- Only re-subscribes when inputs actually change

**Test Coverage:**
- `useListenedQuery - no infinite loop with object inputs`

### 4. **useCachedQuery Hook**

**Potential Issue:** Cache key changes causing re-subscription loops.

**Solution:**
```typescript
private generateCacheKey(procedure: string, inputs: any): string {
  return `${procedure}:${JSON.stringify(inputs)}`;
}

useEffect(() => {
  // Subscribe to cache updates
  cacheEntry.listeners.add(listener);
  return () => {
    cacheEntry.listeners.delete(listener);
  };
}, [cacheKey]);
```

- Cache key uses `JSON.stringify` for consistent serialization
- Same inputs always produce the same cache key
- Cleanup removes listeners to prevent memory leaks

**Test Coverage:**
- `useCachedQuery - no infinite loop with object inputs`
- `useCachedQuery - cache key generation is consistent`

## Race Condition Prevention

All hooks use `isMountedRef` to prevent state updates on unmounted components:

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

// In async callbacks:
if (!isMountedRef.current) return;
setState(/* ... */);
```

This prevents:
- React warnings about setting state on unmounted components
- Memory leaks from callbacks that fire after unmount
- Race conditions where slow requests complete after component unmounts

## Known Limitations & Warnings

### ⚠️ JSON.stringify Limitations

**Issue:** Complex objects with functions, circular references, or Dates won't serialize correctly.

**Example:**
```typescript
// ❌ BAD - Functions will be lost
const [mutate, state] = client.useMutation("addTodo", {
  onSuccess: callback // If callback changes, it won't be detected
});

// ✅ GOOD - Extract stable reference
const handleSuccess = useCallback((data) => { /* ... */ }, []);
const [mutate, state] = client.useMutation("addTodo", {
  onSuccess: handleSuccess
});
```

**Workaround:** Users should memoize complex options objects:
```typescript
const options = useMemo(() => ({
  onSuccess: handleSuccess,
  onError: handleError
}), [handleSuccess, handleError]);

const [mutate, state] = client.useMutation("addTodo", options);
```

### ⚠️ Input Order Matters

**Issue:** Object property order affects JSON.stringify output.

**Example:**
```typescript
// These produce different cache keys:
{ id: 1, name: "Alice" }  // "{"id":1,"name":"Alice"}"
{ name: "Alice", id: 1 }  // "{"name":"Alice","id":1}"
```

**Impact:** Minimal in practice because:
- JavaScript object property order is consistent within the same code path
- Most apps construct input objects consistently
- If order varies, it's likely intentional (different inputs)

**If This Becomes an Issue:** Consider implementing a deterministic stringify:
```typescript
function deterministicStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return JSON.stringify(obj.map(deterministicStringify));

  const sorted = Object.keys(obj).sort();
  const result: any = {};
  for (const key of sorted) {
    result[key] = deterministicStringify(obj[key]);
  }
  return JSON.stringify(result);
}
```

## Testing Strategy

Our infinite loop tests verify:

1. **Render count limits** - Hooks don't cause excessive re-renders
2. **Fetch count tracking** - Queries aren't called more than expected
3. **Reference stability** - Functions returned from hooks are stable
4. **Object input handling** - New references with same values don't cause issues
5. **Cache consistency** - Multiple instances share cache correctly

## Recommendations for Users

### ✅ DO:
- Define options outside components or use `useMemo`
- Use primitive inputs when possible
- Memoize complex input objects with `useMemo`
- Keep callback functions stable with `useCallback`

### ❌ DON'T:
- Create new objects/arrays in render without memoization
- Pass inline functions as options
- Mutate input objects after passing them to hooks
- Assume object property order doesn't matter (it usually doesn't, but be aware)

## Future Improvements

If infinite loops become an issue, consider:

1. **Custom equality function** - Allow users to provide custom comparison
2. **Shallow comparison** - For simple objects, compare properties directly
3. **Hash-based keys** - Use a hash function instead of JSON.stringify
4. **Developer warnings** - Warn when options objects change frequently
