# client_profile/views.py
from rest_framework import generics, permissions, status
# from .models import PharmacistOnboarding
from .serializers import *
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS
from rest_framework.generics import CreateAPIView, RetrieveUpdateAPIView
from rest_framework.exceptions import NotFound
from rest_framework import viewsets
from rest_framework.decorators import action
from .models import *
from datetime import date
from users.permissions import *
from users.serializers import (
    UserProfileSerializer,
)
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser, FormParser

from django.db.models import Q, Count, F
from django.utils import timezone
from client_profile.services import get_locked_rate_for_slot

# Onboardings
class OrganizationViewSet(viewsets.ModelViewSet):
    """
    CRUD for corporate Organizations.
     - LIST/RETRIEVE: any authenticated user
     - CREATE: superusers only
     - UPDATE/DELETE: only ORG_ADMIN of that org
    """
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        if self.action == 'create':
            return [permissions.IsAdminUser()]
        # update, partial_update, destroy
        self.required_roles = ['ORG_ADMIN']
        return [permissions.IsAuthenticated(), OrganizationRolePermission()]

class OwnerOnboardingCreate(generics.CreateAPIView):
    serializer_class = OwnerOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def perform_create(self, serializer):
        serializer.save()
   
class OwnerOnboardingDetail(generics.RetrieveUpdateAPIView):
    serializer_class   = OwnerOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_object(self):
        try:
            return OwnerOnboarding.objects.get(user=self.request.user)
        except OwnerOnboarding.DoesNotExist:
            raise NotFound("Owner onboarding profile not found.")

