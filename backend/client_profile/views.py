# client_profile/views.py
from rest_framework import generics, permissions, status
# from .models import PharmacistOnboarding
from .serializers import *
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
# from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS
from rest_framework.generics import CreateAPIView, RetrieveUpdateAPIView
from rest_framework.exceptions import NotFound
from rest_framework import viewsets
from rest_framework.decorators import action
from .models import *
from users.permissions import *
from users.serializers import (
    UserProfileSerializer,
)
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import json
from django.db.models import Q, Count, F
from django.utils import timezone
from client_profile.services import get_locked_rate_for_slot, expand_shift_slots, generate_invoice_from_shifts, render_invoice_to_pdf, generate_preview_invoice_lines
from client_profile.utils import build_shift_email_context, clean_email, build_roster_email_link
from django.utils.crypto import get_random_string
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.conf import settings
from rest_framework.exceptions import APIException
class Http400(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Bad Request.'
    default_code = 'bad_request'
from rest_framework.decorators import api_view, permission_classes
from django_q.tasks import async_task
from datetime import date, datetime # Ensure datetime is imported for parsing
from rest_framework.exceptions import PermissionDenied, ValidationError

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
    permission_classes = [permissions.IsAuthenticated, IsOwner, IsOTPVerified]

    def perform_create(self, serializer):
        serializer.save()
   
class OwnerOnboardingDetail(generics.RetrieveUpdateAPIView):
    serializer_class   = OwnerOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner, IsOTPVerified]

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
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3) Look up the onboarding record
        try:
            onboarding = OwnerOnboarding.objects.get(user__email__iexact=email)
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
    permission_classes = [permissions.IsAuthenticated, IsPharmacist, IsOTPVerified]

    def perform_create(self, serializer):
        serializer.save()

class PharmacistOnboardingDetailView(RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class   = PharmacistOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsPharmacist, IsOTPVerified]

    def get_object(self):
        try:
            return PharmacistOnboarding.objects.get(user=self.request.user)
        except PharmacistOnboarding.DoesNotExist:
            raise NotFound("Pharmacist onboarding profile not found.")

class OtherStaffOnboardingCreateView(CreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = OtherStaffOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsOtherstaff, IsOTPVerified]

    def perform_create(self, serializer):
        serializer.save()

