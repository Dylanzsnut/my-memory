# Executable contracts

This folder holds no copied schema. The executable sources of truth are:

| Contract | Source of truth |
|---|---|
| Domain types | `src/types.ts` |
| IndexedDB object stores and keys | `src/lib/store.ts` (`openDB` schema) |
| Firestore metadata shape and access | `src/lib/firebase.ts` field allowlist + `firestore.rules` |
| Firebase Hosting config | `firebase.json` |
| Environment keys and defaults | `.env.example` + `src/lib/config.ts` |

Docs in `docs/` link here; they do not retype these fields.
