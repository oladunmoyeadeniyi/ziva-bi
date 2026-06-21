# CC Brief — Debug Dimension Value PATCH

## Task
In `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`,
in `handleEditValueSave`, add logs after patchBody is built and after fetch:

```typescript
console.log("PATCH BODY", JSON.stringify(patchBody));
```
Add this right before the fetch call.

Then after `const res = await fetch(...)`:
```typescript
console.log("PATCH STATUS", res.status);
```

Do not change anything else. Do not commit.