class OtherStaffOnboardingDetailView(RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = OtherStaffOnboardingSerializer
    permission_classes = [IsAuthenticated, IsOtherstaff, IsOTPVerified]

    def get_object(self):
        try:
            return OtherStaffOnboarding.objects.get(user=self.request.user)
        except OtherStaffOnboarding.DoesNotExist:
            raise NotFound("Onboarding profile not found for this user.")

class ExplorerOnboardingCreateView(CreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ExplorerOnboardingSerializer
    permission_classes = [permissions.IsAuthenticated, IsExplorer, IsOTPVerified]

    def perform_create(self, serializer):
        serializer.save()

class ExplorerOnboardingDetailView(RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ExplorerOnboardingSerializer
    permission_classes = [IsAuthenticated, IsExplorer, IsOTPVerified]

    def get_object(self):
        try:
            return ExplorerOnboarding.objects.get(user=self.request.user)
        except ExplorerOnboarding.DoesNotExist:
            raise NotFound("Onboarding profile not found for this user.")

class RefereeConfirmView(APIView):
    """
    POST /api/client-profile/onboarding/referee-confirm/<profile_pk>/<ref_idx>/
    Generic for ALL onboarding profiles.
    """

    def post(self, request, profile_pk, ref_idx):
        # Try all models (pharmacist, owner, otherstaff, etc.)
        onboarding_models = [PharmacistOnboarding, OwnerOnboarding, OtherStaffOnboarding]  # etc

        instance = None
        for Model in onboarding_models:
            try:
                instance = Model.objects.get(pk=profile_pk)
                break
            except Model.DoesNotExist:
                continue

        if not instance:
            return Response({'detail': 'Onboarding profile not found.'}, status=404)

        # Your custom logic: mark referee as confirmed, log event, whatever you want
        # Example: set referee1_confirmed or referee2_confirmed field based on ref_idx
        if str(ref_idx) == "1":
            instance.referee1_confirmed = True
        elif str(ref_idx) == "2":
            instance.referee2_confirmed = True
        else:
            return Response({'detail': 'Invalid referee index.'}, status=400)

        instance.save()
        return Response({'success': True, 'message': 'Referee confirmed.'}, status=200)

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
        user = request.user
        user_serializer = UserProfileSerializer(user)

        try:
            owner = OwnerOnboarding.objects.get(user=user)
        except OwnerOnboarding.DoesNotExist:
            return Response({"detail": "Owner onboarding profile not found."}, status=404)

        pharmacies = Pharmacy.objects.filter(owner=owner)
        shifts_qs = Shift.objects.filter(pharmacy__in=pharmacies).distinct()

        today = date.today()
        now = timezone.now().time()

        # Upcoming shifts
        upcoming_shifts = shifts_qs.filter(
            slots__date__gt=today
        ) | shifts_qs.filter(
            slots__date=today,
            slots__end_time__gt=now
        )
        upcoming_shifts = upcoming_shifts.distinct()

        # ---- Correct confirmed shifts logic ----
        # Confirmed shifts: at least one assignment
        confirmed_shifts = shifts_qs.filter(slot_assignments__isnull=False).distinct()

        # Build shift summary boxes
        shift_boxes = []
        for shift in upcoming_shifts:
            slot = shift.slots.order_by('date').first()
            shift_date = slot.date if slot else None
            shift_boxes.append({
                'id': shift.id,
                'pharmacy_name': shift.pharmacy.name if shift.pharmacy else '',
                'date': shift_date,
            })

        bills_summary = {
            "total_billed": "Coming soon",
            "points": "Gamification placeholder"
        }

        data = {
            "user": user_serializer.data,
            "upcoming_shifts_count": upcoming_shifts.count(),
            "confirmed_shifts_count": confirmed_shifts.count(),
            "shifts": shift_boxes,
            "bills_summary": bills_summary,
        }
        return Response(data)

class PharmacistDashboard(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]

    def get(self, request):
        user = request.user
        user_serializer = UserProfileSerializer(user)
        today = date.today()
        now = timezone.now().time()

        # Upcoming shifts: assigned to the user, future
        upcoming_assignments = ShiftSlotAssignment.objects.filter(
            user=user,
            slot__date__gt=today
        ) | ShiftSlotAssignment.objects.filter(
            user=user,
            slot__date=today,
            slot__end_time__gt=now
        )
        upcoming_assignments = upcoming_assignments.distinct()
        upcoming_shifts = Shift.objects.filter(
            slots__assignments__in=upcoming_assignments
        ).distinct()

        # Confirmed shifts: for this user, same as upcoming for now (can refine if needed)
        confirmed_shifts = upcoming_shifts

        # Community shifts: future, pharmacy__isnull, NO assignments yet
        community_shifts = Shift.objects.filter(
            pharmacy__isnull=True,
            slots__date__gte=today
        ).exclude(
            slots__assignments__isnull=False
        ).distinct()

        shifts_data = []
        for shift in upcoming_shifts:
            pharmacy_name = shift.pharmacy.name if shift.pharmacy else "Community"
            slot = shift.slots.order_by('date').first()
            shift_date = slot.date if slot else None
            shifts_data.append({
                'id': shift.id,
                'pharmacy_name': pharmacy_name,
                'date': shift_date,
            })

        community_shifts_data = []
        for shift in community_shifts:
            slot = shift.slots.order_by('date').first()
            shift_date = slot.date if slot else None
            community_shifts_data.append({
                'id': shift.id,
                'pharmacy_name': "Community",
                'date': shift_date,
            })

        bills_summary = {
            "total_billed": "Coming soon",
            "points": "Gamification placeholder"
        }

        data = {
            "user": user_serializer.data,
            "message": "Welcome Pharmacist!",
            "upcoming_shifts_count": upcoming_shifts.count(),
            "confirmed_shifts_count": confirmed_shifts.count(),
            "community_shifts_count": community_shifts.count(),
            "shifts": shifts_data,
            "community_shifts": community_shifts_data,
            "bills_summary": bills_summary,
        }
        return Response(PharmacistDashboardResponseSerializer(data).data)

class OtherStaffDashboard(APIView):
    permission_classes = [IsAuthenticated, IsOtherstaff]

    def get(self, request):
        user = request.user
        user_serializer = UserProfileSerializer(user)
        today = date.today()
        now = timezone.now().time()

        upcoming_assignments = ShiftSlotAssignment.objects.filter(
            user=user,
            slot__date__gt=today
        ) | ShiftSlotAssignment.objects.filter(
            user=user,
            slot__date=today,
            slot__end_time__gt=now
        )
        upcoming_assignments = upcoming_assignments.distinct()
        upcoming_shifts = Shift.objects.filter(
            slots__assignments__in=upcoming_assignments
        ).distinct()
        confirmed_shifts = upcoming_shifts

        community_shifts = Shift.objects.filter(
            pharmacy__isnull=True,
            slots__date__gte=today
        ).exclude(
            slots__assignments__isnull=False
        ).distinct()

        shifts_data = []
        for shift in upcoming_shifts:
            pharmacy_name = shift.pharmacy.name if shift.pharmacy else "Community"
            slot = shift.slots.order_by('date').first()
            shift_date = slot.date if slot else None
            shifts_data.append({
                'id': shift.id,
                'pharmacy_name': pharmacy_name,
                'date': shift_date,
            })

        community_shifts_data = []
        for shift in community_shifts:
            slot = shift.slots.order_by('date').first()
            shift_date = slot.date if slot else None
            community_shifts_data.append({
                'id': shift.id,
                'pharmacy_name': "Community",
                'date': shift_date,
            })

        bills_summary = {
            "total_billed": "Coming soon",
            "points": "Gamification placeholder"
        }

        data = {
            "user": user_serializer.data,
            "message": "Welcome Other Staff!",
            "upcoming_shifts_count": upcoming_shifts.count(),
            "confirmed_shifts_count": confirmed_shifts.count(),
            "community_shifts_count": community_shifts.count(),
            "shifts": shifts_data,
            "community_shifts": community_shifts_data,
            "bills_summary": bills_summary,
        }
        return Response(OtherStaffDashboardResponseSerializer(data).data)

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


# Chain, Pharmacy and membership
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
    
    def _create_membership_invite(self, data, inviter):
        """
        Helper to create or invite a user as a membership and send emails.
        Returns: (membership_instance, None) if successful, (None, error_message) if not.
        """
        try:
            email_raw = (data.get('email') or data.get('user_email') or '').strip().lower()
            email = clean_email(email_raw)
            pharmacy_id = data.get('pharmacy')
            role = data.get('role')
            employment_type = data.get('employment_type', '')

            if not email or not pharmacy_id or not role:
                return None, 'email, pharmacy, and role are required.'

            # Find or create user
            user = User.objects.filter(email__iexact=email).first()
            user_created = False
            
            if not user:
                try:
                    if role == "PHARMACIST":
                        user_role = "PHARMACIST"
                    elif role in ["INTERN", "STUDENT", "ASSISTANT", "TECHNICIAN"]:
                        user_role = "OTHER_STAFF"
                    else:
                        user_role = "EXPLORER"

                    user = User.objects.create_user(
                        email=email,
                        password=get_random_string(12),
                        role=user_role,
                        is_otp_verified=False,
                    )
                    user_created = True
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    return None, f'Failed to create user: {str(e)}'
            else:
                if role == "PHARMACIST" and user.role != "PHARMACIST":
                    user.role = "PHARMACIST"
                    user.save()
                elif role in ["INTERN", "STUDENT", "ASSISTANT", "TECHNICIAN"] and user.role == "EXPLORER":
                    user.role = "OTHER_STAFF"
                    user.save()

            # Membership exists?
            if Membership.objects.filter(user=user, pharmacy_id=pharmacy_id).exists():
                return None, 'User is already a member of this pharmacy.'

            # --- START OF THE FIX ---
            # Prepare data for Membership creation, including new classification fields
            membership_data = {
                'user': user,
                'pharmacy_id': pharmacy_id,
                'invited_by': inviter,
                'invited_name': data.get('invited_name', ''),
                'role': role,
                'employment_type': employment_type,
                # Add classification fields from the request data
                'pharmacist_award_level': data.get('pharmacist_award_level', None),
                'otherstaff_classification_level': data.get('otherstaff_classification_level', None),
                'intern_half': data.get('intern_half', None),
                'student_year': data.get('student_year', None),
            }

            # Create membership using the prepared dictionary
            try:
                membership = Membership.objects.create(**membership_data)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return None, f'Failed to create membership: {str(e)}'
            # --- END OF THE FIX ---

            # Prepare and send email
            try:
                pharmacy = Pharmacy.objects.get(id=pharmacy_id)
                context = {
                    "pharmacy_name": pharmacy.name,
                    "inviter": inviter.get_full_name() or inviter.email or "A pharmacy admin",
                    "role": role.title() if role else "",
                }
                recipient_list = [user.email]

                if user_created:
                    uid = urlsafe_base64_encode(force_bytes(user.pk))
                    token = default_token_generator.make_token(user)
                    context["magic_link"] = f"{settings.FRONTEND_BASE_URL}/reset-password/{uid}/{token}/"
                    transaction.on_commit(lambda: async_task(
                        'users.tasks.send_async_email',
                        subject="You have been invited to join a pharmacy on ChemistTasker",
                        recipient_list=recipient_list,
                        template_name="emails/pharmacy_invite_new_user.html",
                        context=context,
                        text_template="emails/pharmacy_invite_new_user.txt",
                    ))
                else:
                    context["frontend_dashboard_link"] = f"{settings.FRONTEND_BASE_URL}/login"
                    transaction.on_commit(lambda: async_task(
                        'users.tasks.send_async_email',
                        subject="You have been added to a pharmacy on ChemistTasker",
                        recipient_list=recipient_list,
                        template_name="emails/pharmacy_invite_existing_user.html",
                        context=context,
                        text_template="emails/pharmacy_invite_existing_user.txt",
                    ))

            except Exception as e:
                import traceback
                traceback.print_exc()
                # Don't return error here - membership was created successfully
                # Just log the email error but continue

            return membership, None
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return None, f'Unexpected error: {str(e)}'


    # --- Single Invite (unchanged logic, now uses helper) ---
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        inviter = request.user

        # Only pharmacy owners or org admins may invite
        is_owner = OwnerOnboarding.objects.filter(user=inviter).exists()
        is_org_admin = OrganizationMembership.objects.filter(user=inviter, role='ORG_ADMIN').exists()
        if not (is_owner or is_org_admin):
            return Response({'detail': 'Only pharmacy owners or org admins may invite members.'}, status=403)

        membership, error = self._create_membership_invite(data, inviter)
        if error:
            return Response({'detail': error}, status=400)
        serializer = self.get_serializer(membership)
        return Response(serializer.data, status=201)

    # --- Bulk Invite ---
    @action(detail=False, methods=['post'], url_path='bulk_invite')
    def bulk_invite(self, request):
        inviter = request.user
        invitations = request.data.get('invitations', [])
        if not invitations or not isinstance(invitations, list):
            return Response({'detail': 'Invitations must be a list.'}, status=400)

        # Permission: Only pharmacy owners or org admins may invite
        is_owner = OwnerOnboarding.objects.filter(user=inviter).exists()
        is_org_admin = OrganizationMembership.objects.filter(user=inviter, role='ORG_ADMIN').exists()
        if not (is_owner or is_org_admin):
            return Response({'detail': 'Only pharmacy owners or org admins may invite members.'}, status=403)

        results = []
        errors = []
        for idx, invite in enumerate(invitations):
            membership, error = self._create_membership_invite(invite, inviter)
            if error:
                errors.append({'line': idx+1, 'email': invite.get('email'), 'error': error})
            else:
                results.append({
                    'email': invite.get('email'),
                    'role': invite.get('role'),
                    'employment_type': invite.get('employment_type'),
                    'status': 'invited'
                })
        response = {'results': results}
        if errors:
            response['errors'] = errors
            status_code = status.HTTP_207_MULTI_STATUS  # Partial success
        else:
            status_code = status.HTTP_201_CREATED
        return Response(response, status=status_code)

class ChainViewSet(viewsets.ModelViewSet):
    """
    Manage Chains—and within a chain, add/remove pharmacies & staff.
    """
    parser_classes = [JSONParser, MultiPartParser, FormParser]
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



COMMUNITY_LEVELS = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN','ORG_CHAIN']
PUBLIC_LEVEL = 'PLATFORM'

class BaseShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method in SAFE_METHODS or self.action in ['express_interest', 'reject']:
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
            (0, 'escalate_to_locum_casual', 'LOCUM_CASUAL', 1),
            (1, 'escalate_to_owner_chain',  'OWNER_CHAIN', 2),
            (2, 'escalate_to_org_chain',    'ORG_CHAIN',   3),
            (3, 'escalate_to_platform',     'PLATFORM',    4),
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
        if shift.visibility == PUBLIC_LEVEL:
            if user.role == 'PHARMACIST':
                try:
                    po = PharmacistOnboarding.objects.get(user=user)
                except PharmacistOnboarding.DoesNotExist:
                    return Response(
                        {'detail': 'Please complete your pharmacist onboarding before applying for public shifts.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not po.verified:
                    return Response(
                        {'detail': 'Your onboarding must be verified by admin before applying for public shifts.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            elif user.role == 'OTHER_STAFF':
                try:
                    os = OtherStaffOnboarding.objects.get(user=user)
                except OtherStaffOnboarding.DoesNotExist:
                    return Response(
                        {'detail': 'Please complete your staff onboarding before applying for public shifts.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not os.verified:
                    return Response(
                        {'detail': 'Your onboarding must be verified by admin before applying for public shifts.'},
                        status=status.HTTP_403_FORBIDDEN
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
        if created and shift.created_by and shift.created_by.email:
            ctx = build_shift_email_context(
                shift,
                user=shift.created_by,
                role=shift.created_by.role.lower(),      
            )
            async_task(
                'users.tasks.send_async_email',
                subject=f"New interest in your shift at {shift.pharmacy.name}",
                recipient_list=[shift.created_by.email],
                template_name="emails/shift_interest.html",
                context=ctx,
                text_template="emails/shift_interest.txt"
            )


        # 3) Serialize and return
        serializer = ShiftInterestSerializer(interest, context={'request': request})
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def reveal_profile(self, request, pk=None):
        shift = self.get_object()
        user_id = request.data.get('user_id')
        
        if user_id is None:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        candidate = get_object_or_404(User, pk=user_id)
        slot_id = request.data.get('slot_id')

        # Handle single user shifts
        if shift.single_user_only:
            # For single user shifts, always look for slot=None interest
            interest = get_object_or_404(
                ShiftInterest, shift=shift, slot__isnull=True, user=candidate
            )
        else:
            # Existing multi-slot logic
            if slot_id is not None:
                try:
                    interest = ShiftInterest.objects.get(
                        shift=shift, slot_id=slot_id, user=candidate
                    )
                except ShiftInterest.DoesNotExist:
                    interest = get_object_or_404(
                        ShiftInterest, shift=shift, slot__isnull=True, user=candidate
                    )
            else:
                interest = get_object_or_404(
                    ShiftInterest, shift=shift, slot__isnull=True, user=candidate
                )

        # Rest of the reveal logic remains the same...
        if (shift.reveal_quota is not None
            and shift.reveal_count >= shift.reveal_quota
            and not shift.revealed_users.filter(pk=user_id).exists()):
            return Response({'detail': 'Reveal quota exceeded.'}, status=status.HTTP_403_FORBIDDEN)

        if not shift.revealed_users.filter(pk=user_id).exists():
            shift.revealed_users.add(candidate)
            shift.reveal_count += 1
            shift.save()

        if not interest.revealed:
            interest.revealed = True
            interest.save()

        # Send email and return profile data...
        ctx = build_shift_email_context(shift, user=candidate, role=candidate.role.lower())
        async_task(
            'users.tasks.send_async_email',
            subject=f"Your profile was revealed for a shift at {shift.pharmacy.name}",
            recipient_list=[candidate.email],
            template_name="emails/shift_reveal.html",
            context=ctx,
            text_template="emails/shift_reveal.txt"
        )

        try:
            po = PharmacistOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': po.phone_number,
                'short_bio': po.short_bio,
                'resume': request.build_absolute_uri(po.resume.url) if po.resume else None,
                'rate_preference': po.rate_preference or None,
            }
        except PharmacistOnboarding.DoesNotExist:
            os = OtherStaffOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': os.phone_number,
                'short_bio': os.short_bio,
                'resume': request.build_absolute_uri(os.resume.url) if os.resume else None,
            }

        return Response({
            'id': candidate.id,
            'first_name': candidate.first_name,
            'last_name': candidate.last_name,
            'email': candidate.email,
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
        
        # Prevent Full/Part-Time employees from being accepted through this flow
        membership = Membership.objects.filter(user=candidate, pharmacy=shift.pharmacy).first()
        if membership and membership.employment_type in ['FULL_TIME', 'PART_TIME']:
            return Response(
                {"detail": "Full/Part-Time employees must be rostered via manual assignment, not accepted here."},
                status=status.HTTP_400_BAD_REQUEST
            )

        slot_id = request.data.get('slot_id')

        # ✅ CASE 1: SINGLE‐USER‐ONLY SHIFT — Expand all dates and assign per-day
        if shift.single_user_only:
            # from client_profile.services import expand_shift_slots, get_locked_rate_for_slot
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
            ctx = build_shift_email_context(
            shift,
            user=candidate,
            role=candidate.role.lower(),
            )
            async_task(
                'users.tasks.send_async_email',
                subject=f"You’ve been accepted for a shift at {shift.pharmacy.name}",
                recipient_list=[candidate.email],
                template_name="emails/shift_accept.html",
                context=ctx,
                text_template="emails/shift_accept.txt"
            )


            return Response({
                'status': f'{candidate.get_full_name()} assigned to entire shift (per-date)',
                'assignment_ids': assignment_ids
            }, status=status.HTTP_200_OK)

        # ✅ CASE 2: MULTI‐SLOT BULK — assign user to all unassigned slot+dates
        if slot_id is None:
            # from client_profile.services import expand_shift_slots, get_locked_rate_for_slot
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

            ctx = build_shift_email_context(
            shift,
            user=candidate,
            role=candidate.role.lower(),
            )
            async_task(
                'users.tasks.send_async_email',
                subject=f"You’ve been accepted for a shift at {shift.pharmacy.name}",
                recipient_list=[candidate.email],
                template_name="emails/shift_accept.html",
                context=ctx,
                text_template="emails/shift_accept.txt"
            )

            return Response({
                'status': f'{candidate.get_full_name()} assigned to unassigned slots (per-date)',
                'assignment_ids': assignment_ids
            }, status=status.HTTP_200_OK)

        # ✅ CASE 3: PER‐SLOT ASSIGNMENT — assign user to ALL dates of a single recurring slot
        # from client_profile.services import expand_shift_slots, get_locked_rate_for_slot
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

        ctx = build_shift_email_context(
        shift,
        user=candidate,
        role=candidate.role.lower(),
        )
        async_task(
            'users.tasks.send_async_email',
            subject=f"You’ve been accepted for a shift at {shift.pharmacy.name}",
            recipient_list=[candidate.email],
            template_name="emails/shift_accept.html",
            context=ctx,
            text_template="emails/shift_accept.txt"
        )

        return Response({
            'status': f'{candidate.get_full_name()} assigned to slot {slot.id} (per-date)',
            'assignment_ids': assignment_ids
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        shift = self.get_object()
        user = request.user
        slot_id = request.data.get('slot_id')
        slot_date = request.data.get('slot_date')  # required if recurring

        if slot_id is None:
            # Allow rejecting the entire shift (slot=None) only if single_user_only
            if not shift.single_user_only:
                return Response({'detail': 'slot_id is required'}, status=400)
            slot = None
        else:
            slot = get_object_or_404(ShiftSlot, pk=slot_id, shift=shift)

        # Parse slot_date if provided (for recurring slots)
        if slot is not None and slot.is_recurring and slot_date:
            try:
                slot_date_obj = datetime.strptime(slot_date, "%Y-%m-%d").date()
            except ValueError:
                return Response({'detail': 'Invalid slot_date format, use YYYY-MM-DD'}, status=400)
        else:
            slot_date_obj = None

        rejection, created = ShiftRejection.objects.get_or_create(
            shift=shift,
            slot=slot,
            slot_date=slot_date_obj,
            user=user
        )
        serializer = ShiftRejectionSerializer(rejection)

        # --- Send escalation prompt email if this is a new rejection ---
        if created and shift.created_by and shift.created_by.email:
            ctx = build_shift_email_context(
                shift,
                user=shift.created_by,
                role=shift.created_by.role.lower(),
                extra={
                    "rejector_name": user.get_full_name() or user.email,
                }
            )
            ctx["escalation_message"] = (
                f"{user.get_full_name() or user.email} has declined the shift or slot."
                "\n\nIf you need to reach a wider audience, you can escalate the shift to the platform with a single click—"
                "making it visible to the entire ChemistTasker community. This can help you find the right fit, faster."
            )

            async_task(
                'users.tasks.send_async_email',
                subject=f"Shift Update: {user.get_full_name() or user.email} has declined your shift",
                recipient_list=[shift.created_by.email],
                template_name="emails/shift_rejected.html",
                context=ctx,
                text_template="emails/shift_rejected.txt"
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='generate-share-link')
    def generate_share_link(self, request, pk=None):
        shift = self.get_object()

        # ✅ SECURITY: Only allow sharing if shift is public
        if shift.visibility != 'PLATFORM':
            return Response(
                {'detail': 'You must escalate this shift to platform level before it can be shared.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        shift.share_token = uuid.uuid4()
        shift.save(update_fields=['share_token'])

        return Response({'share_token': str(shift.share_token)})

    @action(detail=True, methods=['post'], url_path='manual-assign')
    def manual_assign(self, request, pk=None):
        """
        Owner/Admin directly assigns staff to slots based on calendar selection.
        Accepts a list of slot/date combinations.
        """
        shift = self.get_object()
        user_id = request.data.get('user_id')
        assignments = request.data.get('assignments', [])  # Expect list of {slot_id, slot_date}

        self.check_permissions(request)
        self.check_object_permissions(request, shift.pharmacy)

        if not user_id or not isinstance(assignments, list):
            return Response({"detail": "user_id and assignments list are required."}, status=400)

        candidate = get_object_or_404(User, pk=user_id)
        membership = Membership.objects.filter(user=candidate, pharmacy=shift.pharmacy).first()

        # Optionally: keep employment_type check or adjust as needed
        if not membership or membership.employment_type not in ['FULL_TIME', 'PART_TIME']:
            return Response({"detail": "Only Full/Part-Time employees can be rostered to this slot."}, status=400)

        assignment_ids = []

        for entry in assignments:
            slot_id = entry.get('slot_id')
            slot_date = entry.get('slot_date')
            # Remove checks for start_time/end_time

            if not slot_id or not slot_date:
                continue  # Skip invalid

            slot = get_object_or_404(shift.slots, pk=slot_id)

            assn, _ = ShiftSlotAssignment.objects.update_or_create(
                slot=slot,
                slot_date=slot_date,
                defaults={
                    "shift": shift,
                    "user": candidate,
                    "unit_rate": Decimal('0.00'),
                    "rate_reason": {"source": "Rostered manual assign"},
                    "is_rostered": True
                }
            )
            assignment_ids.append(assn.id)

        return Response({
            "detail": f"{len(assignment_ids)} slot(s) rostered for {candidate.get_full_name()}",
            "assignment_ids": assignment_ids
        }, status=200)


class CommunityShiftViewSet(BaseShiftViewSet):
    """Community‐level shifts, only for users who are active members of that pharmacy."""
    def get_queryset(self):
        user = self.request.user

        qs = super().get_queryset().filter(
            visibility__in=COMMUNITY_LEVELS,
            slots__date__gte=date.today()
        )

        # Q filters for all escalation levels:
        eligible_q = (
            # 1. Full/part time at this pharmacy
            Q(
                visibility='FULL_PART_TIME',
                pharmacy__memberships__user=user,
                pharmacy__memberships__employment_type__in=['FULL_TIME', 'PART_TIME'],
                pharmacy__memberships__is_active=True,
            )
            |
            # 2. Any active member at this pharmacy (for locum_casual)
            Q(
                visibility='LOCUM_CASUAL',
                pharmacy__memberships__user=user,
                pharmacy__memberships__is_active=True,
            )
            |
            # 3. Any active member at any pharmacy with the same owner as the shift’s pharmacy
            Q(
                visibility='OWNER_CHAIN',
                pharmacy__owner__in=Pharmacy.objects.filter(
                    memberships__user=user,
                    memberships__is_active=True
                ).values_list('owner', flat=True)
            )
            |
            # 4. Any active member at any pharmacy in the same organization as the shift’s pharmacy
            Q(
                visibility='ORG_CHAIN',
                pharmacy__organization__in=Pharmacy.objects.filter(
                    memberships__user=user,
                    memberships__is_active=True
                ).values_list('organization', flat=True)
            )
        )

        qs = qs.filter(eligible_q).distinct()

        # Your clinical-role logic as before (can remain unchanged)
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
            # Owners / ORG_ADMIN see every role on public
            allowed = ['PHARMACIST', 'TECHNICIAN', 'ASSISTANT', 'EXPLORER', 'INTERN', 'STUDENT']

        return qs.filter(role_needed__in=allowed).distinct()

class ActiveShiftViewSet(BaseShiftViewSet):
    """Upcoming & unassigned shifts (no slot has an assignment)."""
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
            pharmacy__owner__organization__memberships__user=user, # <-- Potentially needs fix like this
            pharmacy__owner__organization__memberships__role='ORG_ADMIN', # <-- Potentially needs fix like this
            pharmacy__owner__organization_id__in=org_ids
        )

        qs = qs.filter(
            Q(created_by=user) | claimed_q
        )

        qs = qs.annotate(
           slot_count=Count('slots', distinct=True),
           assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__lt=F('slot_count'))

        qs = qs.filter(
            Q(slots__date__gt=today) |
            Q(slots__date=today, slots__end_time__gt=now.time())
        )

        return qs.distinct()

    @action(detail=True, methods=['get'])
    def member_status(self, request, pk=None):
        shift = self.get_object()

        # Check if the shift is public-level; if so, this endpoint is not applicable.
        # This check remains as it was.
        if shift.visibility == PUBLIC_LEVEL:
            return Response({'detail': 'Member status is not applicable for Public shifts via this endpoint. Please query /shift-interests directly for public interests.'}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve the visibility parameter from the request query params.
        # This is the key change: use the requested visibility for filtering.
        requested_visibility = request.query_params.get('visibility')

        # Fallback if requested_visibility is unexpectedly None, though the frontend should always provide it.
        # In this case, we would use the shift's current visibility from the DB.
        if not requested_visibility:
            requested_visibility = shift.visibility


        slot_id_param = request.query_params.get('slot_id')
        slot_date = request.query_params.get('slot_date')

        slot_obj = None
        if slot_id_param:
            slot_obj = get_object_or_404(ShiftSlot, pk=slot_id_param, shift=shift)
        elif not shift.single_user_only:
            # For multi-slot shifts that are not single-user-only, a slot_id is required for specific status.
            return Response({'detail': 'slot_id is required for multi-slot shifts via this endpoint.'}, status=status.HTTP_400_BAD_REQUEST)

        interests_query = ShiftInterest.objects.filter(shift=shift)
        rejections_query = ShiftRejection.objects.filter(shift=shift)

        if shift.single_user_only:
            interests_query = interests_query.filter(slot__isnull=True)
            rejections_query = rejections_query.filter(slot__isnull=True)
        else: # Multi-slot (non-single_user_only)
            interests_query = interests_query.filter(slot=slot_obj)
            rejections_query = rejections_query.filter(slot=slot_obj)
            if slot_obj and slot_obj.is_recurring and slot_date:
                rejections_query = rejections_query.filter(slot_date=slot_date)

        interested_user_ids = {i.user_id for i in interests_query}
        rejected_user_ids = {r.user_id for r in rejections_query}

        memberships_qs = Membership.objects.filter(
            is_active=True,
            role=shift.role_needed
        ).select_related('user')

        # Apply filtering based on the 'requested_visibility' from the query parameter
        if requested_visibility == 'FULL_PART_TIME':
            memberships_qs = memberships_qs.filter(
                pharmacy=shift.pharmacy,
                employment_type__in=['FULL_TIME', 'PART_TIME'],
            )
        elif requested_visibility == 'LOCUM_CASUAL':
            memberships_qs = memberships_qs.filter(
                pharmacy=shift.pharmacy,
                employment_type__in=['LOCUM', 'CASUAL'],
            )
        elif requested_visibility == 'OWNER_CHAIN':
            owner_pharmacies = Pharmacy.objects.filter(owner=shift.pharmacy.owner)
            memberships_qs = memberships_qs.filter(
                pharmacy__in=owner_pharmacies
            )
        elif requested_visibility == 'ORG_CHAIN':
            org_pharmacies = Pharmacy.objects.filter(organization=shift.pharmacy.organization)
            memberships_qs = memberships_qs.filter(
                pharmacy__in=org_pharmacies
            )
        else:
            # This 'else' branch handles cases where the requested_visibility
            # doesn't match a specific membership filter (e.g., 'PLATFORM'
            # which is handled by the early return, or an unexpected value).
            # If no explicit membership type is needed for this visibility,
            # it might return an empty queryset or a default set based on your business logic.
            memberships_qs = Membership.objects.none() # Default to empty if no specific rule applies

        data = []
        for membership in memberships_qs.distinct():
            user = membership.user
            status = 'no_response'

            display_name = membership.invited_name if membership.invited_name else user.get_full_name()

            is_assigned = False
            if shift.single_user_only:
                is_assigned = ShiftSlotAssignment.objects.filter(
                    user=user,
                    shift=shift
                ).exists()
            else:
                is_assigned = ShiftSlotAssignment.objects.filter(
                    user=user,
                    slot=slot_obj,
                    **({'slot_date': slot_date} if slot_obj and slot_obj.is_recurring and slot_date else {})
                ).exists()

            if is_assigned:
                status = 'accepted'
            elif user.id in interested_user_ids:
                status = 'interested'
            elif user.id in rejected_user_ids:
                status = 'rejected'

            data.append({
                'user_id': user.id,
                'name': display_name,
                'employment_type': membership.employment_type,
                'role': membership.role,
                'status': status,
                'is_member': True
            })

        return Response(data)

    # OVERRIDE/RE-DEFINE escalate to ensure URL generation for ActiveShiftViewSet
    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        # You can call super() if you want to reuse the BaseShiftViewSet's logic
        # return super().escalate(request, pk)
        # OR, copy the entire logic from BaseShiftViewSet's escalate here:
        shift = self.get_object()
        user = request.user

        # Only allow owner or org-admin to escalate
        pharmacy = shift.pharmacy
        if not (
            (pharmacy.owner and pharmacy.owner.user == user) or
            OrganizationMembership.objects.filter(
                user=user,
                role='ORG_ADMIN',
                organization_id=pharmacy.organization_id
            ).exists()
        ):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Escalation levels and mapping
        escalation_flow = [
            'FULL_PART_TIME',
            'LOCUM_CASUAL',
            'OWNER_CHAIN',
            'ORG_CHAIN',
            'PLATFORM'
        ]
        try:
            current_index = escalation_flow.index(shift.visibility)
        except ValueError:
            return Response({'detail': 'Invalid current visibility level.'}, status=status.HTTP_400_BAD_REQUEST)

        if current_index == len(escalation_flow) - 1:
            return Response({'detail': 'Already at highest escalation (Platform/Public).'}, status=status.HTTP_400_BAD_REQUEST)

        # Advance to next escalation
        next_visibility = escalation_flow[current_index + 1]
        shift.visibility = next_visibility
        shift.escalation_level = current_index + 1

        # Optionally, set escalation timestamp if you want to track it
        field_map = {
            1: 'escalate_to_locum_casual',
            2: 'escalate_to_owner_chain',
            3: 'escalate_to_org_chain',
            4: 'escalate_to_platform'
        }
        field = field_map.get(shift.escalation_level)
        if field and hasattr(shift, field) and not getattr(shift, field):
            setattr(shift, field, timezone.now())

        shift.save()
        return Response({'detail': f'Shift escalated to {next_visibility}.'}, status=status.HTTP_200_OK)

class ConfirmedShiftViewSet(BaseShiftViewSet):
    """Upcoming & in-progress fully assigned shifts."""
    def get_queryset(self):
        user  = self.request.user
        now   = timezone.now()
        today = date.today()

        qs = super().get_queryset()

        org_ids = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).values_list('organization_id', flat=True)
        claimed_q = Q(
            pharmacy__owner__organization_claimed=True,
            pharmacy__owner__organization__memberships__user=user, # <-- Potentially needs fix like this
            pharmacy__owner__organization__memberships__role='ORG_ADMIN', # <-- Potentially needs fix like this
            pharmacy__owner__organization_id__in=org_ids
        )
        qs = qs.filter(Q(created_by=user) | claimed_q)

        qs = qs.annotate(
            slot_count=Count('slots', distinct=True),
            assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__gte=F('slot_count'))

        qs = qs.filter(
            Q(slots__date__gt=today) |
            Q(slots__date=today, slots__end_time__gte=now.time())
        )

        return qs.distinct()

    # Move this entire method OUTSIDE of get_queryset
    @action(detail=True, methods=['post'], url_path='view_assigned_profile')
    def view_assigned_profile(self, request, pk=None):
        shift = self.get_object()
        user_id = request.data.get('user_id')
        if user_id is None:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        candidate = get_object_or_404(User, pk=user_id)
        slot_id = request.data.get('slot_id')

        # Verify the user is actually assigned to this shift/slot
        if shift.single_user_only:
            if not ShiftSlotAssignment.objects.filter(shift=shift, user=candidate).exists():
                return Response({'detail': 'User is not assigned to this shift.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            if slot_id is None:
                # If slot_id is not provided for a multi-slot shift, check if assigned to any slot of this shift
                if not ShiftSlotAssignment.objects.filter(shift=shift, user=candidate).exists():
                    return Response({'detail': 'User is not assigned to any slot in this shift.'}, status=status.HTTP_404_NOT_FOUND)
            else:
                if not ShiftSlotAssignment.objects.filter(shift=shift, slot_id=slot_id, user=candidate).exists():
                    return Response({'detail': 'User is not assigned to this specific slot.'}, status=status.HTTP_404_NOT_FOUND)

        # Retrieve profile data without sending an email
        profile_data = {}
        try:
            po = PharmacistOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': po.phone_number,
                'short_bio': po.short_bio,
                'resume': request.build_absolute_uri(po.resume.url) if po.resume else None,
                'rate_preference': po.rate_preference or None,
            }
        except PharmacistOnboarding.DoesNotExist:
            try:
                os = OtherStaffOnboarding.objects.get(user=candidate)
                profile_data = {
                    'phone_number': os.phone_number,
                    'short_bio': os.short_bio,
                    'resume': request.build_absolute_uri(os.resume.url) if os.resume else None,
                }
            except OtherStaffOnboarding.DoesNotExist:
                # Handle cases where user might not have a full onboarding profile yet
                profile_data = {
                    'phone_number': None,
                    'short_bio': None,
                    'resume': None,
                    'rate_preference': None,
                }


        return Response({
            'id': candidate.id,
            'first_name': candidate.first_name,
            'last_name': candidate.last_name,
            'email': candidate.email,
            **profile_data
        })

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

        slot_param = self.request.query_params.get('slot')
        if slot_param == 'null':
            qs = qs.filter(slot__isnull=True)
        elif slot_param is not None:
            try:
                slot_id_int = int(slot_param)
                qs = qs.filter(slot_id=slot_id_int)
            except ValueError:
                raise Http400('Invalid slot ID provided. Must be an integer or "null".')

        user_id = self.request.query_params.get('user')
        if user_id is not None:
            qs = qs.filter(user_id=user_id)

        return qs

    # Add a custom list method to ensure a 200 OK with content
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK) # Ensure 200 OK

class ShiftRejectionViewSet(viewsets.ModelViewSet):
    queryset = ShiftRejection.objects.all()
    serializer_class = ShiftRejectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ShiftRejection.objects.select_related('shift', 'slot', 'user')

        shift_id = self.request.query_params.get('shift')
        if shift_id is not None:
            qs = qs.filter(shift_id=shift_id)

        slot_param = self.request.query_params.get('slot')
        if slot_param == 'null':
            qs = qs.filter(slot__isnull=True)
        elif slot_param is not None:
            try:
                slot_id_int = int(slot_param)
                qs = qs.filter(slot_id=slot_id_int)
            except ValueError:
                raise Http400('Invalid slot ID provided. Must be an integer or "null".')

        user_id = self.request.query_params.get('user')
        if user_id is not None:
            qs = qs.filter(user_id=user_id)

        return qs

class ShiftDetailViewSet(BaseShiftViewSet):
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        combined_filter = Q()

        combined_filter |= Q(created_by=user)

        # 2. Shifts associated with pharmacies owned/managed by the user/their organization
        #    CORRECTED: Changed 'organizationmembership' to 'memberships' to match related_name
        is_owner_admin_of_pharmacy_q = Q(
            pharmacy__owner__user=user
        ) | Q(
            pharmacy__organization__memberships__user=user, # <-- CORRECTED HERE: use 'memberships'
            pharmacy__organization__memberships__role='ORG_ADMIN' # <-- CORRECTED HERE: use 'memberships'
        )
        combined_filter |= is_owner_admin_of_pharmacy_q

        # 3. Shifts visible through Membership relationship (client_profile.models.Membership)
        eligible_membership_q = Q(
            pharmacy__memberships__user=user,
            pharmacy__memberships__is_active=True,
        )
        combined_filter |= eligible_membership_q

        if user.role == 'OWNER':
            try:
                owner_onboarding = OwnerOnboarding.objects.get(user=user)
                user_related_chains = Chain.objects.filter(owner=owner_onboarding)
                combined_filter |= Q(
                    visibility='OWNER_CHAIN',
                    pharmacy__in=user_related_chains.values_list('pharmacies', flat=True),
                    pharmacy__chains__is_active=True # Assuming Chain also has is_active and should be active
                )
            except OwnerOnboarding.DoesNotExist:
                pass

        # For ORG_CHAIN: Shift's pharmacy is related to an organization the user is a member of
        # This section uses OrganizationMembership. The filter itself is on OrganizationMembership.
        # It correctly uses `user=user` as filter on the OrganizationMembership model.
        # This part looks correct after the initial import fix.
        user_org_memberships = OrganizationMembership.objects.filter(user=user)
        if user_org_memberships.exists():
            combined_filter |= Q(
                visibility='ORG_CHAIN',
                pharmacy__organization__in=user_org_memberships.values_list('organization', flat=True)
            )

        # ... (rest of the get_queryset logic for public shifts and assigned shifts)
        
        eligible_platform_q = Q()
        top_role = getattr(user, 'role', None)
        allowed_roles_for_user = []
        if top_role == 'PHARMACIST':
            allowed_roles_for_user = ['PHARMACIST']
        elif top_role == 'OTHER_STAFF':
            onboard = OtherStaffOnboarding.objects.filter(user=user).first()
            if onboard:
                sub = getattr(onboard, 'role_type', None)
                if sub == 'TECHNICIAN': allowed_roles_for_user = ['TECHNICIAN']
                elif sub == 'ASSISTANT': allowed_roles_for_user = ['ASSISTANT']
                elif sub == 'INTERN': allowed_roles_for_user = ['INTERN']
                elif sub == 'STUDENT': allowed_roles_for_user = ['STUDENT']
        elif top_role == 'EXPLORER':
            allowed_roles_for_user = ['EXPLORER']

        if allowed_roles_for_user:
            eligible_platform_q |= Q(
                visibility='PLATFORM',
                role_needed__in=allowed_roles_for_user
            )
        combined_filter |= eligible_platform_q

        combined_filter |= Q(slot_assignments__user=user)

        return qs.filter(combined_filter).distinct()

# Add these new View classes at the end of the file
class PublicJobBoardView(generics.ListAPIView):
    """ Lists all available shifts with PLATFORM visibility for the public job board. """
    serializer_class = SharedShiftSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        """
        This method ensures that only shifts with open, unassigned slots are returned.
        """
        return Shift.objects.filter(visibility='PLATFORM').annotate(
            slot_count=Count('slots', distinct=True),
            assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__lt=F('slot_count')).order_by('-created_at')


class SharedShiftDetailView(APIView):
    """
    Provides a read-only, public view for a single shared shift,
    fetched either by its public ID or a secure share token.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        shift = None
        token = request.query_params.get('token')
        shift_id = request.query_params.get('id')

        if token:
            try:
                shift = Shift.objects.get(share_token=token)
            except (Shift.DoesNotExist, ValueError):
                raise NotFound("This share link is invalid or has expired.")
        elif shift_id:
            try:
                shift = Shift.objects.get(pk=shift_id, visibility='PLATFORM') #
            except Shift.DoesNotExist:
                raise NotFound("This shift is not public or could not be found.")
        else:
            return Response({"error": "An ID or token is required."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SharedShiftSerializer(shift)
        return Response(serializer.data)


# Roster
class RosterOwnerViewSet(viewsets.ModelViewSet):
    """
    Lists rostered assignments and allows DELETING a specific assignment.
    """
    serializer_class = RosterAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ShiftSlotAssignment.objects.filter(is_rostered=True)

        owned_pharmacies = Pharmacy.objects.none()
        if hasattr(user, 'owneronboarding'):
            owned_pharmacies |= Pharmacy.objects.filter(owner=user.owneronboarding)

        org_pharmacies = Pharmacy.objects.none()
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org_ids = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').values_list('organization', flat=True)
            org_pharmacies |= Pharmacy.objects.filter(
                Q(organization_id__in=org_ids) | Q(owner__organization_id__in=org_ids)
            )

        controlled_pharmacies = owned_pharmacies | org_pharmacies
        qs = qs.filter(
            shift__pharmacy__in=controlled_pharmacies
        ).select_related('shift__pharmacy', 'slot', 'user').distinct()

        # <<< --- START OF FIX --- >>>
        # Filter by the specific pharmacy ID if provided in the request
        pharmacy_id = self.request.query_params.get('pharmacy')
        if pharmacy_id:
            qs = qs.filter(shift__pharmacy__id=pharmacy_id)
        # <<< --- END OF FIX --- >>>

        start_date_str = self.request.query_params.get('start_date')
        end_date_str = self.request.query_params.get('end_date')

        if start_date_str:
            try:
                start_date = date.fromisoformat(start_date_str)
                qs = qs.filter(slot_date__gte=start_date)
            except ValueError:
                pass

        if end_date_str:
            try:
                end_date = date.fromisoformat(end_date_str)
                qs = qs.filter(slot_date__lte=end_date)
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=['get'], url_path='members-for-roster')
    def members_for_roster(self, request):
        # This action is correct as you provided.
        user = request.user
        pharmacy_id = request.query_params.get('pharmacy_id')
        target_role = request.query_params.get('role')

        controlled_pharmacies_query = Pharmacy.objects.none()
        if hasattr(user, 'owneronboarding'):
            controlled_pharmacies_query |= Pharmacy.objects.filter(owner=user.owneronboarding)

        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org_ids = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').values_list('organization', flat=True)
            controlled_pharmacies_query |= Pharmacy.objects.filter(
                Q(organization_id__in=org_ids) | Q(owner__organization_id__in=org_ids)
            )

        qs = Membership.objects.filter(
            is_active=True,
            pharmacy__in=controlled_pharmacies_query
        )

        if pharmacy_id:
            qs = qs.filter(pharmacy_id=pharmacy_id)
        if target_role:
            qs = qs.filter(role=target_role)

        serializer = MembershipSerializer(qs.select_related('user'), many=True)
        return Response(serializer.data)

class RosterShiftManageViewSet(viewsets.ModelViewSet):
    """
    Handles EDITING, DELETING, and ESCALATING a Shift from the roster context.
    """
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # This logic is correct and remains unchanged
        user = self.request.user
        controlled_pharmacies = Pharmacy.objects.none()
        if hasattr(user, 'owneronboarding'):
            controlled_pharmacies |= Pharmacy.objects.filter(owner=user.owneronboarding)
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org_ids = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').values_list('organization', flat=True)
            controlled_pharmacies |= Pharmacy.objects.filter(Q(organization_id__in=org_ids) | Q(owner__organization_id__in=org_ids))
        return Shift.objects.filter(pharmacy__in=controlled_pharmacies)

    def update(self, request, *args, **kwargs):
        """
        Handles PATCH requests to edit a shift.
        It now supports re-assigning a new user at the same time.
        """
        shift_instance = self.get_object()
        
        # First, let the serializer handle the update of the Shift and its Slots
        response = super().update(request, *args, **kwargs)
        
        # After updating, clear any previous assignments from all slots of this shift.
        shift_instance.slot_assignments.all().delete()

        # Now, check if a new user was selected to be assigned.
        new_user_id = request.data.get('user_id')
        if new_user_id:
            newly_assigned_user = get_object_or_404(User, pk=new_user_id)
            
            # Re-assign the new user to all slots of this shift
            for slot in shift_instance.slots.all():
                rate, rate_reason = get_locked_rate_for_slot(
                    slot=slot,
                    shift=shift_instance,
                    user=newly_assigned_user,
                    override_date=slot.date # Assuming one-off shifts for simplicity in this context
                )
                ShiftSlotAssignment.objects.create(
                    shift=shift_instance,
                    slot=slot,
                    slot_date=slot.date,
                    user=newly_assigned_user,
                    unit_rate=rate,
                    rate_reason=rate_reason,
                    is_rostered=True
                )
        
        return response

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """
        Escalates the shift's visibility to the NEXT level and removes any assigned staff.
        """
        shift = self.get_object()
        
        # Un-assign any current user
        shift.slot_assignments.all().delete()
        
        # This logic correctly finds the next level in your defined flow
        escalation_flow = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM']
        try:
            current_index = escalation_flow.index(shift.visibility)
        except ValueError:
            # If current visibility isn't in the flow, reset to the start
            current_index = -1

        if current_index >= len(escalation_flow) - 1:
            return Response({'detail': 'Already at highest escalation level (Platform).'}, status=status.HTTP_400_BAD_REQUEST)

        next_visibility = escalation_flow[current_index + 1]
        shift.visibility = next_visibility
        shift.escalation_level = current_index + 1 # The integer representation
        shift.save()
        
        return Response({
            'detail': f'Shift escalated to {next_visibility} and is now unassigned.'
        }, status=status.HTTP_200_OK)

class CreateShiftAndAssignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        pharmacy_id = request.data.get('pharmacy_id')
        role_needed = request.data.get('role_needed')
        slot_date_str = request.data.get('slot_date')
        start_time_str = request.data.get('start_time')
        end_time_str = request.data.get('end_time')
        user_id = request.data.get('user_id')

        if not all([pharmacy_id, role_needed, slot_date_str, start_time_str, end_time_str, user_id]):
            return Response({"detail": "Missing required fields for shift creation and assignment."}, status=status.HTTP_400_BAD_REQUEST)

        pharmacy = get_object_or_404(Pharmacy, pk=pharmacy_id)
        candidate_user = get_object_or_404(User, pk=user_id)

        try:
            slot_date = date.fromisoformat(slot_date_str)
            start_time = datetime.strptime(start_time_str, '%H:%M').time()
            end_time = datetime.strptime(end_time_str, '%H:%M').time()
            if start_time >= end_time:
                return Response({"detail": "End time must be after start time."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"detail": "Invalid date or time format. Use YYYY-MM-DD and HH:MM."}, status=status.HTTP_400_BAD_REQUEST)

        requesting_user = request.user
        has_permission = False
        if hasattr(requesting_user, 'owneronboarding') and pharmacy.owner == requesting_user.owneronboarding:
            has_permission = True
        elif OrganizationMembership.objects.filter(
            user=requesting_user,
            role='ORG_ADMIN',
            organization_id=pharmacy.organization_id
        ).exists():
            has_permission = True

        if not has_permission:
            return Response({'detail': 'Permission denied: Not authorized to create shifts for this pharmacy.'}, status=status.HTTP_403_FORBIDDEN)

        new_shift = Shift.objects.create(
            pharmacy=pharmacy,
            role_needed=role_needed,
            employment_type='FULL_TIME',
            visibility='FULL_PART_TIME',
            single_user_only=True,
            created_by=requesting_user,
            rate_type='FLEXIBLE',
        )

        new_slot = ShiftSlot.objects.create(
            shift=new_shift,
            date=slot_date,
            start_time=start_time,
            end_time=end_time,
            is_recurring=False,
            recurring_days=[],
            recurring_end_date=None
        )

        rate, rate_reason = get_locked_rate_for_slot(
            slot=new_slot,
            shift=new_shift,
            user=candidate_user,
            override_date=slot_date
        )

        assignment = ShiftSlotAssignment.objects.create(
            shift=new_shift,
            slot=new_slot,
            slot_date=slot_date,
            user=candidate_user,
            unit_rate=rate,
            rate_reason=rate_reason,
            is_rostered=True
        )

        return Response({
            "detail": "Shift created and assigned successfully.",
            "shift_id": new_shift.id,
            "slot_id": new_slot.id,
            "assignment_id": assignment.id
        }, status=status.HTTP_201_CREATED)

class RosterWorkerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RosterAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns rostered assignments for pharmacies where the user is a member.
        The queryset is now filtered by the 'pharmacy', 'start_date', and 
        'end_date' query parameters if they are provided in the request.
        """
        user = self.request.user
        
        # Get all pharmacies where the user has an active membership
        member_pharmacy_ids = Membership.objects.filter(
            user=user, is_active=True
        ).values_list('pharmacy_id', flat=True)
        
        # Start with a base queryset of all assignments in those pharmacies
        qs = ShiftSlotAssignment.objects.filter(
            is_rostered=True,
            shift__pharmacy_id__in=member_pharmacy_ids
        ).select_related('shift__pharmacy', 'slot', 'user').distinct()

        # --- START OF FIX ---

        # 1. Filter by the specific pharmacy ID from the request
        pharmacy_id_param = self.request.query_params.get('pharmacy')
        if pharmacy_id_param:
            try:
                # Security check: Ensure the requested pharmacy is one the user can see
                requested_pharmacy_id = int(pharmacy_id_param)
                if requested_pharmacy_id in member_pharmacy_ids:
                    qs = qs.filter(shift__pharmacy_id=requested_pharmacy_id)
                else:
                    # If user requests a pharmacy they aren't a member of, return nothing
                    return ShiftSlotAssignment.objects.none()
            except (ValueError, TypeError):
                # If pharmacy_id is not a valid integer, ignore it
                pass

        # 2. Filter by the date range from the request
        start_date_str = self.request.query_params.get('start_date')
        end_date_str = self.request.query_params.get('end_date')

        if start_date_str:
            try:
                start_date = date.fromisoformat(start_date_str)
                qs = qs.filter(slot_date__gte=start_date)
            except ValueError:
                pass  # Ignore invalid date format

        if end_date_str:
            try:
                end_date = date.fromisoformat(end_date_str)
                qs = qs.filter(slot_date__lte=end_date)
            except ValueError:
                pass  # Ignore invalid date format
                
        # --- END OF FIX ---
        
        return qs

    @action(detail=False, methods=['get'])
    def pharmacies(self, request):
        """
        Returns a list of all pharmacies where user is an active member.
        """
        user = request.user
        memberships = Membership.objects.filter(user=user, is_active=True).select_related('pharmacy')
        data = [
            {
                "id": m.pharmacy.id,
                "name": m.pharmacy.name,
                "address": m.pharmacy.address,
            }
            for m in memberships
        ]
        return Response(data)

        
class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Owner or claimed org admin can see all, workers see only their own
        if not self.is_owner_or_claimed_admin(user):
            qs = qs.filter(user=user)
        return qs

    def perform_create(self, serializer):
        slot_assignment_id = self.request.data.get('slot_assignment')
        slot_assignment = ShiftSlotAssignment.objects.get(id=slot_assignment_id)
        if slot_assignment.user != self.request.user:
            raise PermissionDenied("You can only request leave for your own assigned slots.")
        if LeaveRequest.objects.filter(slot_assignment=slot_assignment, user=self.request.user, status='PENDING').exists():
            raise ValidationError("A pending leave request already exists for this slot.")
        leave = serializer.save(user=self.request.user)

        shift = slot_assignment.shift
        pharmacy = shift.pharmacy

        # Email recipients
        notification_emails = []
        owner_user = getattr(pharmacy.owner, "user", None) if hasattr(pharmacy, "owner") and pharmacy.owner else None
        org_admins = []
        if hasattr(pharmacy.owner, "organization_claimed") and pharmacy.owner.organization_claimed:
            org_admins = OrganizationMembership.objects.filter(
                role='ORG_ADMIN',
                organization_id=pharmacy.organization_id
            ).select_related('user')

        for admin in org_admins:
            if admin.user and admin.user.email and admin.user.email not in notification_emails:
                notification_emails.append(admin.user.email)
        if owner_user and owner_user.email and owner_user.email not in notification_emails:
            notification_emails.append(owner_user.email)

        # Who should the roster link be for? (Prefer first org_admin, fallback to owner)
        if org_admins:
            roster_link_user = org_admins[0].user
        elif owner_user:
            roster_link_user = owner_user
        else:
            roster_link_user = None

        ctx = {
            "worker_name": self.request.user.get_full_name() or self.request.user.email,
            "worker_email": self.request.user.email,
            "leave_type": leave.get_leave_type_display(),
            "note": leave.note,
            "shift_date": slot_assignment.slot_date,
            "shift_time": f"{slot_assignment.slot.start_time}–{slot_assignment.slot.end_time}",
            "pharmacy_name": pharmacy.name,
            "shift_link": build_roster_email_link(roster_link_user, pharmacy)
        }
        if notification_emails:
            async_task(
                'users.tasks.send_async_email',
                subject=f"Leave request from {ctx['worker_name']} for {pharmacy.name}",
                recipient_list=notification_emails,
                template_name="emails/leave_request.html",
                context=ctx,
                text_template="emails/leave_request.txt"
            )

    def is_owner_or_claimed_admin(self, user):
        from .models import Pharmacy  # To avoid circular imports
        is_owner = Pharmacy.objects.filter(owner__user=user).exists()
        is_claimed_admin = OrganizationMembership.objects.filter(
            user=user,
            role='ORG_ADMIN',
            organization__pharmacies__owner__organization_claimed=True
        ).exists()
        return is_owner or is_claimed_admin

    def _assert_owner_or_claimed_admin(self, leave):
        shift = leave.slot_assignment.shift
        pharmacy = shift.pharmacy
        user = self.request.user
        is_owner = hasattr(pharmacy, "owner") and pharmacy.owner and getattr(pharmacy.owner, "user", None) == user
        is_claimed_admin = (
            hasattr(pharmacy.owner, "organization_claimed")
            and pharmacy.owner.organization_claimed
            and OrganizationMembership.objects.filter(
                user=user,
                role='ORG_ADMIN',
                organization_id=pharmacy.organization_id
            ).exists()
        )
        if not (is_owner or is_claimed_admin):
            raise PermissionDenied("Not authorized to approve/reject this leave request.")

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        leave = self.get_object()
        self._assert_owner_or_claimed_admin(leave)
        leave.status = 'APPROVED'
        leave.date_resolved = timezone.now()
        leave.save()
        ctx = {
            "leave_type": leave.get_leave_type_display(),
            "shift_date": leave.slot_assignment.slot_date,
            "pharmacy_name": leave.slot_assignment.shift.pharmacy.name,
            "shift_link": build_roster_email_link(leave.user, leave.slot_assignment.shift.pharmacy),
        }
        async_task(
            'users.tasks.send_async_email',
            subject=f"Your leave request for {ctx['pharmacy_name']} was approved",
            recipient_list=[leave.user.email],
            template_name="emails/leave_approved.html",
            context=ctx,
            text_template="emails/leave_approved.txt"
        )
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        leave = self.get_object()
        self._assert_owner_or_claimed_admin(leave)
        leave.status = 'REJECTED'
        leave.date_resolved = timezone.now()
        leave.save()
        ctx = {
            "leave_type": leave.get_leave_type_display(),
            "shift_date": leave.slot_assignment.slot_date,
            "pharmacy_name": leave.slot_assignment.shift.pharmacy.name,
            "shift_link": build_roster_email_link(leave.user, leave.slot_assignment.shift.pharmacy),
        }
        async_task(
            'users.tasks.send_async_email',
            subject=f"Your leave request for {ctx['pharmacy_name']} was rejected",
            recipient_list=[leave.user.email],
            template_name="emails/leave_rejected.html",
            context=ctx,
            text_template="emails/leave_rejected.txt"
        )
        return Response({'status': 'rejected'})



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

# from client_profile.services import generate_invoice_from_shifts
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

        required = [
            'issuer_abn', 'gst_registered', 'super_rate_snapshot',
            'bank_account_name', 'bsb', 'account_number', 'bill_to_email', 'cc_emails',
        ]
        missing = [f for f in required if f not in data]
        if missing:
            return Response(
                {'error': f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse custom line items
        line_items_raw = data.get('line_items')
        custom_lines = []
        if line_items_raw:
            if isinstance(line_items_raw, str):
                try:
                    custom_lines = json.loads(line_items_raw)
                except Exception as ex:
                    return Response({'error': f'Invalid line_items: {ex}'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                custom_lines = line_items_raw

        # Parse shift_ids
        shift_ids_raw = data.get('shift_ids')
        shift_ids = []
        if shift_ids_raw:
            if isinstance(shift_ids_raw, str):
                try:
                    shift_ids = json.loads(shift_ids_raw)
                except Exception as ex:
                    return Response({'error': f'Invalid shift_ids: {ex}'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                shift_ids = shift_ids_raw
        else:
            shift_ids = []

        invoice = generate_invoice_from_shifts(
            user=request.user,
            pharmacy_id=data.get('pharmacy'),
            shift_ids=shift_ids,
            custom_lines=custom_lines,
            external=data.get('external', False),
            billing_data=data,
            due_date=data.get('due_date')
        )

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

# from .services import generate_preview_invoice_lines

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def preview_invoice_lines(request, shift_id):
    try:
        shift = Shift.objects.get(id=shift_id)
    except Shift.DoesNotExist:
        return Response({"error": "Shift not found"}, status=404)

    line_items = generate_preview_invoice_lines(shift, request.user)
    return Response(line_items)


from django.http import HttpResponse
# from .services import render_invoice_to_pdf

def invoice_pdf_view(request, invoice_id):
    invoice = Invoice.objects.get(pk=invoice_id)
    pdf_bytes = render_invoice_to_pdf(invoice)
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response['Content-Disposition'] = f'inline; filename="invoice_{invoice.id}.pdf"'
    return response
