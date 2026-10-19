# LiveKit prototype
- [x] Verify documented development-token workflow and setup.
- [x] Replace Jitsi with LiveKit video, audio controls, status, and cleanup without redesign.
- [x] Test room selection and real two-participant flow; report setup and limitations.

# Supabase accounts
- [x] Add signup/login, persistent sessions, and a protected account home with profiles and logout.
- [x] Preserve guest rooms; browser-check signed-out protection and refresh, and run account and LiveKit regression tests.
- [x] Confirm hosted email settings and provide email-confirmation setup and a short two-account checklist.
- [ ] Verify signed-in refresh, profile saving, and logout against real accounts: blocked because managed authenticated checks are unavailable for this external Supabase connection.