import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import api from './axiosInstance';
import apiClient from '../utils/apiClient';

// Initialize mock adapters (cover raw axios + app clients)
const mock = new AxiosMockAdapter(api, { delayResponse: 800 });
const mockGlobal = new AxiosMockAdapter(axios, { delayResponse: 800 });
const mockClient = new AxiosMockAdapter(apiClient, { delayResponse: 800 });
const mocks = [mock, mockGlobal, mockClient];

console.log('DEMO MODE ACTIVE: Using Mock API');

// Helper to simulate role-based data
const getDemoRole = () => localStorage.getItem('demo_role') || 'OWNER';

// --- MOCK DATA ---

const MOCK_USERS = {
    OWNER: {
        id: 1,
        username: 'owner',
        email: 'owner@demo.com',
        first_name: 'Demo',
        last_name: 'Owner',
        role: 'OWNER',
        avatar: null,
        onboarding_completed: true,
        memberships: [],
        admin_assignments: [],
    },
    ORG_ADMIN: {
        id: 2,
        username: 'orgadmin',
        email: 'admin@demo.com',
        first_name: 'Demo',
        last_name: 'Admin',
        role: 'ORG_ADMIN',
        avatar: null,
        onboarding_completed: true,
        memberships: [
            {
                organization_id: 1,
                organization_name: 'Demo Organization',
                role: 'ORG_ADMIN',
            },
        ],
        admin_assignments: [],
    },
    PHARMACIST: {
        id: 3,
        username: 'pharmacist',
        email: 'pharmacist@demo.com',
        first_name: 'Demo',
        last_name: 'Pharmacist',
        role: 'PHARMACIST',
        avatar: null,
        onboarding_completed: true,
        memberships: [],
        admin_assignments: [],
    },
    OTHER_STAFF: {
        id: 4,
        username: 'staff',
        email: 'staff@demo.com',
        first_name: 'Demo',
        last_name: 'Assistant',
        role: 'OTHER_STAFF',
        avatar: null,
        onboarding_completed: true,
        memberships: [],
        admin_assignments: [],
    },
};

const MOCK_PHARMACIES = [
    {
        id: 101,
        name: 'Demo Pharmacy City',
        address: '123 Main St, City',
        suburb: 'City Center',
        state: 'NSW',
        postcode: '2000',
        google_place_id: '123',
        phone: '(02) 1234 5678',
        email: 'city@demopharmacy.com.au',
        owner_id: 1,
        chain_id: null,
        is_active: true,
    },
    {
        id: 102,
        name: 'Demo Pharmacy Coast',
        address: '456 Beach Rd, Coast',
        suburb: 'Coastal Bay',
        state: 'QLD',
        postcode: '4000',
        google_place_id: '456',
        phone: '(07) 9876 5432',
        email: 'coast@demopharmacy.com.au',
        owner_id: 1,
        chain_id: null,
        is_active: true,
    },
    {
        id: 103,
        name: 'Demo Pharmacy Suburbs',
        address: '789 Main Ave, Suburbs',
        suburb: 'Suburban Area',
        state: 'VIC',
        postcode: '3000',
        google_place_id: '789',
        phone: '(03) 5555 1234',
        email: 'suburbs@demopharmacy.com.au',
        owner_id: 1,
        chain_id: null,
        is_active: true,
    }
];

const MOCK_MEMBERS = [
    {
        id: 11,
        user_id: 11,
        first_name: 'John',
        last_name: 'Smith',
        role: 'PHARMACIST',
        employment_type: 'LOCUM',
        email: 'john.smith@demo.com',
        phone: '0412 345 678',
        avatar: null,
        is_active: true,
        pharmacy_id: null, // Locum - not tied to one pharmacy
    },
    {
        id: 12,
        user_id: 12,
        first_name: 'Jane',
        last_name: 'Williams',
        role: 'PHARMACIST',
        employment_type: 'INTERNAL',
        email: 'jane.williams@demo.com',
        phone: '0423 456 789',
        avatar: null,
        is_active: true,
        pharmacy_id: 101, // Internal - works at City pharmacy
    },
    {
        id: 13,
        user_id: 13,
        first_name: 'Sam',
        last_name: 'Johnson',
        role: 'OTHER_STAFF',
        employment_type: 'INTERNAL',
        position: 'Pharmacy Assistant',
        email: 'sam.johnson@demo.com',
        phone: '0434 567 890',
        avatar: null,
        is_active: true,
        pharmacy_id: 101,
    },
    {
        id: 14,
        user_id: 14,
        first_name: 'Mike',
        last_name: 'Brown',
        role: 'OTHER_STAFF',
        employment_type: 'INTERN',
        position: 'Pharmacy Intern',
        email: 'mike.brown@demo.com',
        phone: '0445 678 901',
        avatar: null,
        is_active: true,
        pharmacy_id: 102,
    },
    {
        id: 15,
        user_id: 15,
        first_name: 'Emily',
        last_name: 'Davis',
        role: 'PHARMACIST',
        employment_type: 'LOCUM',
        email: 'emily.davis@demo.com',
        phone: '0456 789 012',
        avatar: null,
        is_active: true,
        pharmacy_id: null,
    },
    {
        id: 16,
        user_id: 16,
        first_name: 'Chris',
        last_name: 'Wilson',
        role: 'OTHER_STAFF',
        employment_type: 'INTERNAL',
        position: 'Pharmacy Technician',
        email: 'chris.wilson@demo.com',
        phone: '0467 890 123',
        avatar: null,
        is_active: true,
        pharmacy_id: 103,
    },
];

