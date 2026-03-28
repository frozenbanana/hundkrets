# Hundkrets E2E Testing Document

This document outlines all major user flows that must be tested using Playwright.

## Prerequisites

- PocketBase running on `http://127.0.0.1:8090`
- Test database with clean state or test fixtures
- App running on `http://localhost:3000` (or configured VITE_SITE_URL)

## Test Accounts

Default test data comes from `./scripts/reset-and-seed.sh`:
- `anna.malmo@example.com` / `password123!` - Regular user with dogs
- `erik.malmo@example.com` / `password123!` - Seeded Malmö user
- `sofia.malmo@example.com` / `password123!` - Seeded Malmö user

If you prefer custom fixtures (for example `test-user@example.com`), create them explicitly before running the suite.

---

## 1. Authentication Flows

### 1.1 User Registration
**Path:** `/register`

**Steps:**
1. Navigate to `/register`
2. Enter email address
3. Enter password (min 8 characters)
4. Enter password confirmation
5. Click "Skapa konto"
6. Verify redirect to onboarding

**Validations:**
- Email validation (must be valid format)
- Password validation (min 8 characters)
- Password match validation
- Error messages display correctly
- Successful registration redirects to `/onboarding/choice`

### 1.2 User Login
**Path:** `/login`

**Steps:**
1. Navigate to `/login`
2. Enter email
3. Enter password
4. Click "Logga in"

**Validations:**
- Error message for invalid credentials
- Successful login redirects to `/app/explore` (if onboarding complete) or `/onboarding/choice`
- "Glömt lösenord?" link works

### 1.3 Password Reset
**Path:** `/forgot-password`

**Steps:**
1. Navigate to `/forgot-password`
2. Enter email
3. Submit form
4. Verify success message

### 1.4 Google OAuth
**Path:** `/login` or `/register`

**Steps:**
1. Click "Fortsätt med Google"
2. Complete Google OAuth flow
3. Verify redirect to appropriate page

---

## 2. Onboarding Flows

### 2.1 User Type Selection
**Path:** `/onboarding/choice`

**Steps:**
1. After registration, verify redirect to choice page
2. Test all three options:
   - "Byta hundpassning" (has_dogs) → redirects to `/onboarding/profile`
   - "Endast ta emot passning" (receiver_only) → redirects to `/onboarding/profile`
   - "Endast passa hundar" (sitter_only) → redirects to `/onboarding/profile`

**Validations:**
- All three buttons are clickable
- Correct redirect based on selection
- User type is stored correctly

### 2.2 Profile Setup
**Path:** `/onboarding/profile`

**Steps:**
1. Enter name (required)
2. Enter postal code (required, must geocode)
3. Enter city (required)
4. Optionally add phone, bio, avatar, breeds owned
5. Click "Spara och fortsätt"

**Validations:**
- Name is required
- Postal code must be valid Swedish format (5 digits)
- Geocoding works for valid postal codes
- Avatar upload works (image capture or file select)
- Successful save redirects to dogs (has_dogs/receiver_only) or capacity (sitter_only)

### 2.3 Dog Registration
**Path:** `/onboarding/dogs`

**Steps:**
1. Enter dog name (required)
2. Optionally upload photo
3. Enter breed
4. Select size (required: small/medium/large)
5. Select gender (required: male/female)
6. Enter age
7. Select temperaments (new people, new dogs female, new dogs male)
8. Enter notes
9. Click "Lägg till nästa hund" to add another, or "Spara och fortsätt" to continue

**Validations:**
- Name is required
- Size and gender have defaults
- Photo upload works
- Multiple dogs can be added
- "Skippa" skips to needs
- Redirects to `/onboarding/needs`

### 2.4 Needs Creation (Onboarding)
**Path:** `/onboarding/needs`

**Steps:**
1. Select dogs (checkboxes, at least one required if dogs exist)
2. Toggle "Datum: Flexibel/Specifik"
   - If specific: enter start and end dates
3. Toggle "Tid: Flexibel/Specifik"
   - If specific: enter duration description
4. Enter notes
5. Click "Spara och fortsätt"

**Validations:**
- At least one dog must be selected (if dogs exist)
- Date validation: end date must be after start date
- Flexible toggle shows/hides date fields correctly
- Duration toggle shows/hides textarea correctly
- Redirects to `/onboarding/capacity` (has_dogs) or `/app/explore` (receiver_only)

### 2.5 Capacity Creation (Onboarding)
**Path:** `/onboarding/capacity`

**Steps:**
1. Toggle "Datum: Flexibel/Specifik"
   - If specific: enter start and end dates
2. Toggle "Tid: Flexibel/Specifik"
   - If specific: enter duration description
3. Select dog sizes (at least one required)
4. Select dog gender preference
5. Enter max dogs
6. Enter notes
7. Click "Spara och fortsätt"

