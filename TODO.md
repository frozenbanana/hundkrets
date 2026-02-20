# Hundkrets TODO


Here’s a prioritized UX improvement list from the perspective of a dog owner or someone who wants to dog-sit:

---

# Prioritized UX Improvements for Hundkrets

## DONE P0 – Critical (blocks core flows)

### 1. **Fix incoming connection flow**
When someone sends you an interest request, you can only **Avvisa** (reject). To accept, you must go to Matches and click "Jag är intresserad" on them, which is unclear and feels backwards.

**Change:** Add an **Acceptera** (Accept) button for incoming requests on the dashboard so you can match directly from there.

---

### 2. **Add management for needs and capacity**
You can only *add* needs and capacity. There is no way to view, edit, or delete existing ones. Users can’t see what they’ve added or update dates.

**Change:** Add `/app/needs` and `/app/capacity` list pages with edit/delete, and update nav to point to these overview pages instead of only the “add” forms.

---

### 3. **Language consistency**
UI mixes Swedish and English (e.g. "Profile" vs "Profil", "Log in" vs "Logga in", "Add dog" vs "Lägg till hund", "Password" vs "Lösenord").

**Change:** Use Swedish consistently across login, register, onboarding, profile, and error messages.

---

## DONE P1 – High impact

### 4. ~~**Clarify onboarding for “dog sitter only”**
The flow supports people without dogs (they can skip dogs and needs), but the wording and structure don’t make that clear.

**Change:** Add a short choice at the start: “Jag har hund/hundar” vs “Jag vill bara passa hundar”. Adjust steps and copy so sitter-only users see a simpler path (profile → capacity).

---

### 5. ~~**Simplify onboarding dogs step**~~ DONE
“Continue” and “Skip for now” both go to the same step, which is confusing.

**Change:** Use a single primary action (e.g. “Fortsätt”) and make it clear that adding dogs is optional. Add “Lägg till fler hundar” for multiple dogs before continuing.

---

### 6. ~~**Improve mobile navigation**~~ DONE
The top nav has many links and can overflow on small screens.

**Change:** Add a hamburger menu or bottom tab bar for mobile so navigation stays usable.

---

### 7. ~~**Improve empty state when profile is incomplete**~~ DONE
If the user has no address or profile picture, matches show “Ange din adress i profilen” but the flow to fix it isn’t obvious.

**Change:** Make the link more prominent, add a short explanation of why the address (or whatever is missing) matters, and optionally show a checklist of missing profile fields.

---

## P2 – Medium impact

### 8. **Explain the matching model**
It’s not obvious that matches are based on complementary needs and capacity (e.g. you need sitting when they can offer it, and vice versa).

**Change:** Add a short explanation on the matches page or in a tooltip: “Du ser personer som har behov eller kapacitet som matchar dina.”


---

### 10. **Improve “Mina behov” / “Min kapacitet” nav labels**
These currently link straight to “add” forms, which suggests you can only add, not manage.

**Change:** Rename to something like “Behov” / “Kapacitet” and link to the overview pages, with a clear “Lägg till” action there.

---

### 11. **Make match cards easier to scan**
Match cards show a lot of text; key info (location, dates, dog details) can be hard to scan.

**Change:** Use clearer typography hierarchy, small labels, and optional expand/collapse for long content.

---

## P3 – Nice to have

### 12. **Add confirmation before unmatching**
“Avmatcha” has no confirmation, so it’s easy to unmatch by mistake.

**Change:** Add a confirmation dialog: “Är du säker? Ni kommer inte längre se varandras kontaktuppgifter.”

---

### 13. **Improve address input**
Swedish address input works but requires 3+ characters and can feel slow.

**Change:** Add clearer placeholder text, loading states, and maybe a “Use my location” option if appropriate.

---

### 14. **Add success feedback**
After actions like “Intresse skickat” or “Profil sparad”, feedback is minimal.

**Change:** Add brief success messages (e.g. toast or inline) so users know the action worked.

---

### 15. **Landing page value proposition**
The landing page is clear, but the benefit for people who only want to dog-sit could be stronger.

**Change:** Add a short line like “Även om du inte har hund – passa andras hundar och bygg upp kredibilitet för framtida utbyten.”

---

## Summary table

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Fix incoming connection flow (add Accept button) | Small |
| P0 | Add needs/capacity list + edit/delete | Medium |
| P0 | Full Swedish localization | Medium |
| P1 | Clarify “sitter only” onboarding path | Small |
| P1 | Simplify dogs step (remove redundant buttons) | Small |
| P1 | Mobile-friendly navigation | Medium |
| P1 | Better empty state for incomplete profile | Small |
| P2 | Explain matching logic | Small |
| P2 | Connection request indicator | Small |
| P2 | Rename nav to overview pages | Small |
| P2 | Improve match card scannability | Medium |
| P3 | Unmatch confirmation | Small |
| P3 | Address input polish | Small |
| P3 | Success feedback (toasts) | Small |
| P3 | Sitter-only value on landing | Small |

---

**Suggested order to implement:** Start with P0 items (especially the incoming connection flow and needs/capacity management), then move through P1 for the biggest UX gains.