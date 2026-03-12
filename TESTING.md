# Hundkrets E2E Testing Document

This document outlines all major user flows that must be tested using Playwright.

## Prerequisites

- PocketBase running on `http://127.0.0.1:8090`
- Test database with clean state or test fixtures
- App running on `http://localhost:3000` (or configured VITE_SITE_URL)

## Test Accounts

Create test accounts for testing:
- `test-user@example.com` / `password123` - Regular user with dogs
- `test-sitter@example.com` / `password123` - Sitter-only user
- `test-receiver@example.com` / `password123` - Receiver-only user

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