const MOCK_SHIFTS = {
    results: [
        {
            id: 201,
            pharmacy: MOCK_PHARMACIES[0],
            pharmacy_id: 101,
            date: '2026-02-15',
            start_time: '09:00',
            end_time: '17:00',
            status: 'OPEN',
            visibility: 'PUBLIC',
            role: 'PHARMACIST',
            rate: 65.00,
            description: 'Weekend shift - busy location',
            created_by: 1,
        },
        {
            id: 202,
            pharmacy: MOCK_PHARMACIES[0],
            pharmacy_id: 101,
            date: '2026-02-16',
            start_time: '09:00',
            end_time: '17:00',
            status: 'CONFIRMED',
            visibility: 'PUBLIC',
            role: 'PHARMACIST',
            rate: 65.00,
            worker: MOCK_MEMBERS[0],
            worker_id: 11,
            description: 'Weekend shift',
            created_by: 1,
        },
        {
            id: 203,
            pharmacy: MOCK_PHARMACIES[1],
            pharmacy_id: 102,
            date: '2026-02-17',
            start_time: '10:00',
            end_time: '18:00',
            status: 'OPEN',
            visibility: 'COMMUNITY',
            role: 'PHARMACIST',
            rate: 70.00,
            description: 'Coastal location - flexible hours',
            created_by: 1,
        },
        {
            id: 204,
            pharmacy: MOCK_PHARMACIES[1],
            pharmacy_id: 102,
            date: '2026-02-18',
            start_time: '08:00',
            end_time: '16:00',
            status: 'CONFIRMED',
            visibility: 'PUBLIC',
            role: 'OTHER_STAFF',
            rate: 35.00,
            worker: MOCK_MEMBERS[2],
            worker_id: 13,
            description: 'Assistant needed',
            created_by: 1,
        },
        {
            id: 205,
            pharmacy: MOCK_PHARMACIES[2],
            pharmacy_id: 103,
            date: '2026-02-20',
            start_time: '09:00',
            end_time: '17:00',
            status: 'OPEN',
            visibility: 'PUBLIC',
            role: 'PHARMACIST',
            rate: 68.00,
            description: 'Suburban pharmacy - regular clientele',
            created_by: 1,
        },
    ],
    count: 5
};

const buildDemoUser = () => {
    const roleKey = getDemoRole();
    return MOCK_USERS[roleKey as keyof typeof MOCK_USERS] || MOCK_USERS.OWNER;
};

const buildAuthPayload = () => ({
    access: 'demo-access-token',
    refresh: 'demo-refresh-token',
    user: buildDemoUser(),
});

const buildDashboardPayload = () => {
    const user = buildDemoUser();
    const roleKey = getDemoRole();

    // Filter shifts based on role
    let userShifts = MOCK_SHIFTS.results;
    if (roleKey === 'PHARMACIST' || roleKey === 'OTHER_STAFF') {
        // Workers see shifts they can apply to or are assigned to
        userShifts = MOCK_SHIFTS.results.filter(s =>
            s.status === 'OPEN' || s.worker_id === user.id
        );
    }

    const confirmedCount = userShifts.filter(s => s.status === 'CONFIRMED').length;
    const openCount = userShifts.filter(s => s.status === 'OPEN').length;

    return {
        user,
        message: 'Demo dashboard',
        upcoming_shifts_count: openCount,
        confirmed_shifts_count: confirmedCount,
        community_shifts_count: MOCK_SHIFTS.results.filter(s => s.visibility === 'COMMUNITY').length,
        shifts: userShifts.slice(0, 5), // Recent 5 shifts
        bills_summary: { points: '150', total_billed: '$4,250' },
    };
};

const buildOnboardingPayload = () => ({
    progress_percent: 0,
    verified: true,
    is_verified: true,
    isVerified: true,
});

const buildPaginated = (results: any[] = []) => ({
    count: results.length,
    next: null,
    previous: null,
    results,
});

