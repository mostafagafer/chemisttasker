# Demo Mock Data Summary

## Overview
The demo now has comprehensive mock data for all user roles. Each role sees appropriate data based on their permissions.

## User Roles & Their Data

### 1. **Owner** (`OWNER`)
- **User ID**: 1
- **Email**: owner@demo.com
- **Pharmacies**: 3 pharmacies
  - Demo Pharmacy City (ID: 101) - NSW
  - Demo Pharmacy Coast (ID: 102) - QLD
  - Demo Pharmacy Suburbs (ID: 103) - VIC
- **Members**: 6 staff members across all pharmacies
- **Shifts**: All 5 shifts (can create, view, manage all shifts)
- **Dashboard Stats**:
  - Upcoming shifts: 3 open
  - Confirmed shifts: 2
  - Community shifts: 1
  - Total billed: $4,250

### 2. **Organization Admin** (`ORG_ADMIN`)
- **User ID**: 2
- **Email**: admin@demo.com
- **Organization**: Demo Organization
- **Pharmacies**: Same 3 pharmacies (organization-level access)
- **Members**: All 6 staff members
- **Shifts**: All 5 shifts (organization-wide visibility)
- **Dashboard Stats**: Same as Owner

### 3. **Pharmacist** (`PHARMACIST`)
- **User ID**: 3
- **Email**: pharmacist@demo.com
- **Employment Type**: Locum (can work at any pharmacy)
- **Visible Shifts**: Open shifts + shifts assigned to them
- **Dashboard Stats**:
  - Shows available shifts to apply
  - Confirmed shifts they're assigned to
  - Can view public and community shifts

### 4. **Other Staff** (`OTHER_STAFF`)
- **User ID**: 4
- **Email**: staff@demo.com
- **Position**: Assistant/Intern
- **Employment Type**: Internal (tied to specific pharmacy)
- **Visible Shifts**: Open shifts for their role + assigned shifts
- **Dashboard Stats**: Similar to Pharmacist but filtered by role

## Mock Members (Staff)

1. **John Smith** (ID: 11)
   - Role: Pharmacist (Locum)
   - Email: john.smith@demo.com
   - Phone: 0412 345 678
   - Status: Active, not tied to specific pharmacy

2. **Jane Williams** (ID: 12)
   - Role: Pharmacist (Internal)
   - Email: jane.williams@demo.com
   - Phone: 0423 456 789
   - Pharmacy: Demo Pharmacy City (101)

3. **Sam Johnson** (ID: 13)
   - Role: Pharmacy Assistant
   - Email: sam.johnson@demo.com
   - Phone: 0434 567 890
   - Pharmacy: Demo Pharmacy City (101)

4. **Mike Brown** (ID: 14)
   - Role: Pharmacy Intern
   - Email: mike.brown@demo.com
   - Phone: 0445 678 901
   - Pharmacy: Demo Pharmacy Coast (102)

5. **Emily Davis** (ID: 15)
   - Role: Pharmacist (Locum)
   - Email: emily.davis@demo.com
   - Phone: 0456 789 012

6. **Chris Wilson** (ID: 16)
   - Role: Pharmacy Technician
   - Email: chris.wilson@demo.com
   - Phone: 0467 890 123
   - Pharmacy: Demo Pharmacy Suburbs (103)

## Mock Shifts

1. **Shift 201** - Demo Pharmacy City
   - Date: 2026-02-15
   - Time: 09:00 - 17:00
   - Role: Pharmacist
   - Rate: $65/hr
   - Status: OPEN
   - Visibility: PUBLIC

2. **Shift 202** - Demo Pharmacy City
   - Date: 2026-02-16
   - Time: 09:00 - 17:00
   - Role: Pharmacist
   - Rate: $65/hr
   - Status: CONFIRMED
   - Worker: John Smith
   - Visibility: PUBLIC

3. **Shift 203** - Demo Pharmacy Coast
   - Date: 2026-02-17
   - Time: 10:00 - 18:00
   - Role: Pharmacist
   - Rate: $70/hr
   - Status: OPEN
   - Visibility: COMMUNITY

4. **Shift 204** - Demo Pharmacy Coast
   - Date: 2026-02-18
   - Time: 08:00 - 16:00
   - Role: Other Staff
   - Rate: $35/hr
   - Status: CONFIRMED
   - Worker: Sam Johnson
   - Visibility: PUBLIC

5. **Shift 205** - Demo Pharmacy Suburbs
   - Date: 2026-02-20
   - Time: 09:00 - 17:00
   - Role: Pharmacist
   - Rate: $68/hr
   - Status: OPEN
   - Visibility: PUBLIC

## API Coverage

The mock API intercepts:
- ✅ Authentication (login, register, OTP, password reset)
- ✅ User profile (`/users/me/`)
- ✅ Pharmacies (list, detail)
- ✅ Members/Staff (list, organization memberships)
- ✅ Shifts (all types: public, community, active, confirmed, history)
- ✅ Dashboard data (role-specific stats)
- ✅ Roster (owner and worker views)
- ✅ Notifications (empty list)
- ✅ Chat/Rooms (empty list with proper structure)
- ✅ Onboarding status

## Testing the Demo

1. **Login as Owner**: Click "Unknown Owner" button
   - See all 3 pharmacies
   - See all 6 staff members
   - See all 5 shifts

2. **Login as Org Admin**: Click "Org Admin" button
   - Same visibility as Owner
   - Organization context included

3. **Login as Pharmacist**: Click "Pharmacist" button
   - See available shifts to apply
   - See shifts you're assigned to

4. **Login as Assistant/Intern**: Click "Assistant/Intern" button
   - See shifts for support staff roles
   - Limited to relevant shifts

## Notes

- All data is stored in `demo/src/api/mock.ts`
- Mock adapters cover: axios, fetch, and apiClient
- Data persists only in browser session
- No real backend calls are made
