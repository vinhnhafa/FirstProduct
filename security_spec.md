# Firestore Security Specification

## 1. Data Invariants
1. A `UserProfile` document at `/users/{userId}` can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId`.
2. `uid` must match `request.auth.uid` and remain immutable after creation.
3. `createdAt` must equal `request.time` on creation and remain immutable on updates; `updatedAt` must equal `request.time` on both create and update.
4. No collection-wide `list` operations are allowed on `/users` or `/users/{userId}/private` to prevent user enumeration or PII scraping.
5. `email` (PII) is strictly isolated inside `/users/{userId}/private/account`, never stored in `/users/{userId}`.
6. Heart balances and MoMo wallet transactions are never client-writable in Firestore; all heart purchases are verified and credited exclusively on the Express backend via HMAC-SHA256 verification.

## 2. Adversarial Payloads Blocked ("Dirty Dozen")
1. Unauthenticated `get` / `users/u1` -> `PERMISSION_DENIED`
2. Cross-user `get` (`uid = u2` reading `/users/u1`) -> `PERMISSION_DENIED`
3. Collection `list` on `/users` -> `PERMISSION_DENIED`
4. Spoofed `uid` field in create payload (`/users/u1` with `uid: "u2"`) -> `PERMISSION_DENIED`
5. Shadow/ghost field injection (`isAdmin: true`, `heartsBalance: 999999`) -> `PERMISSION_DENIED`
6. Missing required fields (`displayName` omitted) -> `PERMISSION_DENIED`
7. Oversized `displayName` (> 48 chars) or oversized `photoUrl` (> 512 chars) -> `PERMISSION_DENIED`
8. Invalid document ID format (`userId` > 128 chars or special characters) -> `PERMISSION_DENIED`
9. Spoofed client timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`
10. Mutating immutable `uid` or `createdAt` during update -> `PERMISSION_DENIED`
11. Storing PII (`email`) directly in `/users/{userId}` -> `PERMISSION_DENIED`
12. Cross-user read/write on `/users/u1/private/account` (`uid = u2`) -> `PERMISSION_DENIED`
