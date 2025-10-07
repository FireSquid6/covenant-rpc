# Skeleton UI Best Practices

## Memory Note for Claude Code

**NEVER repeat common UI components across loading, error, and main states. Always extract shared components.**

## Key Principles

1. **Extract Common Components**: Any UI element that appears in multiple states (loading, error, success) should be extracted into a reusable component with conditional props.

2. **State-Aware Components**: Create components that handle their own state variations through props:
   - `isLoading?: boolean`
   - `isError?: boolean` 
   - `title?: string`

3. **Single Source of Truth**: Each UI pattern should have one implementation that adapts to different states rather than duplicating code.

## Example Pattern

```tsx
// ✅ GOOD - Reusable component with state variants
function UserPanel({ isLoading }: { isLoading?: boolean }) {
  return (
    <div className="user-panel">
      {isLoading ? (
        <div className="skeleton-avatar" />
      ) : (
        <div className="real-avatar" />
      )}
    </div>
  );
}

// ✅ GOOD - Use across all states
function MyComponent() {
  if (loading) return <div><UserPanel isLoading /></div>;
  if (error) return <div><UserPanel /></div>;
  return <div><UserPanel /></div>;
}

// ❌ BAD - Repeating the same UI structure
function MyComponent() {
  if (loading) return (
    <div>
      <div className="user-panel">
        <div className="skeleton-avatar" />
      </div>
    </div>
  );
  if (error) return (
    <div>
      <div className="user-panel">
        <div className="real-avatar" />
      </div>
    </div>
  );
  return (
    <div>
      <div className="user-panel">
        <div className="real-avatar" />
      </div>
    </div>
  );
}
```

## Common Anti-Patterns to Avoid

1. **Duplicating entire component structures** for loading/error states
2. **Copy-pasting identical UI elements** across different states
3. **Hardcoding skeleton content** instead of making it dynamic
4. **Creating separate skeleton components** when the main component can handle state variants

## Benefits

- **Maintainability**: Changes to common UI only need to be made in one place
- **Consistency**: UI behavior is identical across all states
- **Reduced Bundle Size**: Less duplicated code
- **Type Safety**: Props ensure consistent interfaces across states