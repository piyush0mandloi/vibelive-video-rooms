<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep video calling in a browser-effect-driven LiveKit client module; obtain development credentials with the SDK TokenSource so API secrets never enter the app.
- Keep the existing TanStack shell and write feature modules in JavaScript to preserve the platform bootstrap without rebuilding the project.
- Keep guest video rooms public and account pages under the client-only authenticated layout; every profile server function also validates the bearer independently so UI guards cannot be bypassed.
- Use one root auth subscriber and Supabase-owned sessions; profiles use owner-only RLS and signup triggers, while logout cancels and clears account queries before ending the session to prevent stale private data.