**Validations:**
- At least one dog size must be selected
- Date validation: end date must be after start date
- Redirects to `/app/explore`

---

## 3. App - Dogs Management

### 3.1 View Dogs List
**Path:** `/app/dogs`

**Steps:**
1. Navigate to `/app/dogs`
2. Verify list of dogs displays correctly

**Validations:**
- Dogs are displayed with name, age, breed, gender
- Dog images display correctly
- Empty state shows if no dogs

### 3.2 Add New Dog
**Path:** `/app/dogs/new`

**Steps:**
1. Click "Lägg till hund" from dogs list
2. Fill in dog details (same as onboarding)
3. Submit form

**Validations:**
- Form validation works
- Success toast shows "Hund tillagd"
- Redirects back to `/app/dogs`
- New dog appears in list

### 3.3 Edit Dog
**Path:** `/app/dogs/edit/[id]`

**Steps:**
1. Click on a dog from the list
2. Modify details
3. Save changes

**Validations:**
- Existing values pre-populate form
- Changes save correctly
- Success toast shows

---

## 4. App - Needs Management

### 4.1 View Needs List
**Path:** `/app/needs`

**Steps:**
1. Navigate to `/app/needs`
2. Verify list of needs displays

**Validations:**
- Needs show dog names, dates, duration info
- Empty state shows if no needs

### 4.2 Add New Need
**Path:** `/app/needs/new`

**Steps:**
1. Click "Lägg till behov"
2. Select dogs (multi-select)
3. Configure dates and duration
4. Submit

**Validations:**
- At least one dog required
- Date validation works
- Success toast shows "Behov tillagt"
- Redirects to `/app/needs`

### 4.3 Edit Need
**Path:** `/app/needs/edit/[id]`

**Steps:**
1. Click on a need from list
2. Modify details
3. Save changes

**Validations:**
- Existing values pre-populate
- Changes save correctly

---

## 5. App - Capacity Management

### 5.1 View Capacity List
**Path:** `/app/capacity`

**Steps:**
1. Navigate to `/app/capacity`
2. Verify list displays

### 5.2 Add New Capacity
**Path:** `/app/capacity/new`

**Steps:**
1. Click "Lägg till kapacitet"
2. Configure dates, duration, dog preferences
3. Submit

**Validations:**
- At least one dog size required
- Success toast shows
- Redirects to `/app/capacity`

### 5.3 Edit Capacity
**Path:** `/app/capacity/edit/[id]`

**Steps:**
1. Click on capacity from list
2. Modify details
3. Save

---

## 6. App - Explore/Matches

### 6.1 View Matches
**Path:** `/app/explore`

**Steps:**
1. Navigate to `/app/explore`
2. Verify matches list displays

**Validations:**
- Shows users with matching needs/capacities
- Distance displayed correctly
- User cards show relevant info

### 6.2 Filter Matches
**Steps:**
1. Click filter tabs: "Alla", "Matchade", "Tillgängliga", "Skickade", "Mottagna"
2. Verify list updates

**Validations:**
- Filter tabs work correctly
- Counts update correctly
- Badge shows for new received requests

### 6.3 Send Interest Request
**Steps:**
1. Click "Jag är intresserad" on a user card
2. Optionally add message
3. Submit

**Validations:**
- Modal opens correctly
- Message field works
- Success toast shows "Intresse skickat"
- User moves to "Skickade" tab

### 6.4 Respond to Interest Request
**Steps:**
1. Navigate to "Mottagna" tab
2. Click "Svara" on a request
3. Accept or reject

**Validations:**
- Accept creates mutual match
- Reject removes request
- Success/error toasts show

### 6.5 Open Chat
**Steps:**
1. On a matched user, click chat button
2. Verify chat opens

**Validations:**
- Chat page loads correctly
- Messages can be sent

### 6.6 View User Profile
**Steps:**
1. Click on user card
2. Verify profile page shows dogs, needs, capacity

---

## 7. App - Profile

### 7.1 View Own Profile
**Path:** `/app/profile`

**Steps:**
1. Navigate to `/app/profile`
2. Verify profile displays

**Validations:**
- Name, city, neighborhood shown
- Dogs listed
- Needs and capacity shown

### 7.2 Edit Profile
**Path:** `/app/profile/edit`

**Steps:**
1. Click edit button
2. Modify name, phone, bio, etc.
3. Save changes

---

## 8. App - Settings

### 8.1 View Settings
**Path:** `/app/settings`

**Steps:**
1. Navigate to `/app/settings`
2. Verify settings form displays

### 8.2 Update Settings
**Steps:**
1. Modify profile settings
2. Save

### 8.3 Logout
**Steps:**
1. Click logout button
2. Verify redirect to `/login`

---

## 9. Navigation & Shell

