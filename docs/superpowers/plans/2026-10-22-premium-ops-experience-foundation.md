# Premium OPS Experience Foundation Plan

1. **Audit and lock boundaries**
   - Inspect the shell, shared components, dashboard and module fetch architecture.
   - Record unsupported features that must not be represented by fake controls.
   - Run the full gate after the completed slice.
2. **Create shared visual and motion foundations**
   - Extend neutral tokens with radii, shadows, timings and easing.
   - Add reduced-motion behavior, page entrance and skeleton utilities.
   - Add a reusable OPS panel primitive and refine shared Button and StatCard states.
   - Run the full gate after the completed slice.
3. **Rebuild the stable application shell**
   - Add a client shell with persisted sidebar state and route-content transitions.
   - Make navigation accessible in expanded, collapsed and narrow layouts.
   - Preserve authentication and logout behavior.
   - Run the full gate after the completed slice.
4. **Implement authenticated global search**
   - Add a pure record-shaping search model and admin-gated route handler.
   - Add command-palette interaction, grouped results, keyboard navigation, loading, empty and error
     states, plus working quick actions.
   - Add unit and route tests.
   - Run the full gate after the completed slice.
5. **Refine the Command Center**
   - Use the authenticated name and Johannesburg time for the greeting.
   - Apply the premium panel/card treatment.
   - Add real client-side queue filters and pipeline affordances.
   - Add component and pure-function tests.
   - Run the full gate after the completed slice.
6. **Final review**
   - Compare behavior to the approved screenshot and specification.
   - Confirm no invented controls or data were introduced.
   - Run `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
