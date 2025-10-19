# client_profile/views.py
from rest_framework import generics, permissions, status, viewsets, mixins
from rest_framework.pagination import PageNumberPagination
from .serializers import *
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS
from rest_framework.generics import CreateAPIView, RetrieveUpdateAPIView
from rest_framework.exceptions import NotFound, APIException, PermissionDenied, ValidationError
from rest_framework.decorators import action, api_view, permission_classes
from .models import *
from users.permissions import *
from users.serializers import (
    UserProfileSerializer,
)
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import json
from django.db.models import Q, Count, F, Avg, Exists, OuterRef
from django.utils import timezone
from client_profile.services import get_locked_rate_for_slot, expand_shift_slots, generate_invoice_from_shifts, render_invoice_to_pdf, generate_preview_invoice_lines
from client_profile.utils import build_shift_email_context, clean_email, build_roster_email_link, get_frontend_dashboard_url
from django.utils.crypto import get_random_string
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.conf import settings
class Http400(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Bad Request.'
    default_code = 'bad_request'
from django_q.tasks import async_task
from datetime import date, datetime
from django_q.models import Schedule
from django.core.signing import TimestampSigner, BadSignature
from django.contrib.contenttypes.models import ContentType
from django.apps import apps
from client_profile.tasks import cancel_referee_reminder, schedule_referee_reminder, cancel_all_referee_reminders
from django.db import transaction, IntegrityError
from datetime import timedelta                   # used in TimestampSigner max_age
from decimal import Decimal                      # used in manual_assign
import uuid                                      # used in generate_share_link
from django.contrib.auth import get_user_model   # used in ChainViewSet.add_user
from users.models import User                    # referenced throughout (accept_user, etc.)
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


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

# class PharmacistOnboardingCreateView(CreateAPIView):
#     parser_classes = [MultiPartParser, FormParser]
#     serializer_class   = PharmacistOnboardingSerializer
#     permission_classes = [permissions.IsAuthenticated, IsPharmacist, IsOTPVerified]

#     def perform_create(self, serializer):
#         serializer.save()

# class PharmacistOnboardingDetailView(RetrieveUpdateAPIView):
#     parser_classes = [MultiPartParser, FormParser]
#     serializer_class   = PharmacistOnboardingSerializer
#     permission_classes = [permissions.IsAuthenticated, IsPharmacist, IsOTPVerified]

#     def get_object(self):
#         try:
#             return PharmacistOnboarding.objects.get(user=self.request.user)
#         except PharmacistOnboarding.DoesNotExist:
#             raise NotFound("Pharmacist onboarding profile not found.")

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

# class RefereeConfirmView(APIView):
#     def post(self, request, profile_pk, ref_idx, *args, **kwargs):
#         onboarding_models = [PharmacistOnboarding, OtherStaffOnboarding, ExplorerOnboarding]
#         instance, model_name = None, None
#         for Model in onboarding_models:
#             try:
#                 instance = Model.objects.get(pk=profile_pk)
#                 model_name = Model._meta.model_name
#                 break
#             except Model.DoesNotExist: continue
#         if not instance: return Response({'detail': 'Onboarding profile not found.'}, status=404)

#         if str(ref_idx) == "1":
#             instance.referee1_confirmed = True
#             instance.referee1_rejected = False
#         elif str(ref_idx) == "2":
#             instance.referee2_confirmed = True
#             instance.referee2_rejected = False
#         else: return Response({'detail': 'Invalid referee index.'}, status=400)
#         instance.save()

#         # FIX: Cancel any old, scheduled tasks to prevent race conditions.
#         Schedule.objects.filter(
#             func='client_profile.tasks.final_evaluation',
#             args=f"'{model_name}',{instance.pk}"
#         ).delete()

#         # Now, safely trigger a new, immediate evaluation.
#         async_task('client_profile.tasks.final_evaluation', model_name, instance.pk)
#         return Response({'success': True, 'message': 'Referee confirmed.'}, status=200)

class RefereeSubmitResponseView(generics.CreateAPIView):
    """
    POST /references/submit/<token>/
    Body: RefereeResponseSerializer fields
    Effect:
      - Saves a RefereeResponse (1 per (profile, ref_idx) enforced)
      - Maps would_rehire -> referee{N}_confirmed / referee{N}_rejected
      - Sends decline email to candidate ONLY on first transition to rejected
      - Cancels single-ref reminder if rejected or confirmed
    """
    serializer_class = RefereeResponseSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        # 1) Unsign token -> (model_name, pk, referee_index)
        token = self.kwargs.get('token')
        signer = TimestampSigner()
        try:
            data = signer.unsign(token, max_age=timedelta(days=14))
            model_name, pk, referee_index = data.split(':')
            pk = int(pk)
            referee_index = int(referee_index)
            if referee_index not in (1, 2):
                raise ValueError
        except (BadSignature, ValueError):
            raise PermissionDenied("This reference link is invalid or has expired.")

        # 2) Locate onboarding record dynamically
        OnboardingModel = apps.get_model('client_profile', model_name)
        ct = ContentType.objects.get_for_model(OnboardingModel)

        # 3) Prevent duplicate submissions per candidate+referee
        if RefereeResponse.objects.filter(
            content_type=ct, object_id=pk, referee_index=referee_index
        ).exists():
            # DRF ValidationError -> clean 400 JSON, not a 500
            raise ValidationError({"detail": "A reference has already been submitted for this candidate."})

        with transaction.atomic():
            onboarding = OnboardingModel.objects.select_for_update().get(pk=pk)

            try:
                response = serializer.save(
                    content_type=ct,
                    object_id=pk,
                    referee_index=referee_index,
                )
            except IntegrityError:
                # unique_together (content_type, object_id, referee_index)
                raise ValidationError({"detail": "A reference has already been submitted for this candidate."})

            would = (response.would_rehire or '').strip().lower()
            confirmed_field = f'referee{referee_index}_confirmed'
            rejected_field  = f'referee{referee_index}_rejected'

            was_confirmed = bool(getattr(onboarding, confirmed_field))
            was_rejected  = bool(getattr(onboarding, rejected_field))

            if would == 'no':
                changed_to_rejected = not was_rejected
                setattr(onboarding, confirmed_field, False)
                setattr(onboarding, rejected_field, True)
                onboarding.save(update_fields=[confirmed_field, rejected_field])

                try:
                    cancel_referee_reminder(model_name, onboarding.pk, referee_index)
                except Exception:
                    pass

                if changed_to_rejected:
                    # send AFTER COMMIT
                    transaction.on_commit(lambda: async_task(
                        'users.tasks.send_async_email',
                        subject="One of your referees declined",
                        recipient_list=[onboarding.user.email],
                        template_name="emails/referee_declined_candidate.html",
                        text_template="emails/referee_declined_candidate.txt",
                        context={
                            "candidate_first_name": onboarding.user.first_name or onboarding.user.username,
                            "referee_index": referee_index,
                            "dashboard_url": get_frontend_dashboard_url(onboarding.user),
                        },
                    ))
            else:
                changed_to_confirmed = not was_confirmed
                setattr(onboarding, confirmed_field, True)
                setattr(onboarding, rejected_field, False)
                onboarding.save(update_fields=[confirmed_field, rejected_field])

                try:
                    cancel_referee_reminder(model_name, onboarding.pk, referee_index)
                except Exception:
                    pass


class RefereeRejectView(APIView):
    """
    POST /onboarding/referee-reject/<profile_pk>/<ref_idx>/
    Effect:
      - Sets referee{idx}_confirmed=False, referee{idx}_rejected=True (idempotent)
      - Emails the candidate ONLY on first transition to rejected
      - Cancels single-ref reminder for this referee
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, profile_pk, ref_idx, *args, **kwargs):
        onboarding_models = [PharmacistOnboarding, OtherStaffOnboarding, ExplorerOnboarding]
        instance, model_name, Model = None, None, None
        for M in onboarding_models:
            try:
                instance = M.objects.get(pk=profile_pk)
                model_name = M._meta.model_name
                Model = M
                break
            except M.DoesNotExist:
                continue
        if not instance:
            return Response({'detail': 'Onboarding profile not found.'}, status=404)

        if str(ref_idx) not in ("1", "2"):
            return Response({'detail': 'Invalid referee index.'}, status=400)
        idx = int(ref_idx)

        # Do an atomic, conditional update so we only send email on the first transition.
        confirmed_field = f"referee{idx}_confirmed"
        rejected_field  = f"referee{idx}_rejected"

        with transaction.atomic():
            # Reload with a lock to avoid race / double sends
            row = Model.objects.select_for_update().get(pk=instance.pk)
            was_rejected = bool(getattr(row, rejected_field))

            # If already rejected, do nothing (idempotent)
            if was_rejected:
                # Still cancel reminder just in case a schedule remains
                try:
                    cancel_referee_reminder(model_name, row.pk, idx)
                except Exception:
                    pass
                return Response({'success': True, 'message': 'Already declined.'}, status=200)

            # First time -> flip flags
            setattr(row, confirmed_field, False)
            setattr(row, rejected_field, True)
            row.save(update_fields=[confirmed_field, rejected_field])

            # Cancel this referee's reminder (if any)
            try:
                cancel_referee_reminder(model_name, row.pk, idx)
            except Exception:
                pass

            # Notify candidate exactly once (first transition only), after the DB commit
            transaction.on_commit(lambda: async_task(
                'users.tasks.send_async_email',
                subject="One of your referees declined",
                recipient_list=[row.user.email],
                template_name="emails/referee_declined_candidate.html",
                text_template="emails/referee_declined_candidate.txt",
                context={
                    "candidate_first_name": row.user.first_name or row.user.username,
                    "referee_index": idx,
                    "dashboard_url": get_frontend_dashboard_url(row.user),
                },
            ))

        return Response({'success': True, 'message': 'Referee rejected.'}, status=200)

# === New Onboarding ===
class PharmacistOnboardingV2MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsPharmacist, IsOTPVerified]
    serializer_class = PharmacistOnboardingV2Serializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_object(self):
        obj, _ = PharmacistOnboarding.objects.get_or_create(user=self.request.user)
        return obj

class OtherStaffOnboardingV2MeView(generics.RetrieveUpdateAPIView):
    """
    V2 tabbed flow for OtherStaff.
    Mirrors PharmacistOnboardingV2MeView but for OTHER_STAFF role.
    """
    permission_classes = [permissions.IsAuthenticated, IsOtherstaff, IsOTPVerified]
    serializer_class = OtherStaffOnboardingV2Serializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_object(self):
        obj, _ = OtherStaffOnboarding.objects.get_or_create(user=self.request.user)
        return obj

class ExplorerOnboardingV2MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsExplorer, IsOTPVerified]
    serializer_class = ExplorerOnboardingV2Serializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_object(self):
        obj, _ = ExplorerOnboarding.objects.get_or_create(user=self.request.user)
        return obj




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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        user_serializer = UserProfileSerializer(user)

        # Pharmacies I control: Owner pharmacies ∪ pharmacies where I’m PHARMACY_ADMIN
        owner_pharmacies = Pharmacy.objects.filter(owner__user=user)
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )
        pharmacies = (owner_pharmacies | admin_pharmacies).distinct()

        if not pharmacies.exists():
            # Keep your exact empty payload behavior for non-owners/non-admins
            data = {
                "user": user_serializer.data,
                "upcoming_shifts_count": 0,
                "confirmed_shifts_count": 0,
                "shifts": [],
                "bills_summary": {
                    "total_billed": "N/A",
                    "points": "N/A"
                },
            }
            return Response(data)

        # Same as before, just using the unified pharmacies set
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
        member_pharmacy_ids = Membership.objects.filter(
            user=user, is_active=True
        ).values_list('pharmacy_id', flat=True)

        community_shifts = Shift.objects.filter(
            pharmacy_id__in=member_pharmacy_ids,
            visibility__in=COMMUNITY_LEVELS, # Use the constant you already have
            slots__date__gte=today
        ).exclude(
            slots__assignments__user=user # Exclude shifts they are already assigned to
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

        member_pharmacy_ids = Membership.objects.filter(
            user=user, is_active=True
        ).values_list('pharmacy_id', flat=True)

        community_shifts = Shift.objects.filter(
            pharmacy_id__in=member_pharmacy_ids,
            visibility__in=COMMUNITY_LEVELS, # Use the constant you already have
            slots__date__gte=today
        ).exclude(
            slots__assignments__user=user # Exclude shifts they are already assigned to
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

        # Pharmacies where I am an active Pharmacy Admin
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )

        # ORG_ADMIN sees all org pharmacies + any claimed-owner pharmacies
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').first().organization
            return (
                Pharmacy.objects.filter(
                    Q(organization=org) |
                    Q(owner__organization=org)
                ) | admin_pharmacies
            ).distinct()
        # Otherwise only this user's own
        try:
            owner = OwnerOnboarding.objects.get(user=user)
            return (Pharmacy.objects.filter(owner=owner) | admin_pharmacies).distinct()
        except OwnerOnboarding.DoesNotExist:
            # Not an owner: show only the pharmacies I admin
            return admin_pharmacies
        return Pharmacy.objects.filter(owner=owner)

    def perform_create(self, serializer):
        user = self.request.user
        owner_onboarding = None
        organization = None

        if hasattr(user, 'owneronboarding'):
            owner_onboarding = user.owneronboarding
        
        org_membership = user.organization_memberships.filter(role='ORG_ADMIN').first()
        if org_membership:
            organization = org_membership.organization

        if not owner_onboarding and not organization:
            raise PermissionDenied("You must have an owner profile or be an org admin to create a pharmacy.")
        
        # Use a database transaction to ensure both operations succeed or fail together
        with transaction.atomic():
            # Save the pharmacy instance
            pharmacy = serializer.save(owner=owner_onboarding, organization=organization)

            # NOW, CREATE THE MEMBERSHIP RECORD FOR THE OWNER
            # This ensures the owner is also a member and can use member-only features like chat.
            Membership.objects.get_or_create(
                user=user,
                pharmacy=pharmacy,
                defaults={
                    'role': 'PHARMACY_ADMIN',
                    'employment_type': 'FULL_TIME',
                    'is_active': True,
                    'invited_by': user,
                }
            )

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
        
        # 1. Determine ALL pharmacies where the user should be able to see the member list.
        
        # Pharmacies they own
        owned_pharmacies = Pharmacy.objects.none()
        if hasattr(user, 'owneronboarding'):
            owned_pharmacies = Pharmacy.objects.filter(owner=user.owneronboarding)

        # Pharmacies in their org (if ORG_ADMIN)
        org_pharmacies = Pharmacy.objects.none()
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org_ids = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').values_list('organization', flat=True)
            org_pharmacies = Pharmacy.objects.filter(
                Q(organization_id__in=org_ids) | Q(owner__organization_id__in=org_ids)
            )

        # Pharmacies they are a PHARMACY_ADMIN in
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )
        
        # NEW RULE: Pharmacies they are a regular, active member of
        member_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__is_active=True
        )

        # Combine all visible pharmacies into one master queryset
        visible_pharmacies = (owned_pharmacies | org_pharmacies | admin_pharmacies | member_pharmacies).distinct()

        # 2. Base the Membership query on these visible pharmacies.
        qs = Membership.objects.filter(pharmacy__in=visible_pharmacies)

        # 3. Apply the optional query filters from the request.
        pharmacy_id = self.request.query_params.get('pharmacy_id')
        chain_id = self.request.query_params.get('chain_id')
        
        if pharmacy_id:
            qs = qs.filter(pharmacy_id=pharmacy_id)
        elif chain_id:
            # --- THIS IS THE FIX ---
            # Correctly filter by pharmacies belonging to a chain using the proper relationship
            qs = qs.filter(pharmacy__chains__id=chain_id)
            # ---------------------

        return qs.distinct()


    def check_object_permissions(self, request, obj):
        user = request.user
        pharm = obj.pharmacy

        # Owner of this pharmacy
        if pharm and pharm.owner and pharm.owner.user == user:
            return

        # Org Admin of this pharmacy’s org
        if pharm and OrganizationMembership.objects.filter(
            user=user,
            role='ORG_ADMIN',
            organization_id=pharm.organization_id
        ).exists():
            return

        # Pharmacy Admin of THIS pharmacy
        if pharm and Membership.objects.filter(
            user=user,
            pharmacy=pharm,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists():
            return

        self.permission_denied(request, message="Not allowed to modify this membership.")


    def destroy(self, request, *args, **kwargs):
        """
        Permanently deletes a membership.
        First, it removes the member from any chat rooms they are a part of to satisfy the PROTECT rule.
        Then, it deletes the membership record itself.
        WARNING: This will also delete all messages sent by this member.
        """
        membership = self.get_object()

        with transaction.atomic():
            # Step 1: Delete the protecting Participant records first.
            # The related_name on the Participant model is 'chat_participations'.
            membership.chat_participations.all().delete()

            # Step 2: Now that the protection is removed, delete the membership.
            # This will also cascade-delete all of their messages.
            membership.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

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

                base = (getattr(settings, "FRONTEND_BASE_URL", "") or "").rstrip("/")
                admin_landing_url = f"{base}/dashboard/owner/manage-pharmacies/my-pharmacies"
                login_url = f"{base}/login"

                is_admin_role = (role == "PHARMACY_ADMIN")

                context = {
                    "pharmacy_name": pharmacy.name,
                    "inviter": inviter.get_full_name() or inviter.email or "A pharmacy admin",
                    "role": role.title() if role else "",
                    "is_admin": is_admin_role,                    # <-- NEW
                    "admin_landing_url": admin_landing_url,       # <-- NEW
                }

                recipient_list = [user.email]


                if user_created:
                    uid = urlsafe_base64_encode(force_bytes(user.pk))
                    token = default_token_generator.make_token(user)
                    context["magic_link"] = f"{base}/reset-password/{uid}/{token}/"

                    subject = (
                        f"You’ve been invited as Pharmacy Admin at {pharmacy.name}"
                        if is_admin_role
                        else "You’re invited to join a pharmacy on ChemistTasker"
                    )

                    transaction.on_commit(lambda: async_task(
                        'users.tasks.send_async_email',
                        subject=subject,
                        recipient_list=recipient_list,
                        template_name="emails/pharmacy_invite_new_user.html",
                        context=context,
                        text_template="emails/pharmacy_invite_new_user.txt",
                    ))

                else:
                    # For admins, send them straight to admin dashboard; others go to login
                    context["frontend_dashboard_link"] = admin_landing_url if is_admin_role else login_url

                    subject = (
                        f"You’ve been added as Pharmacy Admin at {pharmacy.name}"
                        if is_admin_role
                        else "You have been added to a pharmacy on ChemistTasker"
                    )

                    transaction.on_commit(lambda: async_task(
                        'users.tasks.send_async_email',
                        subject=subject,
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


    # --- Single Invite (scoped to target pharmacy) ---
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        inviter = request.user

        # Require a target pharmacy id
        pharmacy_id_for_perm = data.get('pharmacy')
        if not pharmacy_id_for_perm:
            return Response({'detail': 'Field "pharmacy" is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Permission: ORG_ADMIN (any pharmacy in org), Owner of THIS pharmacy, or PHARMACY_ADMIN of THIS pharmacy
        is_org_admin = OrganizationMembership.objects.filter(
            user=inviter, role='ORG_ADMIN'
        ).exists()

        is_owner_of_target = Pharmacy.objects.filter(
            id=pharmacy_id_for_perm, owner__user=inviter
        ).exists()

        is_pharm_admin_of_target = Membership.objects.filter(
            user=inviter,
            pharmacy_id=pharmacy_id_for_perm,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists()

        if not (is_org_admin or is_owner_of_target or is_pharm_admin_of_target):
            return Response(
                {'detail': 'Only the pharmacy owner, org admins, or that pharmacy’s admins may invite.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Safe default for Pharmacy Admin invites
        if data.get('role') == 'PHARMACY_ADMIN' and not data.get('employment_type'):
            data['employment_type'] = 'FULL_TIME'

        membership, error = self._create_membership_invite(data, inviter)
        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # --- Bulk Invite (row-by-row scope enforcement) ---
    @action(detail=False, methods=['post'], url_path='bulk_invite')
    def bulk_invite(self, request):
        inviter = request.user
        invitations = request.data.get('invitations', [])
        if not invitations or not isinstance(invitations, list):
            return Response({'detail': 'Invitations must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        # Precompute scopes for fast checks
        is_org_admin = OrganizationMembership.objects.filter(
            user=inviter, role='ORG_ADMIN'
        ).exists()

        owner_pharm_ids = set(
            str(pid) for pid in Pharmacy.objects.filter(owner__user=inviter).values_list('id', flat=True)
        )
        admin_pharm_ids = set(
            str(pid) for pid in Membership.objects.filter(
                user=inviter, role='PHARMACY_ADMIN', is_active=True
            ).values_list('pharmacy_id', flat=True)
        )

        results, errors = [], []

        for idx, invite in enumerate(invitations):
            # Validate target pharmacy per row
            pid = invite.get('pharmacy')
            if not pid:
                errors.append({'line': idx + 1, 'email': invite.get('email'), 'error': 'Field "pharmacy" is required.'})
                continue

            # Row-level permission: ORG_ADMIN (any), Owner of pid, or PHARMACY_ADMIN of pid
            pid_str = str(pid)
            allowed = (
                is_org_admin
                or (pid_str in owner_pharm_ids)
                or (pid_str in admin_pharm_ids)
            )
            if not allowed:
                errors.append({
                    'line': idx + 1,
                    'email': invite.get('email'),
                    'error': 'Not permitted to invite into this pharmacy.'
                })
                continue

            # Default employment type for Pharmacy Admin if omitted
            if invite.get('role') == 'PHARMACY_ADMIN' and not invite.get('employment_type'):
                invite['employment_type'] = 'FULL_TIME'

            membership, error = self._create_membership_invite(invite, inviter)
            if error:
                errors.append({'line': idx + 1, 'email': invite.get('email'), 'error': error})
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
            return Response(response, status=status.HTTP_207_MULTI_STATUS)  # Partial success

        return Response(response, status=status.HTTP_201_CREATED)


class MembershipInviteLinkViewSet(viewsets.ModelViewSet):
    """
    POST /membership-invite-links/    -> create a magic link
    GET  /membership-invite-links/?pharmacy=<id> -> list my links
    """
    serializer_class = MembershipInviteLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Owners see own pharmacies; Org-Admins see org; Pharmacy Admins see their pharmacies
        # mirror visibility logic from MembershipViewSet.get_queryset
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').first().organization
            visible_pharmacies = Pharmacy.objects.filter(Q(organization=org) | Q(owner__organization=org))
        else:
            try:
                owner = OwnerOnboarding.objects.get(user=user)
                visible_pharmacies = Pharmacy.objects.filter(owner=owner)
            except OwnerOnboarding.DoesNotExist:
                visible_pharmacies = Pharmacy.objects.none()
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user, memberships__role='PHARMACY_ADMIN', memberships__is_active=True
        )
        visible_pharmacies = (visible_pharmacies | admin_pharmacies).distinct()
        qs = MembershipInviteLink.objects.filter(pharmacy__in=visible_pharmacies, is_active=True)
        pid = self.request.query_params.get('pharmacy')
        return qs.filter(pharmacy_id=pid) if pid else qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        pharmacy_id = data.get('pharmacy')
        category = data.get('category')
        days = int(data.get('expires_in_days') or 14)

        if not pharmacy_id or not category:
            return Response({'detail': 'pharmacy and category are required.'}, status=400)

        user = request.user
        is_org_admin = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists()
        is_owner = Pharmacy.objects.filter(id=pharmacy_id, owner__user=user).exists()
        is_pharm_admin = Membership.objects.filter(user=user, pharmacy_id=pharmacy_id, role='PHARMACY_ADMIN', is_active=True).exists()
        if not (is_org_admin or is_owner or is_pharm_admin):
            return Response({'detail': 'Not allowed to generate links for this pharmacy.'}, status=403)

        expires_at = timezone.now() + timedelta(days=days)
        serializer = self.get_serializer(data={'pharmacy': pharmacy_id, 'category': category, 'expires_at': expires_at})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)


class MagicLinkInfoView(APIView):
    """
    GET /magic/memberships/<token>/
    Validate link and return pharmacy name + category (no auth).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            link = MembershipInviteLink.objects.get(token=token)
        except MembershipInviteLink.DoesNotExist:
            return Response({'detail': 'Invalid link.'}, status=404)
        if not link.is_valid():
            return Response({'detail': 'Link expired or inactive.'}, status=410)

        return Response({
            'pharmacy': link.pharmacy_id,
            'pharmacy_name': link.pharmacy.name,
            'category': link.category,
            'expires_at': link.expires_at,
        })


class SubmitMembershipApplication(APIView):
    """
    POST /magic/memberships/<token>/apply
    Body: { role, first_name, last_name, mobile_number, (level fields), (email optional) }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        try:
            link = MembershipInviteLink.objects.get(token=token)
        except MembershipInviteLink.DoesNotExist:
            return Response({'detail': 'Invalid link.'}, status=404)
        if not link.is_valid():
            return Response({'detail': 'Link expired or inactive.'}, status=410)

        payload = request.data.copy()
        payload['invite_link'] = link.pk  # serializer will lock category+pharmacy from link
        serializer = MembershipApplicationSerializer(data=payload, context={'request': request})
        serializer.is_valid(raise_exception=True)
        app = serializer.save(
            pharmacy=link.pharmacy,
            category=link.category,
            invite_link=link,
            submitted_by=request.user if request.user.is_authenticated else None,
        )

        # async notify owner + admins
        transaction.on_commit(lambda: async_task(
            'client_profile.tasks.email_membership_application_submitted', app.id
        ))

        return Response(MembershipApplicationSerializer(app).data, status=201)



class MembershipApplicationViewSet(viewsets.ModelViewSet):
    """
    Owners/Org Admins/Pharmacy Admins can list pending apps for their pharmacies,
    and approve/reject.
    """
    serializer_class = MembershipApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # visible pharmacies same as above
        if OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').exists():
            org = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').first().organization
            visible_pharmacies = Pharmacy.objects.filter(Q(organization=org) | Q(owner__organization=org))
        else:
            try:
                owner = OwnerOnboarding.objects.get(user=user)
                visible_pharmacies = Pharmacy.objects.filter(owner=owner)
            except OwnerOnboarding.DoesNotExist:
                visible_pharmacies = Pharmacy.objects.none()
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user, memberships__role='PHARMACY_ADMIN', memberships__is_active=True
        )
        visible_pharmacies = (visible_pharmacies | admin_pharmacies).distinct()
        qs = MembershipApplication.objects.filter(pharmacy__in=visible_pharmacies).order_by('-submitted_at')
        status_q = self.request.query_params.get('status')
        return qs.filter(status=status_q) if status_q else qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        app = self.get_object()
        user = request.user
        # Permission for this pharmacy
        pharm_id = app.pharmacy_id
        is_org_admin = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN', organization_id=app.pharmacy.organization_id).exists()
        is_owner = Pharmacy.objects.filter(id=pharm_id, owner__user=user).exists()
        is_pharm_admin = Membership.objects.filter(user=user, pharmacy_id=pharm_id, role='PHARMACY_ADMIN', is_active=True).exists()
        if not (is_org_admin or is_owner or is_pharm_admin):
            return Response({'detail': 'Not allowed to approve for this pharmacy.'}, status=403)
        if app.status != 'PENDING':
            return Response({'detail': f'Already {app.status.lower()}.'}, status=400)

        # Need an email to attach/create the platform user (step 7):
        email = (request.data.get('email') or app.email or '').strip().lower()
        if not email:
            return Response({'detail': 'email is required to approve (existing vs new user).'}, status=400)

        # Build payload for your existing helper:

        # Decide employment_type from category (+ optional override from request)
        allowed_ftpt = {'FULL_TIME', 'PART_TIME', 'CASUAL'}       # Pharmacy staff
        allowed_fav  = {'LOCUM', 'SHIFT_HERO'}                    # Favorite staff
        req_emp = (request.data.get('employment_type') or '').strip().upper()

        if app.category == 'FULL_PART_TIME':
            employment_type = req_emp if req_emp in allowed_ftpt else 'CASUAL'
        else:  # 'LOCUM_CASUAL'
            employment_type = req_emp if req_emp in allowed_fav else 'LOCUM'

        data = {
            'email': email,
            'pharmacy': app.pharmacy_id,
            'role': app.role,
            # set employment type based on link category
            'employment_type': employment_type,
            'invited_name': f'{app.first_name} {app.last_name}',
            # classification fields:
            'pharmacist_award_level': app.pharmacist_award_level,
            'otherstaff_classification_level': app.otherstaff_classification_level,
            'intern_half': app.intern_half,
            'student_year': app.student_year,
        }

        membership, error = MembershipViewSet()._create_membership_invite(data, inviter=request.user)
        if error:
            return Response({'detail': error}, status=400)

        app.status = 'APPROVED'
        app.decided_at = timezone.now()
        app.decided_by = request.user
        app.save(update_fields=['status', 'decided_at', 'decided_by'])
        transaction.on_commit(lambda: async_task('client_profile.tasks.email_membership_application_approved', app.id))

        return Response({'status': 'approved', 'membership_id': membership.id}, status=200)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        app = self.get_object()
        user = request.user
        pharm_id = app.pharmacy_id
        is_org_admin = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN', organization_id=app.pharmacy.organization_id).exists()
        is_owner = Pharmacy.objects.filter(id=pharm_id, owner__user=user).exists()
        is_pharm_admin = Membership.objects.filter(user=user, pharmacy_id=pharm_id, role='PHARMACY_ADMIN', is_active=True).exists()
        if not (is_org_admin or is_owner or is_pharm_admin):
            return Response({'detail': 'Not allowed to reject for this pharmacy.'}, status=403)
        if app.status != 'PENDING':
            return Response({'detail': f'Already {app.status.lower()}.'}, status=400)

        app.status = 'REJECTED'
        app.decided_at = timezone.now()
        app.decided_by = request.user
        app.save(update_fields=['status', 'decided_at', 'decided_by'])
        return Response({'status': 'rejected'}, status=200)

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

        if Membership.objects.filter(user=user, pharmacy=pharm).exists():
            return Response({"detail": "Already assigned."}, status=400)

        return Response(
            {"detail": "Use the Membership invite endpoint to add staff to a pharmacy (role and employment_type required)."},
            status=400
        )

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



# Shifts Mangment
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

        # 3) Pharmacy Admin for THIS pharmacy can post
        if Membership.objects.filter(
            user=user,
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists():
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
                'phone_number': candidate.mobile_number,
                'short_bio': po.short_bio,
                'resume': request.build_absolute_uri(po.resume.url) if po.resume else None,
                'rate_preference': po.rate_preference or None,
            }
        except PharmacistOnboarding.DoesNotExist:
            os = OtherStaffOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': candidate.mobile_number,
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
        Assigns a user to a shift.
        - If the user is Full/Part-Time, it rosters them onto the shift.
        - If the user is a Locum or other type, it accepts them and locks in the shift rate.
        """
        shift = self.get_object()
        user_id = request.data.get('user_id')
        if user_id is None:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        candidate = get_object_or_404(User, pk=user_id)
        slot_id = request.data.get('slot_id')

        membership = Membership.objects.filter(user=candidate, pharmacy=shift.pharmacy).first()
        is_internal_staff = membership and membership.employment_type in ['FULL_TIME', 'PART_TIME']

        # --- FIX: NEW LOGIC TO HANDLE BOTH EMPLOYEE TYPES ---

        if is_internal_staff:
            # --- This is for Full/Part-Time staff ---
            # We treat this as a direct "rostering" action.
            assignment_ids = []
            slots_to_assign = []
            
            if shift.single_user_only or slot_id is None:
                slots_to_assign = shift.slots.all()
            else:
                slots_to_assign = shift.slots.filter(pk=slot_id)

            for slot in slots_to_assign:
                for entry in expand_shift_slots(shift):
                    if entry['slot'].id == slot.id:
                        slot_date = entry['date']
                        assn, _ = ShiftSlotAssignment.objects.update_or_create(
                            slot=slot,
                            slot_date=slot_date,
                            defaults={
                                "shift": shift,
                                "user": candidate,
                                "unit_rate": Decimal('0.00'),
                                "rate_reason": {"source": "Rostered via shift interest"},
                                "is_rostered": True # Mark as a rostered shift
                            }
                        )
                        assignment_ids.append(assn.id)
            
            # (Optional) You can customize the email for rostered staff here if needed
            ctx = build_shift_email_context(shift, user=candidate, role=candidate.role.lower())
            async_task(
                'users.tasks.send_async_email',
                subject=f"You’ve been rostered for a shift at {shift.pharmacy.name}",
                recipient_list=[candidate.email],
                template_name="emails/shift_accept.html", # Can reuse or create a new template
                context=ctx,
                text_template="emails/shift_accept.txt"
            )

            return Response({
                'status': f'{candidate.get_full_name()} has been rostered for the shift.',
                'assignment_ids': assignment_ids
            }, status=status.HTTP_200_OK)

        else:
            # --- This is the ORIGINAL logic for Locums/other staff ---
            # It locks in the rate and assigns them as a temporary worker.
            assignment_ids = []

            # CASE 1: SINGLE-USER-ONLY SHIFT
            if shift.single_user_only:
                for entry in expand_shift_slots(shift):
                    slot = entry['slot']
                    slot_date = entry['date']
                    rate, reason = get_locked_rate_for_slot(shift=shift, slot=slot, user=candidate, override_date=slot_date)
                    a, _ = ShiftSlotAssignment.objects.update_or_create(
                        slot=slot, slot_date=slot_date,
                        defaults={'shift': shift, 'user': candidate, 'unit_rate': rate, 'rate_reason': reason}
                    )
                    assignment_ids.append(a.id)
            
            # CASE 2: MULTI-SLOT (ALL UNASSIGNED)
            elif slot_id is None:
                for entry in expand_shift_slots(shift):
                    if not ShiftSlotAssignment.objects.filter(slot=entry['slot'], slot_date=entry['date']).exists():
                        rate, reason = get_locked_rate_for_slot(shift=shift, slot=entry['slot'], user=candidate, override_date=entry['date'])
                        a, _ = ShiftSlotAssignment.objects.update_or_create(
                            slot=entry['slot'], slot_date=entry['date'],
                            defaults={'shift': shift, 'user': candidate, 'unit_rate': rate, 'rate_reason': reason}
                        )
                        assignment_ids.append(a.id)

            # CASE 3: SPECIFIC SLOT IN MULTI-SLOT SHIFT
            else:
                slot = get_object_or_404(shift.slots, pk=slot_id)
                for entry in expand_shift_slots(shift):
                    if entry['slot'].id == slot.id:
                        slot_date = entry['date']
                        rate, reason = get_locked_rate_for_slot(shift=shift, slot=slot, user=candidate, override_date=slot_date)
                        a, _ = ShiftSlotAssignment.objects.update_or_create(
                            slot=slot, slot_date=slot_date,
                            defaults={'shift': shift, 'user': candidate, 'unit_rate': rate, 'rate_reason': reason}
                        )
                        assignment_ids.append(a.id)

            ctx = build_shift_email_context(shift, user=candidate, role=candidate.role.lower())
            async_task(
                'users.tasks.send_async_email',
                subject=f"You’ve been accepted for a shift at {shift.pharmacy.name}",
                recipient_list=[candidate.email],
                template_name="emails/shift_accept.html",
                context=ctx,
                text_template="emails/shift_accept.txt"
            )
            
            return Response({
                'status': f'{candidate.get_full_name()} assigned to the shift.',
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

        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )

        qs = qs.filter(
            Q(created_by=user) | claimed_q | Q(pharmacy__in=admin_pharmacies)
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
                employment_type__in=['FULL_TIME', 'PART_TIME', 'CASUAL'],
            )
        elif requested_visibility == 'LOCUM_CASUAL':
            memberships_qs = memberships_qs.filter(
                pharmacy=shift.pharmacy,
                employment_type__in=['LOCUM', 'SHIFT_HERO'],

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
            member_interaction_status = 'no_response'

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
                member_interaction_status = 'accepted'
            elif user.id in interested_user_ids:
                # ✅ CHANGE THIS:
                member_interaction_status = 'interested'
            elif user.id in rejected_user_ids:
                # ✅ CHANGE THIS:
                member_interaction_status = 'rejected'

            data.append({
                'user_id': user.id,
                'name': display_name,
                'employment_type': membership.employment_type,
                'role': membership.role,
                'status': member_interaction_status,
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

        # Only allow owner, org-admin, or this pharmacy’s Admin to escalate
        pharmacy = shift.pharmacy
        is_owner = (pharmacy.owner and pharmacy.owner.user == user)
        is_org_admin = OrganizationMembership.objects.filter(
            user=user,
            role='ORG_ADMIN',
            organization_id=pharmacy.organization_id
        ).exists()
        is_pharm_admin = Membership.objects.filter(
            user=user,
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists()

        if not (is_owner or is_org_admin or is_pharm_admin):
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
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )
        qs = qs.filter(Q(created_by=user) | claimed_q | Q(pharmacy__in=admin_pharmacies))

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
                'phone_number': candidate.mobile_number, 
                'short_bio': po.short_bio,
                'resume': request.build_absolute_uri(po.resume.url) if po.resume else None,
                'rate_preference': po.rate_preference or None,
            }
        except PharmacistOnboarding.DoesNotExist:
            try:
                os = OtherStaffOnboarding.objects.get(user=candidate)
                profile_data = {
                    'phone_number': candidate.mobile_number,
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

        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )
        qs = qs.filter(
            Q(created_by=user) | claimed_q | Q(pharmacy__in=admin_pharmacies)
        )

        # fully assigned
        qs = qs.annotate(
            slot_count=Count('slots', distinct=True),
            assigned_count=Count('slots__assignments', distinct=True)
        ).filter(assigned_count__gte=F('slot_count'))

        # slots ended
        # past_oneoff = (
        #     Q(slots__date__lt=today) |
        #     Q(slots__date=today, slots__end_time__lt=now.time())
        # )
        # past_recurring = Q(
        #     slots__is_recurring=True,
        #     slots__recurring_end_date__lt=today
        # )
        # qs = qs.filter(past_oneoff | past_recurring)

        return qs.distinct()


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

        # Retrieve profile data without sending an email or consuming reveal quota
        profile_data = {}
        try:
            po = PharmacistOnboarding.objects.get(user=candidate)
            profile_data = {
                'phone_number': candidate.mobile_number,
                'short_bio': po.short_bio,
                'resume': request.build_absolute_uri(po.resume.url) if po.resume else None,
                'rate_preference': po.rate_preference or None,
            }
        except PharmacistOnboarding.DoesNotExist:
            try:
                os = OtherStaffOnboarding.objects.get(user=candidate)
                profile_data = {
                    'phone_number': candidate.mobile_number,
                    'short_bio': os.short_bio,
                    'resume': request.build_absolute_uri(os.resume.url) if os.resume else None,
                }
            except OtherStaffOnboarding.DoesNotExist:
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

        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )  # + pharmacies where I'm Pharmacy Admin

        controlled_pharmacies = (owned_pharmacies | org_pharmacies | admin_pharmacies).distinct()
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
        if Membership.objects.filter(user=user, role='PHARMACY_ADMIN', is_active=True).exists():
            admin_pharms = Pharmacy.objects.filter(
                memberships__user=user,
                memberships__role='PHARMACY_ADMIN',
                memberships__is_active=True
            )
            controlled_pharmacies_query |= admin_pharms

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
        admin_pharmacies = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )
        controlled_pharmacies |= admin_pharmacies
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
        user = request.user
        pharm = shift.pharmacy
        allowed = (
            (pharm.owner and pharm.owner.user == user)
            or OrganizationMembership.objects.filter(
                user=user, role='ORG_ADMIN', organization_id=pharm.organization_id
            ).exists()
            or Membership.objects.filter(
                user=user, pharmacy=pharm, role='PHARMACY_ADMIN', is_active=True
            ).exists()
        )
        if not allowed:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

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
        elif Membership.objects.filter(
            user=requesting_user,
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists():  # + allow Pharmacy Admin of this pharmacy
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
        user = request.user
        memberships = (
            Membership.objects
            .filter(user=user, is_active=True)
            .select_related('pharmacy')
        )

        data = []
        for m in memberships:
            p = m.pharmacy

            # Safely use legacy 'address' if it exists; otherwise compose from new parts.
            address = (
                getattr(p, "address", None)  # legacy compatibility (if still present anywhere)
                or ", ".join(filter(None, [
                    (p.street_address or "").strip(),
                    (p.suburb or "").strip(),
                    (p.state or "").strip(),
                    (p.postcode or "").strip(),
                ]))
            )

            data.append({
                "id": p.id,
                "name": p.name,
                "address": address,
                # keep returning the structured bits too (harmless + future-proof)
                "street_address": p.street_address,
                "suburb": p.suburb,
                "state": p.state,
                "postcode": p.postcode,
                "latitude": p.latitude,
                "longitude": p.longitude,
            })

        return Response(data)

class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # ORG_ADMIN → all pharmacies in their org(s)
        org_ids = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN'
        ).values_list('organization_id', flat=True)
        if org_ids:
            return qs.filter(
                slot_assignment__shift__pharmacy__organization_id__in=org_ids
            ).distinct()

        # OWNER → only their pharmacies
        if hasattr(user, 'owneronboarding'):
            return qs.filter(
                slot_assignment__shift__pharmacy__owner=user.owneronboarding
            ).distinct()

        # PHARMACY_ADMIN → only pharmacies they admin
        admin_pharmacy_ids = Membership.objects.filter(
            user=user, role='PHARMACY_ADMIN', is_active=True
        ).values_list('pharmacy_id', flat=True)
        if admin_pharmacy_ids:
            return qs.filter(
                slot_assignment__shift__pharmacy_id__in=admin_pharmacy_ids
            ).distinct()

        # Worker → only their own leaves
        return qs.filter(user=user)

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


        # + Pharmacy Admins for this pharmacy
        pharmacy_admins = Membership.objects.filter(
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).select_related('user')

        for admin_mem in pharmacy_admins:
            if admin_mem.user and admin_mem.user.email and admin_mem.user.email not in notification_emails:
                notification_emails.append(admin_mem.user.email)

        for admin in org_admins:
            if admin.user and admin.user.email and admin.user.email not in notification_emails:
                notification_emails.append(admin.user.email)
        if owner_user and owner_user.email and owner_user.email not in notification_emails:
            notification_emails.append(owner_user.email)

        # Who should the roster link be for? (Prefer first org_admin, fallback to owner)
        if pharmacy_admins:
            roster_link_user = pharmacy_admins[0].user
        elif org_admins:
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

        is_pharmacy_admin = Membership.objects.filter(
            user=user,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists()

        return is_owner or is_claimed_admin or is_pharmacy_admin


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
        is_pharm_admin = Membership.objects.filter(
            user=user,
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists()

        if not (is_owner or is_claimed_admin or is_pharm_admin):
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


class WorkerShiftRequestViewSet(viewsets.ModelViewSet):
    """
    Shift Cover Requests:
    - Workers submit a cover request for an assigned or empty time slot.
    - Owners / Org Admins / Pharmacy Admins receive the request email.
    - Approve/Reject sends a role-aware link to the worker (their dashboard).
    """
    queryset = WorkerShiftRequest.objects.all().select_related("pharmacy", "requested_by")
    serializer_class = WorkerShiftRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ---------------------------
    # VISIBILITY / LISTING
    # ---------------------------
    def get_queryset(self):
        user = self.request.user

        # Workers: only their own requests
        if getattr(user, "role", None) in ["PHARMACIST", "OTHER_STAFF", "EXPLORER"]:
            return self.queryset.filter(requested_by=user)

        # Owners / Org Admins / Pharmacy Admins: all requests for pharmacies they control
        # (mirror your other viewsets)
        controlled = Pharmacy.objects.none()

        # Owner’s own pharmacies
        if hasattr(user, "owneronboarding"):
            controlled |= Pharmacy.objects.filter(owner=user.owneronboarding)

        # Org-admin pharmacies (direct or claimed)
        org_mem = OrganizationMembership.objects.filter(user=user, role='ORG_ADMIN').first()
        if org_mem:
            controlled |= Pharmacy.objects.filter(
                Q(organization=org_mem.organization) |
                Q(owner__organization=org_mem.organization)
            )

        # Pharmacy Admin pharmacies
        admin_pharms = Pharmacy.objects.filter(
            memberships__user=user,
            memberships__role='PHARMACY_ADMIN',
            memberships__is_active=True
        )
        controlled |= admin_pharms

        return self.queryset.filter(pharmacy__in=controlled).distinct()

    # ---------------------------
    # CREATE (Worker submits)
    # ---------------------------
    def perform_create(self, serializer):
        """
        Send emails exactly like your LeaveRequest pattern, but:
        - personalize each email with the recipient's name (owner_name)
        - build the shift_link using that recipient (role-aware)
        """
        req = serializer.save(requested_by=self.request.user)
        pharmacy = req.pharmacy

        # Collect recipients (same schema you use elsewhere)
        recipients = []

        # Pharmacy Admins of this pharmacy
        pharmacy_admins = Membership.objects.filter(
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).select_related('user')

        # Org Admins if the owner is org-claimed
        org_admins = []
        if hasattr(pharmacy, "owner") and getattr(pharmacy.owner, "organization_claimed", False):
            org_admins = OrganizationMembership.objects.filter(
                role='ORG_ADMIN',
                organization_id=pharmacy.organization_id
            ).select_related('user')

        # Owner user
        owner_user = getattr(pharmacy.owner, "user", None) if hasattr(pharmacy, "owner") and pharmacy.owner else None

        # Build unique recipient user list
        for admin_mem in pharmacy_admins:
            if admin_mem.user and admin_mem.user.email:
                recipients.append(admin_mem.user)

        for admin in org_admins:
            if admin.user and admin.user.email:
                recipients.append(admin.user)

        if owner_user and owner_user.email:
            recipients.append(owner_user)

        # Deduplicate by email
        seen = set()
        unique_recipients = []
        for u in recipients:
            if u.email not in seen:
                seen.add(u.email)
                unique_recipients.append(u)

        # Send ONE email per recipient so the greeting and link are correct
        worker_name = req.requested_by.get_full_name() or req.requested_by.email
        for recipient in unique_recipients:
            ctx = {
                # template expects 'owner_name' in the greeting; we pass the actual recipient's name
                "owner_name": recipient.get_full_name() or recipient.email,
                # request details
                "requested_by": worker_name,                 # templates use this
                "worker_name": worker_name,                  # keep both keys for safety
                "worker_email": req.requested_by.email,
                "note": req.note or "",
                "shift_date": req.slot_date,
                "pharmacy_name": pharmacy.name,
                "shift_link": build_roster_email_link(recipient, pharmacy),
            }

            async_task(
                'users.tasks.send_async_email',
                subject=f"Shift cover request from {worker_name} for {pharmacy.name}",
                recipient_list=[recipient.email],
                template_name="emails/swap_requested.html",
                context=ctx,
                text_template="emails/swap_requested.txt",
            )

    # ---------------------------
    # APPROVE (Admin action)
    # ---------------------------
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        req = self.get_object()

        # Permission: same people who got the request may decide
        self._assert_decider_permissions(req)

        if req.status != "PENDING":
            return Response({"detail": f"Already {req.status.lower()}."}, status=status.HTTP_400_BAD_REQUEST)

        # Business state only; do NOT create invalid ShiftSlotAssignment here.
        # The owner/admin will roster or escalate as per your existing flows.
        req.status = "APPROVED"
        req.resolved_at = timezone.now()
        req.resolved_by = request.user
        req.save(update_fields=["status", "resolved_at", "resolved_by"])

        # Email the worker with their own, role-correct dashboard/roster link
        ctx = {
            "worker_name": req.requested_by.get_full_name() or req.requested_by.email,
            "pharmacy_name": req.pharmacy.name,
            "shift_date": req.slot_date,
            "shift_link": build_roster_email_link(req.requested_by, req.pharmacy),
        }
        if req.requested_by.email:
            async_task(
                'users.tasks.send_async_email',
                subject=f"Your shift cover request for {ctx['pharmacy_name']} was approved",
                recipient_list=[req.requested_by.email],
                template_name="emails/swap_approved.html",
                context=ctx,
                text_template="emails/swap_approved.txt",
            )
        return Response({'status': 'approved'})

    # ---------------------------
    # REJECT (Admin action)
    # ---------------------------
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        req = self.get_object()

        # Permission: same people who got the request may decide
        self._assert_decider_permissions(req)

        if req.status != "PENDING":
            return Response({"detail": f"Already {req.status.lower()}."}, status=status.HTTP_400_BAD_REQUEST)

        req.status = "REJECTED"
        req.resolved_at = timezone.now()
        req.resolved_by = request.user
        req.save(update_fields=["status", "resolved_at", "resolved_by"])

        # Email the worker with their own, role-correct link
        ctx = {
            "worker_name": req.requested_by.get_full_name() or req.requested_by.email,
            "pharmacy_name": req.pharmacy.name,
            "shift_date": req.slot_date,
            "shift_link": build_roster_email_link(req.requested_by, req.pharmacy),
        }
        if req.requested_by.email:
            async_task(
                'users.tasks.send_async_email',
                subject=f"Your shift cover request for {ctx['pharmacy_name']} was rejected",
                recipient_list=[req.requested_by.email],
                template_name="emails/swap_rejected.html",
                context=ctx,
                text_template="emails/swap_rejected.txt",
            )
        return Response({'status': 'rejected'})

    # ---------------------------
    # PERMISSIONS (shared)
    # ---------------------------
    def _assert_decider_permissions(self, req):
        """
        Only: Owner of pharmacy, Org Admin of that org, or Pharmacy Admin of this pharmacy.
        Matches your leave request approval permissions.
        """
        user = self.request.user
        pharmacy = req.pharmacy

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

        is_pharm_admin = Membership.objects.filter(
            user=user,
            pharmacy=pharmacy,
            role='PHARMACY_ADMIN',
            is_active=True
        ).exists()

        if not (is_owner or is_claimed_admin or is_pharm_admin):
            raise PermissionDenied("Not authorized to approve/reject this shift cover request.")

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

# -----------------------------------------------------------------------------
# Rating 
# -----------------------------------------------------------------------------
class RatingViewSet(viewsets.GenericViewSet):
    """
    Relationship-level ratings (NOT per shift/slot):
      - OWNER_TO_WORKER: owner/org-admin/pharmacy-admin → worker (pharmacist/other staff)
      - WORKER_TO_PHARMACY: worker → pharmacy
    Each relationship can have exactly ONE editable rating.
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = Rating.objects.all()

    def get_serializer_class(self):
        return RatingReadSerializer if self.action in ["list", "retrieve"] else RatingWriteSerializer

    # ---------- helpers ----------
    def _user_controls_pharmacy(self, user, pharmacy: Pharmacy) -> bool:
        """Check if a user owns/controls a given pharmacy."""
        # 1) Direct owner
        if getattr(pharmacy, "owner", None) and pharmacy.owner.user_id == user.id:
            return True
        # 2) Org-admin of pharmacy's organization
        if OrganizationMembership.objects.filter(
            user=user, role="ORG_ADMIN", organization_id=pharmacy.organization_id
        ).exists():
            return True
        # 3) Pharmacy admin of THIS pharmacy
        if Membership.objects.filter(
            user=user, pharmacy=pharmacy, role="PHARMACY_ADMIN", is_active=True
        ).exists():
            return True
        return False

    def _has_completed_relationship_owner_to_worker(self, rater, worker_user) -> bool:
        """
        True if the rater controls at least one pharmacy (as Owner, Org Admin, or Pharmacy Admin)
        where the given worker has at least one assignment (any time). No date filtering here.
        """
        # Pharmacies directly owned by rater
        owned_pharmacies = Pharmacy.objects.filter(owner__user=rater).values_list("id", flat=True)

        # Pharmacies where rater is PHARMACY_ADMIN
        pharmacy_admin_ids = Membership.objects.filter(
            user=rater, role="PHARMACY_ADMIN", is_active=True
        ).values_list("pharmacy_id", flat=True)

        # Pharmacies under organizations where rater is ORG_ADMIN
        org_ids = OrganizationMembership.objects.filter(
            user=rater, role="ORG_ADMIN"
        ).values_list("organization_id", flat=True)
        org_pharmacy_ids = Pharmacy.objects.filter(
            organization_id__in=list(org_ids)
        ).values_list("id", flat=True)

        controlled_pharmacy_ids = set(owned_pharmacies) | set(pharmacy_admin_ids) | set(org_pharmacy_ids)
        if not controlled_pharmacy_ids:
            return False

        return ShiftSlotAssignment.objects.filter(
            user=worker_user,
            shift__pharmacy_id__in=list(controlled_pharmacy_ids),
        ).exists()

    def _has_completed_relationship_worker_to_pharmacy(self, worker, pharmacy: Pharmacy) -> bool:
        """
        True if the worker has at least one assignment at the pharmacy (any time). No date filtering here.
        """
        return ShiftSlotAssignment.objects.filter(
            user=worker,
            shift__pharmacy=pharmacy,
        ).exists()


    # ---------- create (upsert) ----------
    def create(self, request, *args, **kwargs):
        """
        Create or update a rating:
        - OWNER_TO_WORKER: Owner → Worker
        - WORKER_TO_PHARMACY: Worker → Pharmacy
        """
        ser = RatingWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user

        direction = data["direction"]
        stars = data["stars"]
        comment = data.get("comment", "")

        if direction == Rating.Direction.OWNER_TO_WORKER:
            worker = data["ratee_user"]
            # eligibility: rater controls at least one pharmacy where this worker completed >=1 assignment
            if not self._has_completed_relationship_owner_to_worker(user, worker):
                return Response(
                    {"detail": "You can only rate workers who completed an assignment at your pharmacy."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            obj, created = Rating.objects.get_or_create(
                rater_user=user,
                ratee_user=worker,
                direction=direction,
                defaults={"stars": stars, "comment": comment},
            )
            if not created:
                obj.stars = stars
                obj.comment = comment
                obj.save(update_fields=["stars", "comment", "updated_at"])
            return Response(RatingReadSerializer(obj).data, status=201 if created else 200)

        elif direction == Rating.Direction.WORKER_TO_PHARMACY:
            pharm = data["ratee_pharmacy"]
            # eligibility: worker completed >=1 assignment at this pharmacy
            if not self._has_completed_relationship_worker_to_pharmacy(user, pharm):
                return Response(
                    {"detail": "You can only rate pharmacies where you completed an assignment."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            obj, created = Rating.objects.get_or_create(
                rater_user=user,
                ratee_pharmacy=pharm,
                direction=direction,
                defaults={"stars": stars, "comment": comment},
            )
            if not created:
                obj.stars = stars
                obj.comment = comment
                obj.save(update_fields=["stars", "comment", "updated_at"])
            return Response(RatingReadSerializer(obj).data, status=201 if created else 200)

        return Response({"detail": "Invalid direction."}, status=400)

    # ---------- list ----------
    def list(self, request, *args, **kwargs):
        """
        Filter:
          - ?target_type=worker&target_id=<user_id>
          - ?target_type=pharmacy&target_id=<pharmacy_id>
        """
        ttype = request.query_params.get("target_type")
        tid = request.query_params.get("target_id")

        qs = Rating.objects.all()
        if ttype == "worker" and tid:
            qs = qs.filter(direction=Rating.Direction.OWNER_TO_WORKER, ratee_user_id=tid)
        elif ttype == "pharmacy" and tid:
            qs = qs.filter(direction=Rating.Direction.WORKER_TO_PHARMACY, ratee_pharmacy_id=tid)
        else:
            return Response({"detail": "Provide target_type=worker|pharmacy and target_id."}, status=400)

        page = self.paginate_queryset(qs.order_by("-updated_at"))
        if page is not None:
            return self.get_paginated_response(RatingReadSerializer(page, many=True).data)
        return Response(RatingReadSerializer(qs, many=True).data)

    # ---------- summary ----------
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """
        Returns aggregate rating for a target:
          - ?target_type=worker&target_id=<user_id>
          - ?target_type=pharmacy&target_id=<pharmacy_id>
        """
        ttype = request.query_params.get("target_type")
        tid = request.query_params.get("target_id")
        if not ttype or not tid:
            return Response({"detail": "Provide target_type and target_id."}, status=400)

        if ttype == "worker":
            qs = Rating.objects.filter(direction=Rating.Direction.OWNER_TO_WORKER, ratee_user_id=tid)
        elif ttype == "pharmacy":
            qs = Rating.objects.filter(direction=Rating.Direction.WORKER_TO_PHARMACY, ratee_pharmacy_id=tid)
        else:
            return Response({"detail": "Invalid target_type."}, status=400)

        agg = qs.aggregate(average=Avg("stars"), count=Count("id"))
        data = {
            "average": float(agg["average"] or 0.0),
            "count": int(agg["count"] or 0),
        }
        return Response(RatingSummarySerializer(data).data)

    # ---------- my rating ----------
    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        """
        Returns the current user's rating (if any) on the given target:
          - ?target_type=worker&target_id=<user_id>
          - ?target_type=pharmacy&target_id=<pharmacy_id>
        """
        user = request.user
        ttype = request.query_params.get("target_type")
        tid = request.query_params.get("target_id")
        if not ttype or not tid:
            return Response({"detail": "Provide target_type and target_id."}, status=400)

        if ttype == "worker":
            obj = Rating.objects.filter(
                direction=Rating.Direction.OWNER_TO_WORKER,
                rater_user=user,
                ratee_user_id=tid,
            ).first()
            direction = Rating.Direction.OWNER_TO_WORKER
        elif ttype == "pharmacy":
            obj = Rating.objects.filter(
                direction=Rating.Direction.WORKER_TO_PHARMACY,
                rater_user=user,
                ratee_pharmacy_id=tid,
            ).first()
            direction = Rating.Direction.WORKER_TO_PHARMACY
        else:
            return Response({"detail": "Invalid target_type."}, status=400)

        payload = {
            "id": obj.id if obj else None,
            "direction": direction,
            "stars": obj.stars if obj else None,
            "comment": obj.comment if obj else "",
        }
        return Response(MyRatingSerializer(payload).data)

    # ---------- pending ----------
    @action(detail=False, methods=["get"], url_path="pending")
    def pending(self, request):
        """
        Lists relationships where the current user is eligible to rate but hasn't yet.
        - workers_to_rate: as an owner/org-admin/pharmacy-admin
        - pharmacies_to_rate: as a worker
        """
        user = request.user
        today = timezone.localdate()

        # Pharmacies the user controls
        pharm_control = Pharmacy.objects.filter(
            Q(owner__user=user)
            | Q(organization__organization_memberships__user=user, organization__organization_memberships__role="ORG_ADMIN")
            | Q(memberships__user=user, memberships__role="PHARMACY_ADMIN", memberships__is_active=True)
        ).distinct()

        # Workers eligible to rate
        worker_ids = ShiftSlotAssignment.objects.filter(
            shift__pharmacy__in=pharm_control,
            slot_date__lt=today,
        ).values_list("user_id", flat=True).distinct()

        already_rated_worker_ids = Rating.objects.filter(
            direction=Rating.Direction.OWNER_TO_WORKER,
            rater_user=user,
        ).values_list("ratee_user_id", flat=True)
        workers_to_rate_ids = set(worker_ids) - set(already_rated_worker_ids)

        # Pharmacies eligible to rate by this worker
        pharm_ids = ShiftSlotAssignment.objects.filter(
            user=user,
            slot_date__lt=today,
        ).values_list("shift__pharmacy_id", flat=True).distinct()

        already_rated_pharm_ids = Rating.objects.filter(
            direction=Rating.Direction.WORKER_TO_PHARMACY,
            rater_user=user,
        ).values_list("ratee_pharmacy_id", flat=True)
        pharmacies_to_rate_ids = set(pharm_ids) - set(already_rated_pharm_ids)

        return Response(PendingRatingsSerializer({
            "workers_to_rate": list(workers_to_rate_ids),
            "pharmacies_to_rate": list(pharmacies_to_rate_ids),
        }).data)

# -----------------------------------------------------------------------------
# Explorer 
# -----------------------------------------------------------------------------
class IsPostOwner(permissions.BasePermission):
    """
    Object-level check: user must own the post's explorer_profile.
    """

    def has_object_permission(self, request, view, obj):
        return (
            request.user.is_authenticated
            and getattr(obj.explorer_profile, "user_id", None) == request.user.id
        )


class ExplorerPostViewSet(viewsets.ModelViewSet):
    """
    Authenticated users can view.
    Only Explorers (who own the profile) can create/update/delete/react/attach.
    """
    queryset = (
        ExplorerPost.objects
        .select_related("explorer_profile__user")
        .prefetch_related("attachments")
        .order_by("-created_at")
    )
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    # --------- serializers ---------
    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ExplorerPostWriteSerializer
        return ExplorerPostReadSerializer

    # --------- permissions ---------
    def get_permissions(self):
        # Read-only endpoints → any authenticated user
        read_actions = ["list", "retrieve", "feed", "by_profile", "add_view"]

        # Owner-required writes → must be Explorer (ownership checked later)
        owner_write_actions = ["create", "update", "partial_update", "destroy", "attachments"]

        # Reactions → any authenticated user (no Explorer requirement)
        react_actions = ["like", "unlike"]

        if self.action in read_actions:
            return [permissions.IsAuthenticated()]
        if self.action in owner_write_actions:
            return [permissions.IsAuthenticated(), IsExplorer()]
        if self.action in react_actions:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]


    def perform_create(self, serializer):
        """
        Enforce that the creating user owns the explorer_profile.
        """
        explorer_profile = serializer.validated_data.get("explorer_profile")
        if not explorer_profile or explorer_profile.user_id != self.request.user.id:
            # Hard fail if mismatch
            raise permissions.PermissionDenied("You can only post from your own explorer profile.")
        serializer.save()

    def perform_update(self, serializer):
        # Only owner can update (object-level)
        instance = self.get_object()
        self.check_object_permissions_for_write(instance)
        serializer.save()

    def perform_destroy(self, instance):
        # Only owner can delete (object-level)
        self.check_object_permissions_for_write(instance)
        instance.delete()

    def check_object_permissions_for_write(self, obj):
        if not IsPostOwner().has_object_permission(self.request, self, obj):
            raise permissions.PermissionDenied("Only the owner can modify this post.")

    # --------- Feeds ---------
    @action(detail=False, methods=["get"], url_path="feed")
    def feed(self, request):
        """
        Newest-first feed. (Extend with follow-graph later if needed.)
        """
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        ser = ExplorerPostReadSerializer(page or qs, many=True, context={"request": request})
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=False, methods=["get"], url_path=r"by-profile/(?P<profile_id>[^/.]+)")
    def by_profile(self, request, profile_id=None):
        qs = self.get_queryset().filter(explorer_profile_id=profile_id)
        page = self.paginate_queryset(qs)
        ser = ExplorerPostReadSerializer(page or qs, many=True, context={"request": request})
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    # --------- Lightweight counters ---------
    @action(detail=True, methods=["post"], url_path="view")
    def add_view(self, request, pk=None):
        """
        Increment view count; any authenticated user can call.
        """
        post = self.get_object()
        ExplorerPost.objects.filter(pk=post.pk).update(view_count=models.F("view_count") + 1)
        post.refresh_from_db(fields=["view_count"])
        return Response({"view_count": post.view_count})

    # --------- Attachments (owner only) ---------
    @action(detail=True, methods=["post"], url_path="attachments")
    def attachments(self, request, pk=None):
        """
        Multipart form-data for one or many files:
        - file: <binary>  (use `file` multiple times to send many)
        - kind: IMAGE | VIDEO | FILE (optional; default FILE)
        - caption: optional
        """
        post = self.get_object()
        self.check_object_permissions_for_write(post)

        files = request.FILES.getlist("file") or ([request.FILES["file"]] if "file" in request.FILES else [])
        kind = request.data.get("kind", "FILE")
        caption = request.data.get("caption", "")

        created = []
        with transaction.atomic():
            if files:
                for f in files:
                    created.append(
                        ExplorerPostAttachment.objects.create(
                            post=post, file=f, kind=kind, caption=caption
                        )
                    )
            else:
                # JSON payload fallback (rare)
                ser = ExplorerPostAttachmentSerializer(data=request.data)
                ser.is_valid(raise_exception=True)
                ser.save(post=post)
                created.append(ser.instance)

        return Response(ExplorerPostAttachmentSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    # --------- Reactions (like/unlike) (owner NOT required, but must be Explorer) ---------
    @action(detail=True, methods=["post"], url_path="like")
    def like(self, request, pk=None):
        """
        Like a post; available to any authenticated Explorer.
        """
        post = self.get_object()
        created = False
        with transaction.atomic():
            obj, created = ExplorerPostReaction.objects.get_or_create(post=post, user=request.user)
            if created:
                ExplorerPost.objects.filter(pk=post.pk).update(like_count=models.F("like_count") + 1)
        post.refresh_from_db(fields=["like_count"])
        return Response({"liked": True, "like_count": post.like_count, "created": created})

    @action(detail=True, methods=["post"], url_path="unlike")
    def unlike(self, request, pk=None):
        """
        Unlike a post; available to any authenticated Explorer.
        """
        post = self.get_object()
        with transaction.atomic():
            deleted, _ = ExplorerPostReaction.objects.filter(post=post, user=request.user).delete()
            if deleted:
                ExplorerPost.objects.filter(pk=post.pk).update(like_count=models.F("like_count") - 1)
        post.refresh_from_db(fields=["like_count"])
        return Response({"liked": False, "like_count": post.like_count, "deleted": bool(deleted)})

# Availability
class UserAvailabilityViewSet(viewsets.ModelViewSet):
    """API for users to manage their own availability slots."""
    serializer_class = UserAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserAvailability.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# Invoices
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def preview_invoice_lines(request, shift_id):
    try:
        shift = Shift.objects.get(id=shift_id)
    except Shift.DoesNotExist:
        return Response({"error": "Shift not found"}, status=404)

    line_items = generate_preview_invoice_lines(shift, request.user)
    return Response(line_items)


from django.http import HttpResponse, Http404
def invoice_pdf_view(request, invoice_id):
    invoice = Invoice.objects.get(pk=invoice_id)
    pdf_bytes = render_invoice_to_pdf(invoice)
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response['Content-Disposition'] = f'inline; filename="invoice_{invoice.id}.pdf"'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_invoice_email(request, invoice_id):
    # Ensure invoice belongs to the current user
    try:
        invoice = Invoice.objects.get(pk=invoice_id, user=request.user)
    except Invoice.DoesNotExist:
        raise Http404("Invoice not found")

    # Basic recipient validation
    to_email = (invoice.bill_to_email or "").strip()
    if not to_email:
        return Response({"detail": "Missing bill_to_email on invoice."}, status=400)

    # CC parsing from stored `cc_emails`
    cc_list = []
    if invoice.cc_emails:
        cc_list = [e.strip() for e in invoice.cc_emails.split(",") if e.strip()]

    # Render PDF into memory
    pdf_bytes = render_invoice_to_pdf(invoice)  # you already use this in invoice_pdf_view
    filename = f"invoice_{invoice.id}.pdf"
    full_bill_to_name = f"{(invoice.bill_to_first_name or '').strip()} {(invoice.bill_to_last_name or '').strip()}".strip()

    # Build email context (match your brand look & tone)
    context = {
        "invoice": invoice,
        "client_name": (
            (invoice.custom_bill_to_name or "").strip()
            or full_bill_to_name
            or (invoice.pharmacy_name_snapshot or "").strip()
        ),
        "issuer_name": f"{invoice.issuer_first_name} {invoice.issuer_last_name}".strip(),
        "subtotal": str(invoice.subtotal),
        "gst_amount": str(invoice.gst_amount),
        "super_amount": str(invoice.super_amount),
        "total": str(invoice.total),
        "invoice_date": str(invoice.invoice_date),
        "due_date": str(invoice.due_date or ""),
    }

    # Kick off async email with PDF attached (backward compatible task)
    async_task(
        'users.tasks.send_async_email',
        subject=f"Invoice #{invoice.id} from ChemistTasker",
        recipient_list=[to_email],
        template_name="emails/invoice_sent.html",
        context=context,
        text_template=None,               # optional plain text template; use html for now
        cc=cc_list,                       # NEW
        attachments=[(filename, pdf_bytes, "application/pdf")]  # NEW
    )

    # Mark as sent (see §3 below)
    invoice.status = 'sent'
    invoice.save(update_fields=['status'])

    return Response({"status": "sent"})



# -----------------------------------------------------------------------------
# Chat API
# -----------------------------------------------------------------------------
class ChatMessagePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100

class ConversationViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          mixins.CreateModelMixin,
                          mixins.UpdateModelMixin,
                          mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ChatMessagePagination 
    
    def get_queryset(self):
        user = self.request.user

        # Get all conversations where the current user is a participant
        user_conversations = Conversation.objects.filter(
            participants__membership__user=user
        )

        # From these, get all DMs and custom groups (not linked to a pharmacy)
        dms_and_custom_groups = user_conversations.filter(
            Q(type='DM') | Q(pharmacy__isnull=True)
        )

        # Hide only "me" ghost custom groups:
        #   - rooms with no other participants besides me, OR
        #   - legacy rooms literally titled "me"
        others_exist = Exists(
            Participant.objects.filter(
                conversation_id=OuterRef('pk')
            ).exclude(
                membership__user=user
            )
        )
        dms_and_custom_groups = dms_and_custom_groups.exclude(
            Q(type='GROUP') & Q(pharmacy__isnull=True) & (
                ~others_exist | Q(title__iexact='me')
            )
        )

        # --- Include community chats for pharmacies I belong to ---
        user_pharmacy_ids = Membership.objects.filter(
            user=user, is_active=True
        ).values_list('pharmacy_id', flat=True).distinct()

        community_chats = Conversation.objects.filter(
            type='GROUP',
            pharmacy_id__in=user_pharmacy_ids
        )

        # Combine everything:
        # - DMs and custom groups
        # - Community chats
        return (dms_and_custom_groups | community_chats).distinct().order_by('-updated_at')

    def get_serializer_class(self):
        # All "create DM" actions will serialize the final conversation object
        if self.action in ['create', 'update', 'partial_update', 'get_or_create_dm', 'get_or_create_dm_by_user', 'toggle_pin']:
            return ConversationCreateSerializer
        if self.action in ['retrieve']:
            return ConversationDetailSerializer
        return ConversationListSerializer

    # --- NEW: Centralized DM Creation Logic ---
    def _get_or_create_dm_conversation(self, user_a, user_b):
        """
        Universal helper to create a DM between any two users.
        Handles creating an implicit 'Contact' membership for users without one.
        Returns (conversation, created, error_response).
        """
        if user_a.id == user_b.id:
            return None, False, Response({"detail": "Cannot create a DM with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # The sender MUST have an active membership to initiate a chat.
        membership_a = Membership.objects.filter(user=user_a, is_active=True).first()
        if not membership_a:
            return None, False, Response({"detail": "You must have an active role to start a chat."}, status=status.HTTP_403_FORBIDDEN)

        # For the receiver, find an active membership OR create a contact one.
        membership_b = Membership.objects.filter(user=user_b, is_active=True).first()
        if not membership_b:
            # If no active membership, create an inactive "Contact" record.
            # This links them to the SENDER'S pharmacy for context.
            membership_b, created = Membership.objects.get_or_create(
                user=user_b,
                pharmacy=membership_a.pharmacy, # Use sender's pharmacy for context
                defaults={
                    'role': 'STUDENT', # Sensible default role
                    'employment_type': 'CONTACT',
                    'is_active': False, # This is NOT a real, active membership
                    'invited_by': user_a,
                }
            )
        # ---- LEGACY DM RESOLUTION (prevents duplicates) ----
        # There may be an older DM without a dm_key. Find any DM that has *both* users as participants.
        # If found, backfill dm_key and return it instead of creating a new conversation.
        legacy_dm = (
            Conversation.objects
            .filter(type=Conversation.Type.DM)
            .filter(participants__membership__user__in=[user_a, user_b])
            .annotate(
                user_count=Count('participants__membership__user', distinct=True)
            )
            .filter(user_count=2)
            .order_by('-updated_at')
            .first()
        )
        if legacy_dm:
            # Backfill dm_key if missing (or empty)
            if not getattr(legacy_dm, 'dm_key', None):
                legacy_dm.dm_key = make_dm_key(user_a.id, user_b.id)
                legacy_dm.save(update_fields=['dm_key'])
            return legacy_dm, False, None

        # The DM key is based on user IDs.
        dm_key = make_dm_key(user_a.id, user_b.id)

        with transaction.atomic():
            conversation, created = Conversation.objects.get_or_create(
                dm_key=dm_key,
                defaults={'type': Conversation.Type.DM, 'created_by': user_a}
            )
            if created:
                Participant.objects.bulk_create([
                    Participant(conversation=conversation, membership=membership_a),
                    Participant(conversation=conversation, membership=membership_b)
                ])
        
        return conversation, created, None

    # --- ACTION 1: Create DM by User ID (Primary Method) ---
    @action(detail=False, methods=['post'], url_path='get-or-create-dm-by-user')
    def get_or_create_dm_by_user(self, request):
        """
        Handles all new DM scenarios (Owner to Candidate, Anyone to Explorer).
        Takes a `partner_user_id`.
        """
        partner_user_id = request.data.get('partner_user_id')
        if not partner_user_id:
            return Response({"detail": "partner_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            partner_user = User.objects.get(pk=partner_user_id)
        except User.DoesNotExist:
            return Response({"detail": "Partner user not found."}, status=status.HTTP_404_NOT_FOUND)

        conversation, created, error = self._get_or_create_dm_conversation(request.user, partner_user)
        
        if error:
            return error

        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    # --- ACTION 2: Create DM by Membership ID (Legacy/Internal Method) ---
    @action(detail=False, methods=['post'], url_path='get-or-create-dm')
    def get_or_create_dm(self, request):
        """
        Handles creating a DM with a user via one of their memberships.
        Takes a `partner_membership_id`.
        """
        partner_membership_id = request.data.get('partner_membership_id')
        if not partner_membership_id:
            return Response({"detail": "partner_membership_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # We only need the membership to find the target user.
            partner_membership = Membership.objects.select_related('user').get(pk=partner_membership_id)
        except Membership.DoesNotExist:
            return Response({"detail": "Partner membership not found."}, status=status.HTTP_404_NOT_FOUND)

        conversation, created, error = self._get_or_create_dm_conversation(request.user, partner_membership.user)

        if error:
            return error
        
        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def perform_create(self, serializer):
        # This method is now only for creating GROUP chats.
        conv = serializer.save(created_by=self.request.user)
        creator_membership = Membership.objects.filter(user=self.request.user, is_active=True).first()
        if creator_membership:
            # Normalise to a set of membership IDs (handles both Membership instances or IDs)
            raw = serializer.validated_data.get('participants', []) or []
            part_ids = set(
                [m.id if hasattr(m, 'id') else int(m) for m in raw]
            )
            part_ids.add(creator_membership.id)

            # Skip any membership already linked (prevents UNIQUE violation)
            existing_ids = set(
                Participant.objects.filter(conversation=conv).values_list('membership_id', flat=True)
            )
            new_ids = list(part_ids - existing_ids)

            if new_ids:
                new_memberships = list(Membership.objects.filter(id__in=new_ids))
                Participant.objects.bulk_create(
                    [
                        Participant(
                            conversation=conv,
                            membership=m,
                            is_admin=(m.id == creator_membership.id)
                        )
                        for m in new_memberships
                    ],
                    ignore_conflicts=True
                )



    @action(detail=True, methods=['post'], url_path='toggle-pin')
    def toggle_pin(self, request, pk=None):
        """
        Handles pinning/unpinning EITHER a conversation or a message within it.
        Payload: { "target": "conversation" }
        Payload: { "target": "message", "message_id": 123 }
        """
        conv = self.get_object()
        my_part = get_object_or_404(Participant, conversation=conv, membership__user=request.user)
        
        target = request.data.get('target')
        
        if target == 'conversation':
            my_part.is_pinned = not my_part.is_pinned
            my_part.save(update_fields=['is_pinned'])
            # Return the updated room so frontend state is consistent
            return Response(ConversationListSerializer(conv, context={'request': request}).data)

        elif target == 'message':
            message_id = request.data.get('message_id')
            if not message_id:
                conv.pinned_message = None
            else:
                message_to_pin = get_object_or_404(Message, pk=message_id, conversation=conv)
                if conv.pinned_message_id == message_to_pin.id:
                    conv.pinned_message = None
                else:
                    conv.pinned_message = message_to_pin
            
            conv.save(update_fields=['pinned_message'])
            return Response(ConversationListSerializer(conv, context={'request': request}).data)

        return Response({'detail': 'Invalid target specified.'}, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        user = self.request.user
        my_participant = instance.participants.filter(membership__user=user).first()

        if not my_participant:
            # Allow the creator to delete even if their participant row is missing (legacy rooms)
            if instance.created_by_id == user.id and (instance.type == 'GROUP' and not instance.pharmacy):
                instance.delete()
                return
            raise PermissionDenied("You are not a member of this conversation.")

        # Case 1: Community Chat (linked to a pharmacy)
        if instance.type == 'GROUP' and instance.pharmacy:
            # Only pharmacy admins can delete the main community chat
            is_pharm_admin = my_participant.membership.role == 'PHARMACY_ADMIN'
            if not is_pharm_admin:
                raise PermissionDenied("Only pharmacy admins can delete this community chat.")
        
        # Case 2: Custom Group Chat (not linked to a pharmacy)
        elif instance.type == 'GROUP' and not instance.pharmacy:
            # The creator can always delete their custom group
            if instance.created_by_id == user.id:
                pass
            elif not my_participant.is_admin:
                # Allow deletion when this is a self-only group ("me")
                if instance.participants.count() == 1 and instance.participants.filter(membership__user=user).exists():
                    pass  # allow delete
                else:
                    raise PermissionDenied("Only group admins can delete this conversation.")
        
        # Case 3: Direct Messages (DMs) can always be deleted by participants
        if instance.type == 'DM':
            # Delete-for-me ONLY: remove my participant row so the DM disappears for me,
            # but remains for the other subject.
            instance.participants.filter(membership__user=user).delete()

            # Optional safety: if no participants remain (edge case), clean up the convo.
            if not instance.participants.exists():
                instance.delete()
            return

        # Default (after passing the GROUP checks above): hard delete conversation
        instance.delete()
            
    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        conv = self.get_object()
        my_part = Participant.objects.filter(conversation=conv, membership__user=request.user).first()
        if not my_part:
            return Response({"detail": "Not a participant of this conversation."}, status=status.HTTP_403_FORBIDDEN)
        
        if request.method.lower() == 'get':
            qs = conv.messages.select_related('sender__user').order_by('-created_at')
            page = self.paginate_queryset(qs)
            ser = MessageSerializer(page if page is not None else qs, many=True)
            return self.get_paginated_response(ser.data) if page else Response(ser.data)

        data = request.data or {}
        body = (data.get('body') or '').strip()
        attachments = request.FILES.getlist('attachment')
        if not body and not attachments:
            return Response({"detail": "Message body or attachment is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        created_messages = []
        sender_membership = my_part.membership
        if attachments:
            for attachment_file in attachments:
                msg = Message.objects.create(conversation=conv, sender=sender_membership, body=body if not created_messages else "", attachment=attachment_file, attachment_filename=attachment_file.name)
                created_messages.append(msg)
        elif body:
            msg = Message.objects.create(conversation=conv, sender=sender_membership, body=body)
            created_messages.append(msg)
        
        if created_messages:
            Conversation.objects.filter(pk=conv.pk).update(updated_at=created_messages[-1].created_at)
        
        http_payload = MessageSerializer(created_messages, many=True).data
        return Response(http_payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        conv = self.get_object()
        part = Participant.objects.filter(conversation=conv, membership__user=request.user).first()
        if not part:
            return Response({"detail": "Not a participant."}, status=status.HTTP_404_NOT_FOUND)
        part.last_read_at = timezone.now()
        part.save(update_fields=['last_read_at'])
        return Response({"detail": "Read position updated.", "last_read_at": part.last_read_at})

class MyMembershipsViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # This "healing" step for owners is crucial and remains.
        if hasattr(user, 'owneronboarding'):
            owned_pharmacies = Pharmacy.objects.filter(owner=user.owneronboarding)
            for pharmacy in owned_pharmacies:
                Membership.objects.get_or_create(
                    user=user,
                    pharmacy=pharmacy,
                    defaults={
                        'role': 'PHARMACY_ADMIN',
                        'employment_type': 'FULL_TIME',
                        'is_active': True,
                        'invited_by': user,
                    }
                )
        return Membership.objects.filter(user=user, is_active=True).select_related('pharmacy', 'user')

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Message.objects.filter(conversation__participants__membership__user=user)

    def update(self, request, *args, **kwargs):
        """
        Handles editing a message (PATCH request).
        """
        message = self.get_object()
        
        my_participant = message.conversation.participants.filter(membership__user=request.user).first()
        if not my_participant or message.sender != my_participant.membership:
            raise PermissionDenied("You can only edit your own messages.")

        new_body = request.data.get("body", "").strip()
        if not new_body:
            raise ValidationError({"body": "Message body cannot be empty."})

        if not message.is_edited:
            message.original_body = message.body
        
        message.body = new_body
        message.is_edited = True
        message.save()
        
        layer = get_channel_layer()
        # --- FIX: Changed "chat_" back to "room." to match your consumers.py ---
        group_name = f"room.{message.conversation_id}"
        async_to_sync(layer.group_send)(
            group_name,
            {
                "type": "message.updated",
                "message": self.get_serializer(message).data,
            },
        )
        
        return Response(self.get_serializer(message).data)

    def destroy(self, request, *args, **kwargs):
        """
        Handles "deleting" a message (DELETE request) by marking it as deleted.
        """
        message = self.get_object()
        
        my_participant = message.conversation.participants.filter(membership__user=request.user).first()
        if not my_participant or message.sender != my_participant.membership:
            raise PermissionDenied("You can only delete your own messages.")

        message.is_deleted = True
        message.body = ""
        message.attachment = None
        message.attachment_filename = None
        message.save()
        
        layer = get_channel_layer()
        # --- FIX: Changed "chat_" back to "room." to match your consumers.py ---
        group_name = f"room.{message.conversation_id}"
        async_to_sync(layer.group_send)(
            group_name,
            {
                "type": "message.deleted",
                "message_id": message.id,
            },
        )
        
        return Response(status=status.HTTP_204_NO_CONTENT)

class MessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id):
        message = get_object_or_404(Message, pk=message_id)
        reaction_char = request.data.get('reaction')
        
        valid_reactions = [r[0] for r in MessageReaction.REACTION_CHOICES]
        if reaction_char not in valid_reactions:
            return Response({'detail': 'Invalid reaction.'}, status=status.HTTP_400_BAD_REQUEST)

        # ✨ FIX: New logic to handle changing an emoji
        
        # 1. Find any existing reaction by this user on this message
        existing_reaction = MessageReaction.objects.filter(message=message, user=request.user).first()

        status_code = status.HTTP_201_CREATED # Assume we are adding a new one

        if existing_reaction:
            # If the user is clicking the same emoji again, delete it.
            if existing_reaction.reaction == reaction_char:
                existing_reaction.delete()
                status_code = status.HTTP_204_NO_CONTENT
            # If the user is clicking a DIFFERENT emoji, update the existing one.
            else:
                existing_reaction.reaction = reaction_char
                existing_reaction.save()
        else:
            # If no reaction exists, create a new one.
            MessageReaction.objects.create(
                message=message,
                user=request.user,
                reaction=reaction_char
            )
        
        # After any change, fetch all current reactions and broadcast
        reactions = MessageReaction.objects.filter(message=message)
        reactions_data = [{'reaction': r.reaction, 'user_id': r.user_id} for r in reactions]
        
        layer = get_channel_layer()
        group_name = f"room.{message.conversation_id}"
        async_to_sync(layer.group_send)(
            group_name,
            {
                "type": "reaction.updated",
                "message_id": message.id,
                "reactions": reactions_data,
            },
        )
        
        return Response(status=status_code)

class ChatParticipantView(generics.ListAPIView):
    """
    Returns a flat list of all unique membership profiles that are participants
    in any of the requesting user's conversations. This includes inactive members
    to ensure their names are preserved in the chat history.
    """
    serializer_class = ChatParticipantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Get all conversations the user is in
        user_conversations = Conversation.objects.filter(participants__membership__user=user)
        # Get all memberships participating in those conversations
        participant_memberships = Membership.objects.filter(
            chat_participations__conversation__in=user_conversations
        ).distinct()
        return participant_memberships
