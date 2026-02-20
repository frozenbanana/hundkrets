# Hundkrets TODO

## p0 ✅ (done)
Core matches/overview functionality.

---

## p1
**Fix connection_requests not loading** — `outgoingIds` and `requestedMeIds` are empty despite records existing in PocketBase.

- [ ] Verify auth token is sent with `connection_requests.getFullList()` request (check Network tab)
- [ ] Ensure fetch runs after auth is ready (timing/race condition)
- [ ] Confirm app uses correct PocketBase URL
- [ ] Add explicit `expand: ""` or debug why API returns empty array

---

## p2
**Remove debug console.logs** from `app/routes/app/matches.tsx`:
- [ ] Remove `[matches] URL sync`
- [ ] Remove `[matches] Tab click`
- [ ] Remove `[matches] Fetched connections`
- [ ] Remove `[matches] Connection parsing`

---

## p3
**Polish & robustness**
- [ ] Add error boundary or user-facing message when connection_requests fetch fails
- [ ] Consider refetch on mount when auth becomes available (if timing issue)
- [ ] Verify outgoing tab works after p1 fix