const buildRoomDetail = (id: number) => ({
    id,
    type: 'dm',
    title: 'Demo chat',
    pharmacy: null,
    unread_count: 0,
    updated_at: new Date().toISOString(),
    last_message: null,
    participant_ids: [],
    my_membership_id: null,
    is_pinned: false,
});

// --- AUTH HANDLERS ---
const registerAuthMocks = (mockInstance: AxiosMockAdapter) => {
    mockInstance.onPost(/\/users\/login\/?/).reply(() => [200, buildAuthPayload()]);
    mockInstance.onPost(/\/users\/token\/refresh\/?/).reply(200, {
        access: 'demo-access-token-refreshed',
        refresh: 'demo-refresh-token-refreshed',
    });
    mockInstance.onPost(/\/users\/register\/?/).reply(() => [200, buildAuthPayload()]);
    mockInstance.onPost(/\/users\/verify-otp\/?/).reply(200, { detail: 'OTP verified' });
    mockInstance.onPost(/\/users\/resend-otp\/?/).reply(200, { detail: 'OTP sent' });
    mockInstance.onPost(/\/users\/mobile\/request-otp\/?/).reply(200, { detail: 'OTP sent' });
    mockInstance.onPost(/\/users\/mobile\/verify-otp\/?/).reply(200, { detail: 'OTP verified' });
    mockInstance.onPost(/\/users\/mobile\/resend-otp\/?/).reply(200, { detail: 'OTP sent' });
    mockInstance.onPost(/\/users\/password-reset\/?/).reply(200, { detail: 'Password reset email sent' });
    mockInstance.onPost(/\/users\/password-reset-confirm\/?/).reply(200, { detail: 'Password reset' });

    // Legacy auth routes still used in older flows.
    mockInstance.onPost(/\/api\/auth\/jwt\/create\/?/).reply(() => [200, {
        access: 'demo-access-token',
        refresh: 'demo-refresh-token',
    }]);
    mockInstance.onPost(/\/api\/auth\/jwt\/refresh\/?/).reply(200, {
        access: 'demo-access-token-refreshed',
        refresh: 'demo-refresh-token-refreshed',
    });
    mockInstance.onGet(/\/api\/auth\/users\/me\/?/).reply(() => [200, buildDemoUser()]);

    // --- DASHBOARD / GENERAL HANDLERS ---
    // Pharmacies
    mockInstance.onGet(/\/api\/organization\/pharmacies\/?/).reply(200, MOCK_PHARMACIES);
    mockInstance.onGet(/\/api\/pharmacies\/?/).reply(200, MOCK_PHARMACIES);
    mockInstance.onGet(/\/client-profile\/pharmacies\/?/).reply(200, buildPaginated(MOCK_PHARMACIES));

    // Members
    mockInstance.onGet(/\/api\/organization\/members\/?/).reply(200, buildPaginated(MOCK_MEMBERS));
    mockInstance.onGet(/\/api\/users\/?/).reply(200, buildPaginated(MOCK_MEMBERS));
    mockInstance.onGet(/\/users\/?/).reply(200, buildPaginated(MOCK_MEMBERS));
    mockInstance.onGet(/\/client-profile\/memberships\/?/).reply(200, buildPaginated(MOCK_MEMBERS));
    mockInstance.onGet(/\/client-profile\/organization-memberships\/?/).reply(200, buildPaginated(MOCK_MEMBERS));

    // Shifts
    mockInstance.onGet(/\/api\/shifts\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/api\/roster\/?/).reply(200, MOCK_SHIFTS.results);
    mockInstance.onGet(/\/client-profile\/public-job-board\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/community-shifts\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/public-shifts\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/shifts\/active\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/shifts\/confirmed\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/shifts\/history\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/my-confirmed-shifts\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/my-history-shifts\/?/).reply(200, MOCK_SHIFTS);
    mockInstance.onGet(/\/client-profile\/roster-owner\/?/).reply(200, MOCK_SHIFTS.results);
    mockInstance.onGet(/\/client-profile\/roster-worker\/?/).reply(200, MOCK_SHIFTS.results);
};

mocks.forEach(registerAuthMocks);

const fetchPatchKey = '__ctDemoFetchPatched__';