### 9.1 App Shell Navigation
**Steps:**
1. Verify bottom navigation on mobile
2. Verify sidebar on desktop
3. Test all nav links: Utforska, Behov, Kapacitet, Hundar, Profil

### 9.2 Protected Routes
**Steps:**
1. Try accessing `/app/*` routes without auth
2. Verify redirect to `/login`

---

## 10. Edge Cases

### 10.1 Cancelled Onboarding
**Steps:**
1. Start onboarding
2. Cancel/navigate away
3. Return to app
4. Verify can continue or restart

### 10.2 Multi-Dog Selection
**Steps:**
1. Create need with multiple dogs selected
2. Verify all dogs appear in need display
3. Edit need, change selection
4. Verify changes saved

### 10.3 Empty States
**Steps:**
1. New user with no dogs/needs/capacity
2. Verify appropriate empty state messages
3. Verify correct CTAs based on user type

---

## 11. App - Hundträffar & Public Share

### 11.1 Hundträffar list page structure
**Path:** `/app/excursions`

**Steps:**
1. Log in as a user with own upcoming, own past, and other upcoming hundträffar
2. Open `/app/excursions`
3. Verify header button `+ Ny hundträff` exists and links to `/app/excursions/create`
4. Verify three sections are rendered:
   - `Mina uppkommande hundträffar`
   - `Kommande hundträffar`
   - `Mina passerade hundträffar`

**Validations:**
- Own cards in upcoming/past show inline `Redigera`
- `datum`, `visibilitet`, and `Redigera` are on the same row
- Empty states show correct Swedish copy

### 11.2 Create hundträff page and form behavior
**Path:** `/app/excursions/create`

**Steps:**
1. Click `+ Ny hundträff`
2. Verify dedicated create page loads (not inline form on index)
3. Fill title, meeting point, date/time, duration, visibility
4. Submit and verify redirect back to list/detail
5. Re-open create page and verify `Tillbaka` returns to `/app/excursions`
6. Toggle `Dela med dig av ditt telefonnummer för de som kommer`
7. If profile phone is empty: enter phone in form and submit

**Validations:**
- Create form saves successfully
- Form fields validate and show errors when required fields are missing
- If phone-sharing is enabled and profile phone is missing, entered phone is saved to profile on submit

### 11.3 Edit hundträff uses same form + manual title persistence
**Path:** `/app/excursions/:id/edit`

**Steps:**
1. Open own hundträff and click `Redigera`
2. Verify edit page has `Tillbaka` button in top right
3. Open custom title modal, enter a custom title, save
4. Change another field and submit
5. Re-open edited hundträff

**Validations:**
- Same form UI/behavior as create page
- Existing values are pre-populated
- Manually entered title is persisted after save

### 11.4 Hundträff detail page for host and logged-in user
**Path:** `/app/excursions/:id`

**Steps:**
1. Open own hundträff detail page
2. Verify `Redigera` button is visible in header
3. Verify map block contains Google Maps icon + directions + share icon
4. Click share icon

**Validations:**
- Host ser inte `Delta` på egen hundträff (är redan deltagare)
- Share uses native share when available, else copies link
- Toast confirms success (`Delat!` or `Länk kopierad!`)

### 11.5 Explore mode switch: medlemmar vs hundträffar
**Path:** `/app/explore`

**Steps:**
1. Toggle mode next to `Utforska` between `medlemmar` and `hundträffar`
2. In hundträffar mode, verify map renders brown points for upcoming hundträffar
3. Pan/zoom map and confirm list updates by bounds
4. Toggle visibility filters (`public`, `matched_only`, `interested_by_me`)
5. Toggle duration filters (1,2,3,4,6,8h)

**Validations:**
- URL keeps `utforsk` state
- Desktop cards in hundträffar mode hide mini map thumbnail
- Empty state appears when filters produce no results

### 11.6 Public shared hundträff (guest)
**Path:** `/app/excursions/:id` (public excursion), while logged out

**Steps:**
1. Log out completely (or open in incognito)
2. Open direct detail URL to a public hundträff
3. Verify page loads without redirect to `/login`
4. Verify guest navbar actions (`Logga in`, `Skapa konto`) are shown instead of `Logga ut`
5. Verify interest/comment actions are replaced with guest CTA

**Validations:**
- Guest sees detail content (title, place, date, map, description)
- Interest CTA text: `Skapa konto för att delta` + button `Skapa konto`
- Comment CTA blocks writing comments and prompts sign-up
- Share icon is available and copies/shares current URL

---

## Running Tests

```bash
# Install Playwright
npm install -D @playwright/test

# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run with UI mode
npx playwright test --ui
```

## Test Data Setup

Before running tests, ensure:
1. PocketBase is running
2. Test users exist
3. Database is in clean state (or use fixtures)