class OwnerOnboardingClaim(APIView):
    """
    Only ORG_ADMIN of that org may claim an OwnerOnboarding by email.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # 1) Make sure the user is an ORG_ADMIN somewhere
        if not request.user.organization_memberships.filter(role='ORG_ADMIN').exists():
            return Response(
                {'detail': 'Not an Org-Admin.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2) Pull the email payload
        email = request.data.get('email')
        if not email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3) Look up the onboarding record
        try:
            onboarding = OwnerOnboarding.objects.get(user__email=email)
        except OwnerOnboarding.DoesNotExist:
            return Response(
                {'detail': 'No onboarding profile found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 4) Grab the admin’s own org
        membership = request.user.organization_memberships.filter(
            role='ORG_ADMIN'
        ).first()
        org = membership.organization

        # 5) Claim it
        onboarding.organization = org
        onboarding.organization_claimed = True
        onboarding.save(update_fields=['organization', 'organization_claimed'])

        # 6) Return the updated record
        return Response(
            OwnerOnboardingSerializer(onboarding).data,
            status=status.HTTP_200_OK
        )

class PharmacistOnboardingCreateView(CreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class   = PharmacistOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def perform_create(self, serializer):
        serializer.save()

class PharmacistOnboardingDetailView(RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class   = PharmacistOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get_object(self):
        try:
            return PharmacistOnboarding.objects.get(user=self.request.user)
        except PharmacistOnboarding.DoesNotExist:
            raise NotFound("Pharmacist onboarding profile not found.")

class OtherStaffOnboardingCreateView(CreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = OtherStaffOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsOtherstaff]

    def perform_create(self, serializer):
        serializer.save()

class OtherStaffOnboardingDetailView(RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = OtherStaffOnboardingSerializer
    permission_classes = [IsAuthenticated, IsOtherstaff]

    def get_object(self):
        try:
            return OtherStaffOnboarding.objects.get(user=self.request.user)
        except OtherStaffOnboarding.DoesNotExist:
            raise NotFound("Onboarding profile not found for this user.")

class ExplorerOnboardingCreateView(CreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ExplorerOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsExplorer]

    def perform_create(self, serializer):
        serializer.save()

class ExplorerOnboardingDetailView(RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ExplorerOnboardingSerializer
    permission_classes = [IsAuthenticated, IsExplorer]

    def get_object(self):
        try:
            return ExplorerOnboarding.objects.get(user=self.request.user)
        except ExplorerOnboarding.DoesNotExist:
            raise NotFound("Onboarding profile not found for this user.")


# Dashboards
class OrganizationDashboardView(APIView):
    """
    Any org-level member may view this dashboard.
    """
    required_roles     = ['ORG_ADMIN', 'REGION_ADMIN', 'SHIFT_MANAGER']
    permission_classes = [permissions.IsAuthenticated, OrganizationRolePermission]

    def get(self, request, organization_pk):
        # pick the first membership with one of the allowed roles
        membership = request.user.organization_memberships.filter(
            role__in=self.required_roles
        ).first()
        org = membership.organization

        # 1) claimed owners, annotated with their pharmacy count
        claimed_qs = OwnerOnboarding.objects.filter(
            organization=org,
            organization_claimed=True
        ).annotate(
            pharmacies_count=Count('pharmacies')   # ← use your actual related_name here
        )

        claimed_data = [
            {
                'id':               o.id,
                'username':         o.username,
                'phone_number':     o.phone_number,
                'pharmacies_count': o.pharmacies_count,
            }
            for o in claimed_qs
        ]

        # 2) shifts for every pharmacy under this org
        shifts_qs = Shift.objects.filter(
            pharmacy__owner__organization=org
        )
        shifts = ShiftSerializer(shifts_qs, many=True).data

        return Response({
            'organization': {
                'id':   org.id,
                'name': org.name,
                'role': membership.role,
            },
            'claimed_pharmacies': claimed_data,
            'shifts':            shifts,
        }, status=status.HTTP_200_OK)

class OwnerDashboard(APIView):
    permission_classes = [IsAuthenticated, IsOwner]

    def get(self, request):
        user_serializer = UserProfileSerializer(request.user)
        data = {
            "user": user_serializer.data,
            "message": "Welcome Pharmacy Owner!",
            "pharmacies": [],  # Can be populated later with pharmacy data
            "chain_info": []  # Can be populated with chain info
        }
        return Response(data)

class PharmacistDashboard(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]

    def get(self, request):
        user_serializer = UserProfileSerializer(request.user)
        data = {
            "user": user_serializer.data,
            "message": "Welcome Pharmacist!",
            "available_shifts": [],  # Can be populated later with available shifts
        }
        return Response(data)

class OtherStaffDashboard(APIView):
    permission_classes = [IsAuthenticated, IsOtherstaff]

    def get(self, request):
        user_serializer = UserProfileSerializer(request.user)
        data = {
            "user": user_serializer.data,
            "message": "Welcome Other Staff!",
            "tasks": [],  # Can be populated later with tasks
        }
        return Response(data)

class ExplorerDashboard(APIView):
    permission_classes = [IsAuthenticated, IsExplorer]

    def get(self, request):
        user_serializer = UserProfileSerializer(request.user)
        data = {
            "user": user_serializer.data,
            "message": "Welcome Explorer!",
            # "available_jobs": [],  # Can be populated later with available jobs
        }
        return Response(data)


# Cahing and Pharmacy and membership
class PharmacyViewSet(viewsets.ModelViewSet):
    """
    Pharmacy CRUD:
      - Owners manage their own pharmacies.
      - ORG_ADMINs manage org-owned pharmacies.
      - REGION_ADMIN and SHIFT_MANAGER may only view.
    """
    parser_classes = [MultiPartParser, FormParser]
    queryset = Pharmacy.objects.all()
    serializer_class = PharmacySerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        if request.method in permissions.SAFE_METHODS:
            return
        user = request.user
        if IsOwner().has_permission(request, self) or OrganizationRolePermission().has_permission(request, self):
            return
        self.permission_denied(request)

    def check_object_permissions(self, request, obj):
        user = request.user
        # Owner-of-this-pharmacy?
        if obj.owner and obj.owner.user == user:
            return
        # ORG_ADMIN for this org?
        self.required_roles = ['ORG_ADMIN']
        org_pk = obj.organization_id or (obj.owner.organization_id if obj.owner else None)
        self.kwargs['organization_pk'] = org_pk
        if OrganizationRolePermission().has_permission(request, self):
            return
        self.permission_denied(request, obj)

    def get_queryset(self):
        user = self.request.user
        # ORG_ADMIN sees all org pharmacies + any claimed-owner pharmacies
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').first().organization
            return Pharmacy.objects.filter(
                Q(organization=org) |
                Q(owner__organization=org)
            )
        # Otherwise only this user's own
        try:
            owner = OwnerOnboarding.objects.get(user=user)
        except OwnerOnboarding.DoesNotExist:
            return Pharmacy.objects.none()
        return Pharmacy.objects.filter(owner=owner)

    def perform_create(self, serializer):
        user = self.request.user
        # Individual owner flow
        if not OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            try:
                owner = OwnerOnboarding.objects.get(user=user)
            except OwnerOnboarding.DoesNotExist:
                raise NotFound("Complete Owner Onboarding before adding pharmacies.")
            serializer.save(owner=owner)
        else:
            # ORG_ADMIN flow → auto-assign organization
            org = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').first().organization
            serializer.save(organization=org)

    def perform_update(self, serializer):
        super().perform_update(serializer)

class MembershipViewSet(viewsets.ModelViewSet):
    """
    CRUD and listing for Membership. Listings scoped to pharmacies
    the user owns or administrates.
    """
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # 1. Determine pharmacies visible to me
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            # org-admin sees all in their org
            org = OrganizationMembership.objects.filter(
                user=user, role='ORG_ADMIN'
            ).first().organization
            visible_pharmacies = Pharmacy.objects.filter(
                Q(organization=org) | Q(owner__organization=org)
            )
        else:
            # individual owner sees only their own
            try:
                owner = OwnerOnboarding.objects.get(user=user)
                visible_pharmacies = Pharmacy.objects.filter(owner=owner)
            except OwnerOnboarding.DoesNotExist:
                visible_pharmacies = Pharmacy.objects.none()

        qs = Membership.objects.filter(pharmacy__in=visible_pharmacies)

        # 2. Optional query filters
        pharmacy_id = self.request.query_params.get('pharmacy_id')
        chain_id = self.request.query_params.get('chain_id')
        if pharmacy_id:
            qs = qs.filter(pharmacy_id=pharmacy_id)
        elif chain_id:
            qs = qs.filter(pharmacy__chain_id=chain_id)

        return qs.distinct()

class ChainViewSet(viewsets.ModelViewSet):
    """
    Manage Chains—and within a chain, add/remove pharmacies & staff.
    """
    parser_classes = [MultiPartParser, FormParser]
    queryset = Chain.objects.all()
    serializer_class = ChainSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        if request.method in permissions.SAFE_METHODS:
            return

        user = request.user
        # allow create for both OwnerOnboarding and ORG_ADMIN
        if request.method == 'POST':
            if OwnerOnboarding.objects.filter(user=user).exists():
                return
            if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
                return
            self.permission_denied(request)

        # allow update/delete if chain owner or any ORG_ADMIN
        if IsOwner().has_permission(request, self):
            return
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            return
        self.permission_denied(request)

    def get_queryset(self):
        user = self.request.user
        qs = Chain.objects.none()

        # Owner-created chains
        if OwnerOnboarding.objects.filter(user=user).exists():
            owner = OwnerOnboarding.objects.get(user=user)
            qs |= Chain.objects.filter(owner=owner)

        # Org-admin–created chains
        org_mem = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).first()
        if org_mem:
            qs |= Chain.objects.filter(organization=org_mem.organization)

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        # Owner flow
        if OwnerOnboarding.objects.filter(user=user).exists():
            owner = OwnerOnboarding.objects.get(user=user)
            serializer.save(owner=owner)
            return
        # Org-admin flow
        org_mem = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).first()
        if org_mem:
            serializer.save(organization=org_mem.organization)
            return
        # fallback
        serializer.save()

    @action(detail=True, methods=['get'])
    def pharmacies(self, request, pk=None):
        """
        GET /chains/{id}/pharmacies/
        Returns only pharmacies assigned to this chain.
        """
        chain = self.get_object()
        qs = chain.pharmacies.all()
        page = self.paginate_queryset(qs)
        if page is not None:
            data = PharmacySerializer(page, many=True).data
            return self.get_paginated_response(data)
        return Response(PharmacySerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def add_pharmacy(self, request, pk=None):
        chain = self.get_object()
        pid = request.data.get('pharmacy_id')
        pharm = Pharmacy.objects.filter(id=pid).first()
        if not pharm:
            raise NotFound("That pharmacy does not exist.")

        # Owner-chain: pharmacy.owner must match
        if chain.owner:
            if pharm.owner != chain.owner:
                raise PermissionDenied("You don’t own that pharmacy.")
        # Org-chain: pharmacy.organization or pharm.owner.organization must match
        elif chain.organization:
            org = chain.organization
            owns_direct = (pharm.organization == org)
            owns_via_claim = (
                pharm.owner.organization == org
                and pharm.owner.organization_claimed
            )
            if not (owns_direct or owns_via_claim):
                raise PermissionDenied("That pharmacy isn’t in your organization.")
        else:
            # no owner or org on chain
            raise PermissionDenied("Chain has no owner or organization.")

        chain.pharmacies.add(pharm)
        return Response({'status': 'Pharmacy added', 'pharmacy': pharm.name})

    @action(detail=True, methods=['post'])
    def remove_pharmacy(self, request, pk=None):
        chain = self.get_object()
        pid = request.data.get('pharmacy_id')
        pharm = chain.pharmacies.filter(id=pid).first()
        if not pharm:
            raise NotFound("That pharmacy is not part of this chain.")
        chain.pharmacies.remove(pharm)
        return Response({'status': 'Pharmacy removed', 'pharmacy': pharm.name})

    @action(detail=True, methods=['post'])
    def add_user(self, request, pk=None):
        chain = self.get_object()
        pharm = chain.pharmacies.filter(id=request.data.get('pharmacy_id')).first()
        if not pharm:
            raise NotFound("Pharmacy not in this chain.")
        try:
            user = get_user_model().objects.get(id=request.data.get('user_id'))
        except get_user_model().DoesNotExist:
            raise NotFound("User not found.")
        membership, created = Membership.objects.get_or_create(user=user, pharmacy=pharm)
        if not created:
            return Response({"detail": "Already assigned."}, status=400)
        return Response(MembershipSerializer(membership).data, status=201)

    @action(detail=True, methods=['post'])
    def remove_user(self, request, pk=None):
        chain = self.get_object()
        membership = Membership.objects.filter(
            user_id=request.data.get('user_id'),
            pharmacy__in=chain.pharmacies.all()
        ).first()
        if not membership:
            raise NotFound("User not in this chain’s pharmacies.")
        membership.delete()
        return Response(status=204)



COMMUNITY_LEVELS = ['PHARMACY', 'OWNER_CHAIN', 'ORG_CHAIN']
PUBLIC_LEVEL = 'PLATFORM'

class BaseShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method in SAFE_METHODS or self.action == 'express_interest':
            return

        user = request.user
        if self.action == 'create':
            pharm_id = request.data.get('pharmacy')
            pharmacy = get_object_or_404(Pharmacy, pk=pharm_id)
        else:
            pharmacy = self.get_object().pharmacy

        # 1) Pharmacy owner can always post
        if pharmacy.owner and pharmacy.owner.user == user:
            return

        # 2) Org‐admins of the pharmacy’s organization can post
        if OrganizationMembership.objects.filter(
            user=user,
            role='ORG_ADMIN',
            organization_id=pharmacy.organization_id
        ).exists():
            return

        # 3) Any claimed pharmacy (owner.organization_claimed=True) is also open
        if pharmacy.owner and getattr(pharmacy.owner, 'organization_claimed', False):
            return

        # Otherwise, block
        self.permission_denied(request)

    def get_queryset(self):
        qs = Shift.objects.all().annotate(interested_users_count=Count('interests'))
        now = timezone.now()
        esc_rules = [
            (0, 'escalate_to_owner_chain', 'OWNER_CHAIN', 1),
            (1, 'escalate_to_org_chain',    'ORG_CHAIN',   2),
            (2, 'escalate_to_platform',     'PLATFORM',    3),
        ]
        for lvl, date_field, next_vis, next_lvl in esc_rules:
            Shift.objects.filter(
                escalation_level=lvl,
                **{f'{date_field}__lte': now},
                interests__isnull=True
            ).update(visibility=next_vis, escalation_level=next_lvl)
        return qs

    @action(detail=True, methods=['post'])
    def express_interest(self, request, pk=None):
        shift = self.get_object()
        user  = request.user

        # 1) Onboarding required
        if user.role == 'PHARMACIST':
            if not PharmacistOnboarding.objects.filter(user=user).exists():
                return Response(
                    {'detail': 'Please complete your pharmacist onboarding before applying.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:  # OTHER_STAFF
            if not OtherStaffOnboarding.objects.filter(user=user).exists():
                return Response(
                    {'detail': 'Please complete your staff onboarding before applying.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 2) Interest logic
        if shift.single_user_only:
            # Only one interest per shift (ignore any slot_id)
            interest, created = ShiftInterest.objects.get_or_create(
                shift=shift,
                slot=None,
                user=user
            )
        else:
            # Allow interest at slot-level or whole-shift (if no slot_id provided)
            slot = None
            slot_id = request.data.get('slot_id')
            if slot_id is not None:
                slot = get_object_or_404(ShiftSlot, pk=slot_id, shift=shift)

            interest, created = ShiftInterest.objects.get_or_create(
                shift=shift,
                slot=slot,
                user=user
            )

        # 3) Serialize and return
        serializer = ShiftInterestSerializer(interest, context={'request': request})
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def reveal_profile(self, request, pk=None):
        shift   = self.get_object()
        user_id = request.data.get('user_id')
        if user_id is None:
            return Response({'detail': 'user_id is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(User, pk=user_id)

        slot_id = request.data.get('slot_id')
        # 1) Try to find a slot-specific interest if slot_id is provided
        if slot_id is not None:
            try:
                interest = ShiftInterest.objects.get(
                    shift=shift, slot_id=slot_id, user=candidate
                )
            except ShiftInterest.DoesNotExist:
                # 2) Fallback to the “all-slots” interest
                interest = get_object_or_404(
                    ShiftInterest, shift=shift, slot__isnull=True, user=candidate
                )
        else:
            # 3) No slot_id → must be an all-slots interest
            interest = get_object_or_404(
                ShiftInterest, shift=shift, slot__isnull=True, user=candidate
            )

        # quota & shift.revealed_users logic (unchanged)...
        if (shift.reveal_quota is not None
            and shift.reveal_count >= shift.reveal_quota
            and not shift.revealed_users.filter(pk=user_id).exists()):
            return Response({'detail': 'Reveal quota exceeded.'},
                            status=status.HTTP_403_FORBIDDEN)

        if not shift.revealed_users.filter(pk=user_id).exists():
            shift.revealed_users.add(candidate)
            shift.reveal_count += 1
            shift.save()

        # persist on the interest itself
        if not interest.revealed:
            interest.revealed = True
            interest.save()


        # return profile (unchanged)
        try:
            po = PharmacistOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': po.phone_number,
                'short_bio':    po.short_bio,
                'resume':       request.build_absolute_uri(po.resume.url) if po.resume else None,
            }
        except PharmacistOnboarding.DoesNotExist:
            os = OtherStaffOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': os.phone_number,
                'short_bio':    os.short_bio,
                'resume':       request.build_absolute_uri(os.resume.url) if os.resume else None,
            }

        return Response({
            'id':         candidate.id,
            'first_name': candidate.first_name,
            'last_name':  candidate.last_name,
            'email':      candidate.email,
            **profile_data
        })

    @action(detail=True, methods=['post'])
    def accept_user(self, request, pk=None):
        """
        Assign a user to:
        - the entire shift if single_user_only=True, OR
        - unassigned slots in a multi‐slot shift when slot_id is omitted, OR
        - a specific slot if slot_id is provided.
        """
        shift = self.get_object()
        user_id = request.data.get('user_id')
        if user_id is None:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(User, pk=user_id)

        slot_id = request.data.get('slot_id')

        # ✅ CASE 1: SINGLE‐USER‐ONLY SHIFT — Expand all dates and assign per-day
        if shift.single_user_only:
            from client_profile.services import expand_shift_slots, get_locked_rate_for_slot
            assignment_ids = []

            for entry in expand_shift_slots(shift):
                slot = entry['slot']
                slot_date = entry['date']
                rate, reason = get_locked_rate_for_slot(shift=shift, slot=slot, user=candidate, override_date=slot_date)

                a, created = ShiftSlotAssignment.objects.update_or_create(
                    slot=slot,
                    slot_date=slot_date,
                    defaults={
                        'shift': shift,
                        'user': candidate,
                        'unit_rate': rate,
                        'rate_reason': reason
                    }
                )
                assignment_ids.append(a.id)

            return Response({
                'status': f'{candidate.get_full_name()} assigned to entire shift (per-date)',
                'assignment_ids': assignment_ids
            }, status=status.HTTP_200_OK)

        # ✅ CASE 2: MULTI‐SLOT BULK — assign user to all unassigned slot+dates
        if slot_id is None:
            from client_profile.services import expand_shift_slots, get_locked_rate_for_slot
            assignment_ids = []

            for entry in expand_shift_slots(shift):
                slot = entry['slot']
                slot_date = entry['date']

                already_assigned = ShiftSlotAssignment.objects.filter(slot=slot, slot_date=slot_date).exists()
                if already_assigned:
                    continue

                rate, reason = get_locked_rate_for_slot(shift=shift, slot=slot, user=candidate, override_date=slot_date)

                a, created = ShiftSlotAssignment.objects.update_or_create(
                    slot=slot,
                    slot_date=slot_date,
                    defaults={
                        'shift': shift,
                        'user': candidate,
                        'unit_rate': rate,
                        'rate_reason': reason
                    }
                )
                assignment_ids.append(a.id)

            return Response({
                'status': f'{candidate.get_full_name()} assigned to unassigned slots (per-date)',
                'assignment_ids': assignment_ids
            }, status=status.HTTP_200_OK)

        # ✅ CASE 3: PER‐SLOT ASSIGNMENT — assign user to ALL dates of a single recurring slot
        from client_profile.services import expand_shift_slots, get_locked_rate_for_slot
        slot = get_object_or_404(shift.slots, pk=slot_id)
        assignment_ids = []

        for entry in expand_shift_slots(shift):
            if entry['slot'].id != slot.id:
                continue  # only process the selected slot

            slot_date = entry['date']
            rate, reason = get_locked_rate_for_slot(shift=shift, slot=slot, user=candidate, override_date=slot_date)

            a, created = ShiftSlotAssignment.objects.update_or_create(
                slot=slot,
                slot_date=slot_date,
                defaults={
                    'shift': shift,
                    'user': candidate,
                    'unit_rate': rate,
                    'rate_reason': reason
                }
            )
            assignment_ids.append(a.id)

        return Response({
            'status': f'{candidate.get_full_name()} assigned to slot {slot.id} (per-date)',
            'assignment_ids': assignment_ids
        }, status=status.HTTP_200_OK)

class CommunityShiftViewSet(BaseShiftViewSet):
    """Community‐level shifts, only for users who are active members of that pharmacy."""
    def get_queryset(self):
        # 1) start with all “community” shifts happening today or later
        qs = super().get_queryset().filter(
            visibility__in=COMMUNITY_LEVELS,
            slots__date__gte=date.today()
        )

        user = self.request.user

        # 2) restrict to only those pharmacies where this user has an active Membership
        qs = qs.filter(
            pharmacy__memberships__user=user,
            pharmacy__memberships__is_active=True
        )

        # 3) now apply your existing clinical‐role filter:
        top_role = getattr(user, 'role', None)
        if top_role == 'PHARMACIST':
            allowed = ['PHARMACIST']
        elif top_role == 'OTHER_STAFF':
            onboard = OtherStaffOnboarding.objects.filter(user=user).first()
            sub = getattr(onboard, 'role_type', None)
            if sub == 'TECHNICIAN':
                allowed = ['TECHNICIAN']
            elif sub == 'ASSISTANT':
                allowed = ['ASSISTANT']
            elif sub == 'INTERN':
                allowed = ['INTERN']
            elif sub == 'STUDENT':
                allowed = ['STUDENT']
            else:
                allowed = []
        elif top_role == 'EXPLORER':
            allowed = ['EXPLORER']
        else:
            # Org‐admins / owners still see every community tier in pharmacies they belong to
            allowed = COMMUNITY_LEVELS

        return qs.filter(role_needed__in=allowed).distinct()

class PublicShiftViewSet(BaseShiftViewSet):
    """Platform‐public shifts, filtered by the user’s exact clinical role."""
    def get_queryset(self):
        qs = super().get_queryset().filter(
            visibility=PUBLIC_LEVEL,
            slots__date__gte=date.today()
        )

        user = self.request.user
        top_role = getattr(user, 'role', None)

        if top_role == 'PHARMACIST':
            allowed = ['PHARMACIST']
            # print('this is a pharmacist')

        elif top_role == 'OTHER_STAFF':
            onboard = OtherStaffOnboarding.objects.filter(user=user).first()
            sub = getattr(onboard, 'role_type', None)
            # print('this is a OTHERSTAFF')
            # print(sub)
            if sub == 'TECHNICIAN':
                allowed = ['TECHNICIAN']
                # print('this is a TECHNICIAN')

            elif sub == 'ASSISTANT':
                allowed = ['ASSISTANT']
                # print('this is a ASSISTANT')
            elif sub == 'INTERN':
                allowed = ['INTERN']
                # print('this is a INTERN')
            elif sub == 'STUDENT':
                allowed = ['STUDENT']
                # print('this is a STUDENT')
            else:
                allowed = []
                # print('this is a empty')

        elif top_role == 'EXPLORER':
            allowed = ['EXPLORER']
            # print('this is a EXPLORER')

        else:
            # Owners / ORG_ADMIN see every role on public
            allowed = ['PHARMACIST', 'TECHNICIAN', 'ASSISTANT', 'EXPLORER', 'INTERN', 'STUDENT']
            # print('this is all')

        return qs.filter(role_needed__in=allowed).distinct()

class ActiveShiftViewSet(BaseShiftViewSet):
    """Upcoming & unassigned shifts (no slot has an assignment)."""
    def get_queryset(self):
        user = self.request.user
        now  = timezone.now()
        today = date.today()

        # Base filtered & escalated shifts
        qs = super().get_queryset()

        # Org-Admins should also see claimed-owner pharmacies
        org_ids = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).values_list('organization_id', flat=True)
        claimed_q = Q(
            pharmacy__owner__organization_claimed=True,
            pharmacy__owner__organization_id__in=org_ids
        )

        # Only shifts they created OR claimed-owner shifts
        qs = qs.filter(
            Q(created_by=user) | claimed_q
        )

       # Only keep shifts where assigned_count < total_slot_count
        qs = qs.annotate(
           slot_count=Count('slots', distinct=True),
           assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__lt=F('slot_count'))

        # Only future slots
        qs = qs.filter(
            Q(slots__date__gt=today) |
            Q(slots__date=today, slots__end_time__gt=now.time())
        )

        return qs.distinct()

class ConfirmedShiftViewSet(BaseShiftViewSet):
    """Upcoming & in-progress fully assigned shifts."""
    def get_queryset(self):
        user  = self.request.user
        now   = timezone.now()
        today = date.today()

        # Start from the base filtered & escalated shifts
        qs = super().get_queryset()

        # Allow owners/org-admins
        org_ids = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).values_list('organization_id', flat=True)
        claimed_q = Q(
            pharmacy__owner__organization_claimed=True,
            pharmacy__owner__organization_id__in=org_ids
        )
        qs = qs.filter(Q(created_by=user) | claimed_q)

        # Only keep shifts where every slot is assigned
        qs = qs.annotate(
            slot_count=Count('slots', distinct=True),
            assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__gte=F('slot_count'))

        # **NEW**: show both upcoming and in-progress, not just in-progress
        qs = qs.filter(
            Q(slots__date__gt=today) |
            Q(slots__date=today, slots__end_time__gte=now.time())
        )

        return qs.distinct()

class HistoryShiftViewSet(BaseShiftViewSet):
    """All‐past, fully assigned shifts (slots ended or recurring_end_date passed)."""
    def get_queryset(self):
        user = self.request.user
        now  = timezone.now()
        today = date.today()

        qs = super().get_queryset()

        org_ids = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).values_list('organization_id', flat=True)
        claimed_q = Q(
            pharmacy__owner__organization_claimed=True,
            pharmacy__owner__organization_id__in=org_ids
        )

        qs = qs.filter(
            Q(created_by=user) | claimed_q
        )

        # fully assigned
        qs = qs.annotate(
            slot_count=Count('slots', distinct=True),
            assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__gte=F('slot_count'))

        # slots ended
        past_oneoff = (
            Q(slots__date__lt=today) |
            Q(slots__date=today, slots__end_time__lt=now.time())
        )
        past_recurring = Q(
            slots__is_recurring=True,
            slots__recurring_end_date__lt=today
        )
        qs = qs.filter(past_oneoff | past_recurring)

        return qs.distinct()

class ShiftInterestViewSet(viewsets.ModelViewSet):
    """
    Only return interests for the given `?shift=` (and optional `?slot=`),
    so that each shift’s page only shows its own interests.
    """
    serializer_class = ShiftInterestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ShiftInterest.objects.select_related('shift', 'slot', 'user')

        shift_id = self.request.query_params.get('shift')
        if shift_id is not None:
            qs = qs.filter(shift_id=shift_id)

        slot_id = self.request.query_params.get('slot')
        if slot_id is not None:
            qs = qs.filter(slot_id=slot_id)

        # ← HERE: honor the ?user= param so you only see your own interests
        user_id = self.request.query_params.get('user')
        if user_id is not None:
            qs = qs.filter(user_id=user_id)

        return qs

# --- Mixin to enforce pharmacist or other_staff only ---
class IsPharmacistOrOtherStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ('PHARMACIST', 'OTHER_STAFF')
        )

# --- “My Confirmed” Viewset ---
class MyConfirmedShiftsViewSet(BaseShiftViewSet):
    """
    Shifts I’m assigned to that haven’t ended yet.
    """
    serializer_class   = MyShiftSerializer
    permission_classes = [IsPharmacistOrOtherStaff]

    def get_queryset(self):
        user  = self.request.user
        now   = timezone.now()
        today = date.today()

        qs = super().get_queryset().filter(
            slot_assignments__user=user
        ).filter(
            # at least one slot still in progress
            Q(slots__date__gt=today) |
            Q(slots__date=today, slots__end_time__gte=now.time())
        )

        return qs.distinct()

# --- “My History” Viewset ---
class MyHistoryShiftsViewSet(BaseShiftViewSet):
    """
    Shifts I’m assigned to that have already ended.
    """
    serializer_class   = MyShiftSerializer
    permission_classes = [IsPharmacistOrOtherStaff]

    def get_queryset(self):
        user  = self.request.user
        now   = timezone.now()
        today = date.today()

        qs = super().get_queryset().filter(
            slot_assignments__user=user
        )
        # .filter(
        #     # only slots fully in the past
        #     Q(slots__date__lt=today) |
        #     Q(slots__date=today, slots__end_time__lt=now.time())
        # )

        return qs.distinct()




class ExplorerPostViewSet(viewsets.ModelViewSet):
    queryset = ExplorerPost.objects.all()
    serializer_class = ExplorerPostSerializer

# Availability
class UserAvailabilityViewSet(viewsets.ModelViewSet):
    """API for users to manage their own availability slots."""
    serializer_class = UserAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserAvailability.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)




from client_profile.services import generate_invoice_from_shifts
class InvoiceListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        return Invoice.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InvoiceSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return Invoice.objects.filter(user=self.request.user)


class GenerateInvoiceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        # Ensure required billing fields are present
        required = [
            'issuer_abn', 'gst_registered', 'super_rate_snapshot',
            'bank_account_name', 'bsb', 'account_number', 'bill_to_email',  'cc_emails',
        ]
        missing = [f for f in required if f not in data]
        if missing:
            return Response(
                {'error': f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        invoice = generate_invoice_from_shifts(
            user=request.user,
            pharmacy_id=data.get('pharmacy'),
            shift_ids=data.get('shift_ids', []),
            custom_lines=data.get('custom_lines', []),
            external=data.get('external', False),
            billing_data=data,
            due_date=data.get('due_date')
        )

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

from rest_framework.decorators import api_view, permission_classes
from .services import generate_preview_invoice_lines

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def preview_invoice_lines(request, shift_id):
    try:
        shift = Shift.objects.get(id=shift_id)
    except Shift.DoesNotExist:
        return Response({"error": "Shift not found"}, status=404)

    line_items = generate_preview_invoice_lines(shift, request.user)
    print(f"🔍 {len(line_items)} line items for user {request.user} on shift {shift_id}")
    return Response(line_items)