if (!(globalThis as any)[fetchPatchKey]) {
    (globalThis as any)[fetchPatchKey] = true;

    const originalFetch = globalThis.fetch.bind(globalThis);
    const baseUrlRaw = import.meta.env.VITE_API_URL || '';
    const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw;

    const jsonResponse = (data: any, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }));

    const emptyList = () => buildPaginated([]);

    const normalizePath = (url: string) => {
        if (!baseUrl || !url.startsWith(baseUrl)) return null;
        const relative = url.slice(baseUrl.length);
        return relative || '/';
    };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
        const path = normalizePath(url);
        if (!path) {
            return originalFetch(input, init);
        }

        const method = (init?.method || (typeof input !== 'string' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();

        if (path.startsWith('/users/login/')) {
            return jsonResponse(buildAuthPayload());
        }
        if (path.startsWith('/users/register/')) {
            return jsonResponse(buildAuthPayload());
        }
        if (path.startsWith('/users/token/refresh/')) {
            return jsonResponse({
                access: 'demo-access-token-refreshed',
                refresh: 'demo-refresh-token-refreshed',
            });
        }
        if (path.startsWith('/users/me/')) {
            return jsonResponse(buildDemoUser());
        }
        if (path.startsWith('/users/verify-otp/')) {
            return jsonResponse({ detail: 'OTP verified' });
        }
        if (path.startsWith('/users/resend-otp/')) {
            return jsonResponse({ detail: 'OTP sent' });
        }
        if (path.startsWith('/users/mobile/request-otp/')) {
            return jsonResponse({ detail: 'OTP sent' });
        }
        if (path.startsWith('/users/mobile/verify-otp/')) {
            return jsonResponse({ detail: 'OTP verified' });
        }
        if (path.startsWith('/users/mobile/resend-otp/')) {
            return jsonResponse({ detail: 'OTP sent' });
        }
        if (path.startsWith('/users/password-reset/')) {
            return jsonResponse({ detail: 'Password reset email sent' });
        }
        if (path.startsWith('/users/password-reset-confirm/')) {
            return jsonResponse({ detail: 'Password reset' });
        }

        if (path.startsWith('/client-profile/notifications/')) {
            if (path.includes('/mark-read/')) {
                return jsonResponse({ detail: 'Notifications marked' });
            }
            return jsonResponse(emptyList());
        }

        if (path.startsWith('/client-profile/rooms/')) {
            if (path.endsWith('/messages/')) {
                if (method === 'POST') {
                    return jsonResponse({
                        id: 1,
                        conversation: 1,
                        sender: {
                            id: buildDemoUser().id,
                            user_details: {
                                email: buildDemoUser().email,
                                first_name: buildDemoUser().first_name,
                                last_name: buildDemoUser().last_name,
                            },
                            pharmacy: null,
                        },
                        body: 'Demo message',
                        attachment_url: null,
                        created_at: new Date().toISOString(),
                        is_deleted: false,
                        is_edited: false,
                        original_body: null,
                        reactions: [],
                        attachment_filename: null,
                        is_pinned: false,
                    });
                }
                return jsonResponse({ results: [], next: null });
            }
            if (path === '/client-profile/rooms/') {
                return jsonResponse(emptyList());
            }
            if (path.endsWith('/read/')) {
                return jsonResponse({ last_read_at: new Date().toISOString() });
            }
            if (path.includes('/get-or-create-dm') || path.includes('/get-or-create-group')) {
                return jsonResponse(buildRoomDetail(1));
            }
            const roomMatch = path.match(/\/client-profile\/rooms\/(\d+)\//);
            if (roomMatch) {
                return jsonResponse(buildRoomDetail(Number(roomMatch[1])));
            }
            return jsonResponse(emptyList());
        }

        if (path.startsWith('/client-profile/chat-participants/')) {
            return jsonResponse(emptyList());
        }

        if (path.includes('/onboarding/me/')) {
            return jsonResponse(buildOnboardingPayload());
        }

        if (path.startsWith('/client-profile/dashboard/')) {
            return jsonResponse(buildDashboardPayload());
        }

        if (path.startsWith('/client-profile/pharmacies/')) {
            const match = path.match(/\/client-profile\/pharmacies\/(\d+)\//);
            if (match) {
                const pharmacyId = Number(match[1]);
                const pharmacy = MOCK_PHARMACIES.find((item) => item.id === pharmacyId) || MOCK_PHARMACIES[0];
                return jsonResponse(pharmacy);
            }
            return jsonResponse(buildPaginated(MOCK_PHARMACIES));
        }

        if (path.startsWith('/client-profile/organizations/')) {
            return jsonResponse(buildPaginated([{ id: 1, name: 'Demo Organization' }]));
        }

        if (path.startsWith('/client-profile/public-job-board/')) {
            return jsonResponse(MOCK_SHIFTS);
        }
        if (path.startsWith('/client-profile/community-shifts/')) {
            return jsonResponse(MOCK_SHIFTS);
        }
        if (path.startsWith('/client-profile/public-shifts/')) {
            return jsonResponse(MOCK_SHIFTS);
        }
        if (path.startsWith('/client-profile/shifts/')) {
            return jsonResponse(MOCK_SHIFTS);
        }

        if (method === 'GET') {
            return jsonResponse(emptyList());
        }
        if (method === 'DELETE') {
            return Promise.resolve(new Response(null, { status: 204 }));
        }
        return jsonResponse({});
    };
}

export default mock;
