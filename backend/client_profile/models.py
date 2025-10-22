# client_profile/models.py
from django.db import models
from django.db.models import Q
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import date
import uuid
from django.contrib.contenttypes.fields import GenericRelation, GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from datetime import timedelta
from django.utils import timezone


class Organization(models.Model):
    """
    Corporate entity that claims pharmacies and manages org users.
    """
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class OnboardingNotification(models.Model):
    # Links to any onboarding model (PharmacistOnboarding, OtherStaffOnboarding, etc.)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    onboarding = GenericForeignKey('content_type', 'object_id')

    NOTIFICATION_TYPE_CHOICES = [
        ('referee1', 'Referee 1 Email'),
        ('referee2', 'Referee 2 Email'),
        ('admin_notify', 'Admin/Superuser Notification'),
        ('verified', 'Profile Verified Email'),
        ('failed', 'Profile Verification Failed Email'),
    ]
    notification_type = models.CharField(max_length=32, choices=NOTIFICATION_TYPE_CHOICES)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('content_type', 'object_id', 'notification_type')

    def __str__(self):
        return f"{self.onboarding} – {self.notification_type} sent at {self.sent_at}"

class OwnerOnboarding(models.Model):
    ROLE_CHOICES = [
        ("MANAGER", "Pharmacy Manager"),
        ("PHARMACIST", "Pharmacist"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    # Basic Info
    # username        = models.CharField(max_length=150)
    phone_number    = models.CharField(max_length=20)
    role            = models.CharField(max_length=20, choices=ROLE_CHOICES)
    chain_pharmacy  = models.BooleanField(default=False)

    # Regulatory Info for pharmacists only
    ahpra_number    = models.CharField(max_length=100, blank=True, null=True)

    verified        = models.BooleanField(default=False)

    organization        = models.ForeignKey(
                             Organization,
                             on_delete=models.SET_NULL,
                             null=True,
                             blank=True,
                             related_name='owner_onboardings'
                          )
    organization_claimed = models.BooleanField(default=False)
    
    # Verification Fields
    ahpra_verified = models.BooleanField(default=False, db_index=True)
    ahpra_registration_status = models.CharField(max_length=100, blank=True, null=True)
    ahpra_registration_type = models.CharField(max_length=100, blank=True, null=True)
    ahpra_expiry_date = models.DateField(blank=True, null=True)
    ahpra_verification_note = models.TextField(blank=True, null=True)

    # Notifications
    notifications = GenericRelation(OnboardingNotification)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['organization']),
        ]

    def __str__(self):
        # Always show the user’s login email
        return self.user.email

class PharmacistOnboarding(models.Model):
    REFEREE_REL_CHOICES = [
    ('manager', 'Manager'),
    ('supervisor', 'Supervisor'),
    ('colleague', 'Colleague'),
    ('owner', 'Owner'),
    ('other', 'Other'),
    ]
    ID_DOC_CHOICES = [
        ('GOV_ID', 'Government ID'),
        ('DRIVER_LICENSE', 'Driving license'),
        ('VISA', 'Visa'),
        ('AUS_PASSPORT', 'Australian Passport'),
        ('OTHER_PASSPORT', 'Other Passport'),
        ('AGE_PROOF', 'Age Proof Card'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    government_id = models.FileField(upload_to='gov_ids/', blank=True, null=True)
    government_id_type = models.CharField(max_length=32, choices=ID_DOC_CHOICES, blank=True, null=True)
    identity_meta = models.JSONField(default=dict, blank=True)  # per-type details: state/country/expiry/visa_type_number/valid_to
    identity_secondary_file = models.FileField(upload_to='gov_ids_secondary/', blank=True, null=True)  # second doc when required
    ahpra_number = models.CharField(max_length=100, blank=True, null=True)
    # phone_number = models.CharField(max_length=20, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    short_bio = models.TextField(blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)

    skills = models.JSONField(default=list, blank=True)
    skill_certificates = models.JSONField(default=dict, blank=True)

    payment_preference = models.CharField(max_length=10, blank=True, null=True)

    # ABN
    abn = models.CharField(max_length=20, blank=True, null=True)
    gst_registered = models.BooleanField(default=False)
    # Scraped ABN facts (kept)
    abn_entity_name      = models.CharField(max_length=255, blank=True, null=True)
    abn_entity_type      = models.CharField(max_length=100, blank=True, null=True)
    abn_status           = models.CharField(max_length=50,  blank=True, null=True)
    abn_gst_registered   = models.BooleanField(null=True, blank=True)   # None=unknown
    abn_gst_from         = models.DateField(blank=True, null=True)
    abn_gst_to           = models.DateField(blank=True, null=True)
    abn_last_checked     = models.DateTimeField(blank=True, null=True)
    abn_entity_confirmed = models.BooleanField(default=False)

    # TFN
    tfn_number = models.CharField(max_length=11, blank=True, null=True)
    super_fund_name = models.CharField(max_length=255, blank=True, null=True)
    super_usi = models.CharField(max_length=50, blank=True, null=True)
    super_member_number = models.CharField(max_length=100, blank=True, null=True)

    referee1_name = models.CharField(max_length=150, blank=True, null=True)
    referee1_relation = models.CharField(max_length=30, choices=REFEREE_REL_CHOICES, blank=True, null=True)
    referee1_email = models.EmailField(blank=True, null=True)
    referee1_confirmed = models.BooleanField(default=False)
    referee1_rejected = models.BooleanField(default=False)
    referee1_last_sent = models.DateTimeField(null=True, blank=True)
    referee1_workplace = models.CharField(max_length=150, blank=True, null=True)

    referee2_name = models.CharField(max_length=150, blank=True, null=True)
    referee2_relation = models.CharField(max_length=30, choices=REFEREE_REL_CHOICES, blank=True, null=True)
    referee2_email = models.EmailField(blank=True, null=True)
    referee2_confirmed = models.BooleanField(default=False)
    referee2_rejected = models.BooleanField(default=False)
    referee2_last_sent = models.DateTimeField(null=True, blank=True)
    referee2_workplace = models.CharField(max_length=150, blank=True, null=True)

    rate_preference = models.JSONField(blank=True, null=True)

    submitted_for_verification = models.BooleanField(default=False)
    verified = models.BooleanField(default=False)
    member_of_chain = models.BooleanField(default=False)

    # Verification Fields
    gov_id_verified = models.BooleanField(default=False, db_index=True)
    abn_verified = models.BooleanField(default=False, db_index=True)
    ahpra_verified = models.BooleanField(default=False, db_index=True)
    ahpra_registration_status = models.CharField(max_length=100, blank=True, null=True)
    ahpra_registration_type = models.CharField(max_length=100, blank=True, null=True)
    ahpra_expiry_date = models.DateField(blank=True, null=True)

    # Verification notes
    ahpra_verification_note = models.TextField(blank=True, null=True)
    gov_id_verification_note = models.TextField(blank=True, null=True)
    abn_verification_note = models.TextField(blank=True, null=True)

    # Location
    street_address   = models.CharField(max_length=255, blank=True, null=True)
    suburb           = models.CharField(max_length=100, blank=True, null=True)
    state            = models.CharField(max_length=50,  blank=True, null=True)
    postcode         = models.CharField(max_length=10,  blank=True, null=True)
    google_place_id  = models.CharField(max_length=255, blank=True, null=True)
    latitude         = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude        = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - Onboarding"

class OtherStaffOnboarding(models.Model):
    ROLE_CHOICES = [
        ("INTERN", "Intern Pharmacist"),
        ("TECHNICIAN", "Dispensary Technician"),
        ("ASSISTANT", "Pharmacy Assistant"),
        ("STUDENT", "Pharmacy Student"),
    ]

    ASSISTANT_LEVEL_CHOICES = [
        ("LEVEL_1", "Pharmacy Assistant - Level 1"),
        ("LEVEL_2", "Pharmacy Assistant - Level 2"),
        ("LEVEL_3", "Pharmacy Assistant - Level 3"),
        ("LEVEL_4", "Pharmacy Assistant - Level 4"),
    ]

    STUDENT_YEAR_CHOICES = [
        ("YEAR_1", "Pharmacy Student - 1st Year"),
        ("YEAR_2", "Pharmacy Student - 2nd Year"),
        ("YEAR_3", "Pharmacy Student - 3rd Year"),
        ("YEAR_4", "Pharmacy Student - 4th Year"),
    ]

    INTERN_HALF_CHOICES = [
        ("FIRST_HALF", "Intern - First Half"),
        ("SECOND_HALF", "Intern - Second Half"),
    ]

    REFEREE_REL_CHOICES = [
        ('manager', 'Manager'),
        ('supervisor', 'Supervisor'),
        ('colleague', 'Colleague'),
        ('owner', 'Owner'),
        ('other', 'Other'),
    ]

    # --- Core ---
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    # --- Identity (parity with Pharmacist) ---
    government_id = models.FileField(upload_to='gov_ids/', blank=True, null=True)
    government_id_type = models.CharField(max_length=32, choices=PharmacistOnboarding.ID_DOC_CHOICES, blank=True, null=True)
    identity_meta = models.JSONField(default=dict, blank=True)
    identity_secondary_file = models.FileField(upload_to='gov_ids_secondary/', blank=True, null=True)

    # --- Role selection ---
    role_type = models.CharField(max_length=50, choices=ROLE_CHOICES, blank=True, null=True)

    # --- Basic (address + dob; phone comes from User.mobile_number in V2 serializers) ---
    date_of_birth = models.DateField(blank=True, null=True)
    street_address = models.CharField(max_length=255, blank=True, null=True)
    suburb = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=50, blank=True, null=True)
    postcode = models.CharField(max_length=10, blank=True, null=True)
    google_place_id = models.CharField(max_length=255, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # --- Experience / Skills ---
    skills = models.JSONField(default=list, blank=True)
    skill_certificates = models.JSONField(default=dict, blank=True)  # per-skill files (parity with Pharmacist)
    years_experience = models.CharField(max_length=20, blank=True, null=True)

    # --- Payments (parity with Pharmacist) ---
    payment_preference = models.CharField(max_length=10, blank=True, null=True)
    abn = models.CharField(max_length=20, blank=True, null=True)
    gst_registered = models.BooleanField(default=False)
    # ABR-scraped facts
    abn_entity_name = models.CharField(max_length=255, blank=True, null=True)
    abn_entity_type = models.CharField(max_length=100, blank=True, null=True)
    abn_status = models.CharField(max_length=50, blank=True, null=True)
    abn_gst_registered = models.BooleanField(null=True, blank=True)  # None = unknown
    abn_gst_from = models.DateField(blank=True, null=True)
    abn_gst_to = models.DateField(blank=True, null=True)
    abn_last_checked = models.DateTimeField(blank=True, null=True)
    abn_entity_confirmed = models.BooleanField(default=False)

    # TFN (stored; masked via serializer)
    tfn_number = models.CharField(max_length=11, blank=True, null=True)
    super_fund_name = models.CharField(max_length=255, blank=True, null=True)
    super_usi = models.CharField(max_length=50, blank=True, null=True)
    super_member_number = models.CharField(max_length=100, blank=True, null=True)

    # --- Granular classification (award logic) ---
    classification_level = models.CharField(max_length=20, choices=ASSISTANT_LEVEL_CHOICES, blank=True, null=True)
    student_year = models.CharField(max_length=20, choices=STUDENT_YEAR_CHOICES, blank=True, null=True)
    intern_half = models.CharField(max_length=20, choices=INTERN_HALF_CHOICES, blank=True, null=True)

    # --- Role-specific docs (kept) ---
    ahpra_proof = models.FileField(upload_to='role_docs/', blank=True, null=True)
    hours_proof = models.FileField(upload_to='role_docs/', blank=True, null=True)
    certificate = models.FileField(upload_to='role_docs/', blank=True, null=True)
    university_id = models.FileField(upload_to='role_docs/', blank=True, null=True)
    cpr_certificate = models.FileField(upload_to='role_docs/', blank=True, null=True)
    s8_certificate = models.FileField(upload_to='role_docs/', blank=True, null=True)

    # --- Referees ---
    referee1_name = models.CharField(max_length=150, blank=True, null=True)
    referee1_relation = models.CharField(max_length=30, choices=REFEREE_REL_CHOICES, blank=True, null=True)
    referee1_email = models.EmailField(blank=True, null=True)
    referee1_workplace = models.CharField(max_length=150, blank=True, null=True)
    referee1_confirmed = models.BooleanField(default=False)
    referee1_rejected = models.BooleanField(default=False)
    referee1_last_sent = models.DateTimeField(null=True, blank=True)

    referee2_name = models.CharField(max_length=150, blank=True, null=True)
    referee2_relation = models.CharField(max_length=30, choices=REFEREE_REL_CHOICES, blank=True, null=True)
    referee2_email = models.EmailField(blank=True, null=True)
    referee2_workplace = models.CharField(max_length=150, blank=True, null=True)
    referee2_confirmed = models.BooleanField(default=False)
    referee2_rejected = models.BooleanField(default=False)
    referee2_last_sent = models.DateTimeField(null=True, blank=True)

    # --- Profile / Rate ---
    short_bio = models.TextField(blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)

    # --- Status ---
    verified = models.BooleanField(default=False)
    submitted_for_verification = models.BooleanField(default=False)

    # --- Verification flags / notes ---
    gov_id_verified = models.BooleanField(default=False, db_index=True)
    gov_id_verification_note = models.TextField(blank=True, null=True)

    ahpra_proof_verified = models.BooleanField(default=False, db_index=True)
    ahpra_proof_verification_note = models.TextField(blank=True, null=True)

    hours_proof_verified = models.BooleanField(default=False, db_index=True)
    hours_proof_verification_note = models.TextField(blank=True, null=True)

    certificate_verified = models.BooleanField(default=False, db_index=True)
    certificate_verification_note = models.TextField(blank=True, null=True)

    university_id_verified = models.BooleanField(default=False, db_index=True)
    university_id_verification_note = models.TextField(blank=True, null=True)

    cpr_certificate_verified = models.BooleanField(default=False, db_index=True)
    cpr_certificate_verification_note = models.TextField(blank=True, null=True)

    s8_certificate_verified = models.BooleanField(default=False, db_index=True)
    s8_certificate_verification_note = models.TextField(blank=True, null=True)

    abn_verified = models.BooleanField(default=False, db_index=True)
    abn_verification_note = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.role_type} Onboarding"

class ExplorerOnboarding(models.Model):
    ROLE_CHOICES = [
        ("STUDENT", "Student"),
        ("JUNIOR", "Junior"),
        ("CAREER_SWITCHER", "Career Switcher"),
    ]
  
    REFEREE_REL_CHOICES = [
    ('manager', 'Manager'),
    ('supervisor', 'Supervisor'),
    ('colleague', 'Colleague'),
    ('owner', 'Owner'),
    ('other', 'Other'),
    ]

    ID_DOC_CHOICES = [
        ('GOV_ID', 'Government ID'),
        ('DRIVER_LICENSE', 'Driving license'),
        ('VISA', 'Visa'),
        ('AUS_PASSPORT', 'Australian Passport'),
        ('OTHER_PASSPORT', 'Other Passport'),
        ('AGE_PROOF', 'Age Proof Card'),
    ]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    government_id = models.FileField(upload_to='gov_ids/', blank=True, null=True)
    role_type = models.CharField(max_length=50, choices=ROLE_CHOICES, blank=True, null=True)

    interests = models.JSONField(default=list, blank=True, null=True)     # e.g. ['Shadowing','Volunteering','Placement','Junior Assistant Role']

    # --- Referees ---
    referee1_name = models.CharField(max_length=150, blank=True, null=True)
    referee1_relation = models.CharField(max_length=30, choices=REFEREE_REL_CHOICES, blank=True, null=True)
    referee1_email = models.EmailField(blank=True, null=True)
    referee1_workplace = models.CharField(max_length=150, blank=True, null=True)
    referee1_confirmed = models.BooleanField(default=False)
    referee1_rejected = models.BooleanField(default=False)
    referee1_last_sent = models.DateTimeField(null=True, blank=True)

    referee2_name = models.CharField(max_length=150, blank=True, null=True)
    referee2_relation = models.CharField(max_length=30, choices=REFEREE_REL_CHOICES, blank=True, null=True)
    referee2_email = models.EmailField(blank=True, null=True)
    referee2_workplace = models.CharField(max_length=150, blank=True, null=True)
    referee2_confirmed = models.BooleanField(default=False)
    referee2_rejected = models.BooleanField(default=False)
    referee2_last_sent = models.DateTimeField(null=True, blank=True)

    short_bio = models.TextField(blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)

    verified = models.BooleanField(default=False)
    submitted_for_verification = models.BooleanField(default=False)

    # --- Address (same shape as Pharmacist) ---
    street_address   = models.CharField(max_length=255, blank=True, null=True)
    suburb           = models.CharField(max_length=100, blank=True, null=True)
    state            = models.CharField(max_length=50,  blank=True, null=True)
    postcode         = models.CharField(max_length=10,  blank=True, null=True)
    google_place_id  = models.CharField(max_length=255, blank=True, null=True)
    latitude         = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude        = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # --- Identity  ---
    government_id = models.FileField(upload_to='gov_ids/', blank=True, null=True)
    government_id_type = models.CharField(max_length=32, choices=ID_DOC_CHOICES, blank=True, null=True)
    identity_meta = models.JSONField(default=dict, blank=True)  # per-type details (state, expiry, visa fields…)
    identity_secondary_file = models.FileField(upload_to='gov_ids_secondary/', blank=True, null=True)

    # Verification flags/notes
    gov_id_verified = models.BooleanField(default=False, db_index=True)
    gov_id_verification_note = models.TextField(blank=True, null=True)


    def __str__(self):
        return f"{self.user.get_full_name()} - Explorer Onboarding"


class RefereeResponse(models.Model):
    # Link to the specific onboarding profile (works for all types)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    onboarding_profile = GenericForeignKey('content_type', 'object_id')

    # Link to the specific referee number (1 or 2)
    referee_index = models.PositiveSmallIntegerField(choices=[(1, 'Referee 1'), (2, 'Referee 2')])

    # Fields from your questionnaire
    referee_name = models.CharField(max_length=255, blank=True)
    referee_position = models.CharField(max_length=255, blank=True)
    relationship_to_candidate = models.CharField(max_length=255, blank=True)
    association_period = models.CharField(max_length=100, blank=True)
    contact_details = models.CharField(max_length=255, blank=True)

    # 1. Role & Performance
    role_and_responsibilities = models.TextField(blank=True)

    # 2. Professionalism & Work Ethic
    reliability_rating = models.CharField(max_length=20, blank=True) # Excellent, Good, etc.
    professionalism_notes = models.TextField(blank=True)

    skills_rating = models.CharField(max_length=20, blank=True)          # same options as above
    skills_strengths_weaknesses = models.TextField(blank=True)

    # 4. Teamwork & Communication
    teamwork_communication_notes = models.TextField(blank=True)
    feedback_conflict_notes = models.TextField(blank=True)

    # 5. Integrity & Conduct
    conduct_concerns = models.BooleanField(default=False)
    conduct_explanation = models.TextField(blank=True)

    # 6. Compliance & Safety
    compliance_adherence = models.CharField(max_length=10, blank=True)   # 'Yes' | 'No' | 'Unsure'
    compliance_incidents = models.TextField(blank=True)

    # 7. Rehire & Overall Recommendation (CRITICAL)
    would_rehire = models.CharField(max_length=20, blank=True)           # 'Yes' | 'No' | 'With Reservations'
    rehire_explanation = models.TextField(blank=True)

    # 8. Additional
    additional_comments = models.TextField(blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures a candidate can't have two responses for the same referee
        unique_together = ('content_type', 'object_id', 'referee_index')


# Pharmacy Model - Represents an individual pharmacy
class Pharmacy(models.Model):
    EMPLOYMENT_CHOICES = [
        ('PART_TIME', 'Part-time'),
        ('FULL_TIME',  'Full-time'),
        ('LOCUMS',     'Locums'),
    ]
    ROLE_CHOICES = [
        ('PHARMACIST',       'Pharmacist'),
        ('INTERN',           'Intern'),
        ('ASSISTANT',        'Assistant'),
        ('TECHNICIAN',       'Technician'),
        ('STUDENT',          'Student'),
        ('ADMIN',            'Admin'),
        ('DRIVER',           'Driver'),
    ]
    RATE_TYPE_CHOICES = [
        ('FIXED',             'Fixed'),
        ('FLEXIBLE',          'Flexible'),
        ('PHARMACIST_PROVIDED','Pharmacist Provided'),
    ]

    name                   = models.CharField(max_length=120)
    # --- ADD THESE NEW STRUCTURED ADDRESS FIELDS ---
    street_address = models.CharField(max_length=255, blank=True, null=True)
    suburb = models.CharField(max_length=100, blank=True, null=True)
    postcode = models.CharField(max_length=10, blank=True, null=True)
    google_place_id = models.CharField(max_length=255, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)


    # state = models.CharField(max_length=3, choices=STATE_CHOICES, blank=True, null=True)
    state = models.CharField(max_length=50, blank=True, null=True)

    owner                  = models.ForeignKey(
                                OwnerOnboarding,
                                on_delete=models.CASCADE,
                                null=True,
                                blank=True,
                                related_name='pharmacies'
                             )
    organization           = models.ForeignKey(
                                Organization,
                                on_delete=models.CASCADE,
                                null=True,
                                blank=True,
                                related_name='pharmacies'
                             )
    verified               = models.BooleanField(default=False)
    abn                    = models.CharField(max_length=20, blank=True, null=True)
    # asic_number            = models.CharField(max_length=50, blank=True, null=True)
    methadone_s8_protocols = models.FileField(upload_to='reg_docs/', blank=True, null=True)
    qld_sump_docs          = models.FileField(upload_to='reg_docs/', blank=True, null=True)
    sops                   = models.FileField(upload_to='other_docs/', blank=True, null=True)
    induction_guides       = models.FileField(upload_to='other_docs/', blank=True, null=True)

    # Opening hours split by day‐type
    weekdays_start         = models.TimeField(blank=True, null=True)
    weekdays_end           = models.TimeField(blank=True, null=True)
    saturdays_start        = models.TimeField(blank=True, null=True)
    saturdays_end          = models.TimeField(blank=True, null=True)
    sundays_start          = models.TimeField(blank=True, null=True)
    sundays_end            = models.TimeField(blank=True, null=True)
    public_holidays_start  = models.TimeField(blank=True, null=True)
    public_holidays_end    = models.TimeField(blank=True, null=True)

    # Employment & roles
    employment_types       = models.JSONField(default=list, blank=True)
    roles_needed           = models.JSONField(default=list, blank=True)

    # Default shift rate settings
    default_rate_type      = models.CharField(
                                max_length=50,
                                choices=RATE_TYPE_CHOICES,
                                blank=True,
                                null=True
                             )
    default_fixed_rate     = models.DecimalField(
                                max_digits=6,
                                decimal_places=2,
                                blank=True,
                                null=True
                             )

    about                  = models.TextField(blank=True)

    # verfications
    abn_verified = models.BooleanField(default=False, db_index=True)


    auto_publish_worker_requests = models.BooleanField(
        default=False,
        help_text=(
            "If True, worker-initiated swap/cover requests will automatically "
            "create and publish a new shift. "
            "If False, the request must be approved by the owner or admin first."
        ),
    )

    class Meta:
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['organization']),
            models.Index(fields=['state']),
        ]

    def __str__(self):
        return self.name


PHARMACIST_AWARD_LEVEL_CHOICES = [
    ('PHARMACIST', 'Pharmacist'),
    ('EXPERIENCED_PHARMACIST', 'Experienced Pharmacist'),
    ('PHARMACIST_IN_CHARGE', 'Pharmacist In Charge'),
    ('PHARMACIST_MANAGER', 'Pharmacist Manager'),
] #cite: 1

OTHERSTAFF_CLASSIFICATION_CHOICES = [
    ('LEVEL_1', 'Level 1'),
    ('LEVEL_2', 'Level 2'),
    ('LEVEL_3', 'Level 3'),
    ('LEVEL_4', 'Level 4'),
]

INTERN_HALF_CHOICES = [
    ('FIRST_HALF', 'First Half'),
    ('SECOND_HALF', 'Second Half'),
]

STUDENT_YEAR_CHOICES = [
    ('YEAR_1', 'Year 1'),
    ('YEAR_2', 'Year 2'),
    ('YEAR_3', 'Year 3'),
    ('YEAR_4', 'Year 4'),
]


# Membership Model - Manages the user roles within each pharmacy
class Membership(models.Model):
    ROLE_CHOICES = [
        ('PHARMACY_ADMIN', 'Pharmacy Admin'),
        ("PHARMACIST", "Pharmacist"),
        ("INTERN", "Intern Pharmacist"),
        ("TECHNICIAN", "Dispensary Technician"),
        ("ASSISTANT", "Pharmacy Assistant"),
        ("STUDENT", "Pharmacy Student"),
        ('CONTACT', 'Contact'), #  <-- ADD THIS LINE

    ]

    EMPLOYMENT_TYPE_CHOICES = [
        ("FULL_TIME", "Full-time"),
        ("PART_TIME", "Part-time"),
        ("LOCUM", "Locum"),
        ("CASUAL", "Casual"),
        ('SHIFT_HERO', 'Shift Hero')
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    pharmacy = models.ForeignKey(
        'client_profile.Pharmacy',
        on_delete=models.CASCADE,
        related_name='memberships',
        null=True,
        blank=True
    )

    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_pharmacy_invites',
        help_text="The user who sent this invitation."
    )
    invited_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Staff name as entered by the inviter (optional)."
    )
    role = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        blank=False,
        help_text="Staff role in pharmacy"
    )
    employment_type = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_TYPE_CHOICES,
        blank=False,
        help_text="Employment type"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # FIX 1.1.2: Add fields to store award level/classification details on Membership with choices
    pharmacist_award_level = models.CharField(
        max_length=50,
        choices=PHARMACIST_AWARD_LEVEL_CHOICES,
        blank=True, null=True,
        help_text="Pharmacist award level as per award rates"
    )
    otherstaff_classification_level = models.CharField(
        max_length=50,
        choices=OTHERSTAFF_CLASSIFICATION_CHOICES,
        blank=True, null=True,
        help_text="Other staff (Assistant/Technician) award classification"
    )
    intern_half = models.CharField(
        max_length=50,
        choices=INTERN_HALF_CHOICES,
        blank=True, null=True,
        help_text="Intern pharmacist half of training"
    )
    student_year = models.CharField(
        max_length=50,
        choices=STUDENT_YEAR_CHOICES,
        blank=True, null=True,
        help_text="Pharmacy student year of study"
    )


    class Meta:
        unique_together = ('user', 'pharmacy')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['pharmacy']),
            models.Index(fields=['user']),
            models.Index(fields=['pharmacy', 'user']),
        ]

    @property
    def is_pharmacy_admin(self):
        return self.role == 'PHARMACY_ADMIN'


    @property
    def staff_category(self) -> str:
        """
        Derived grouping for UI/filters:
        - 'PHARMACY_STAFF' for FULL_TIME/PART_TIME/CASUAL
        - 'FAVORITE_STAFF' for LOCUM/SHIFT_HERO
        """
        if self.employment_type in {'FULL_TIME', 'PART_TIME', 'CASUAL'}:
            return 'PHARMACY_STAFF'
        return 'FAVORITE_STAFF'


    def __str__(self):
        if self.pharmacy:
            return f"{self.user.email} in {self.pharmacy.name} ({self.role})"
        return self.user.email


class MembershipInviteLink(models.Model):
    """
    Multi-use magic link an Owner/Org Admin/Pharmacy Admin can generate
    for a specific pharmacy and category (FULL/PART-TIME vs LOCUM/CASUAL).
    Candidates submit a short form from this link; each submission becomes
    a MembershipApplication the owner can approve/reject.
    """
    CATEGORY_CHOICES = [
        ('FULL_PART_TIME', 'Full/Part-time'),
        ('LOCUM_CASUAL', 'Locum/Casual'),
    ]

    id = models.BigAutoField(primary_key=True)
    pharmacy = models.ForeignKey('Pharmacy', on_delete=models.CASCADE, related_name='invite_links')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_invite_links')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['pharmacy', 'is_active']),
        ]

    def is_valid(self) -> bool:
        return self.is_active and timezone.now() < self.expires_at

    def __str__(self):
        return f"{self.pharmacy.name} · {self.category} · {self.token}"


class MembershipApplication(models.Model):
    """
    A single candidate submission coming from a MembershipInviteLink.
    Owner reviews (approve/reject). On approve, we create/attach Membership
    and use your existing invite email flow.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.BigAutoField(primary_key=True)
    invite_link = models.ForeignKey(MembershipInviteLink, on_delete=models.CASCADE, related_name='applications')
    pharmacy = models.ForeignKey('Pharmacy', on_delete=models.CASCADE, related_name='membership_applications')

    # Category copied from link at submit time (for easy filtering)
    category = models.CharField(max_length=20, choices=MembershipInviteLink.CATEGORY_CHOICES)

    # Minimal fields per your spec
    role = models.CharField(max_length=20, choices=Membership.ROLE_CHOICES)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    mobile_number = models.CharField(max_length=32)

    # LEVEL – we keep your existing per-role fields so approval can map 1:1 into Membership
    pharmacist_award_level = models.CharField(
        max_length=50, blank=True, null=True,
        choices=PHARMACIST_AWARD_LEVEL_CHOICES,
    )
    otherstaff_classification_level = models.CharField(
        max_length=50, blank=True, null=True,
        choices=OTHERSTAFF_CLASSIFICATION_CHOICES,
    )
    intern_half = models.CharField(
        max_length=50, blank=True, null=True,
        choices=INTERN_HALF_CHOICES,
    )
    student_year = models.CharField(
        max_length=50, blank=True, null=True,
        choices=STUDENT_YEAR_CHOICES,
    )

    # Optional but RECOMMENDED to satisfy step (7) “existing user vs new”
    email = models.EmailField()

    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='membership_applications')

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    submitted_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(blank=True, null=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='membership_applications_decided')

    class Meta:
        indexes = [
            models.Index(fields=['pharmacy', 'status']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} → {self.pharmacy.name} ({self.status})"

# Chain Model - Represents a chain of pharmacies
class Chain(models.Model):
    owner = models.ForeignKey(
        'OwnerOnboarding',
        on_delete=models.CASCADE,
        related_name='chains',
        limit_choices_to={'role': 'OWNER'},
        null=True,
        blank=True
    )
    organization = models.ForeignKey(
        'Organization',
        on_delete=models.CASCADE,
        related_name='chains',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=120)  # Chain name
    logo = models.ImageField(upload_to='chain_logos/', blank=True)  # Chain logo
    subscription_plan = models.CharField(max_length=50, default="Basic")  # Subscription plan
    primary_contact_email = models.EmailField()  # Primary contact email for the chain admin
    created_at = models.DateTimeField(auto_now_add=True)  # Date when the chain was created
    updated_at = models.DateTimeField(auto_now=True)  # Date when the chain was last updated
    is_active = models.BooleanField(default=True)  # Whether the chain is active
    pharmacies = models.ManyToManyField(
        Pharmacy,
        blank=True,
        related_name='chains'
    )
    class Meta:
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['organization']),
        ]

    def __str__(self):
        return self.name

# Shift Model - Represents an available shift in a pharmacy
class Shift(models.Model):
    ROLE_CHOICES = [
        ('PHARMACIST', 'Pharmacist'),
        ('INTERN', 'Intern'),
        ('STUDENT', 'Student'),
        ('ASSISTANT', 'Assistant'),
        ('TECHNICIAN', 'Technician'),
        ('EXPLORER', 'Explorer'),
    ]
    RATE_TYPE_CHOICES = [
        ('FIXED', 'Fixed'),
        ('FLEXIBLE', 'Flexible'),
        ('PHARMACIST_PROVIDED', 'Pharmacist Provided'),
    ]
    EMPLOYMENT_TYPE_CHOICES = [
        ('FULL_TIME', 'Full-Time'),
        ('PART_TIME', 'Part-Time'),
        ('LOCUM', 'Locum'),
    ]

    pharmacy = models.ForeignKey(
        'Pharmacy',
        on_delete=models.CASCADE,
        related_name='shifts'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        editable=False,
        on_delete=models.SET_NULL,
        related_name='shifts_created'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    role_needed = models.CharField(max_length=50, choices=ROLE_CHOICES)
    employment_type = models.CharField(
        max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='LOCUM'
    )

    workload_tags = models.JSONField(default=list, blank=True)
    must_have = models.JSONField(default=list, blank=True)
    nice_to_have = models.JSONField(default=list, blank=True)

    rate_type = models.CharField(
        max_length=50, choices=RATE_TYPE_CHOICES,
        null=True, blank=True
    )
    fixed_rate = models.DecimalField(
        max_digits=6, decimal_places=2,
        null=True, blank=True
    )
    owner_adjusted_rate = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Optional bonus/hr offered by owner for all staff"
    )
    visibility = models.CharField(
        max_length=20,
        choices=[
            ('FULL_PART_TIME', 'Full/Part Time Pharmacy Members'),
            ('LOCUM_CASUAL',   'Locum/Casual Pharmacy Members'),
            ('OWNER_CHAIN',    'Owner Chain'),
            ('ORG_CHAIN',      'Organization Chain'),
            ('PLATFORM',       'Platform (Public)'),
        ],
        default='PLATFORM'
    )

    reveal_count = models.IntegerField(default=0)
    reveal_quota = models.IntegerField(null=True, blank=True)

    escalate_to_locum_casual = models.DateTimeField(null=True, blank=True)
    escalate_to_owner_chain = models.DateTimeField(null=True, blank=True)
    escalate_to_org_chain = models.DateTimeField(null=True, blank=True)
    escalate_to_platform = models.DateTimeField(null=True, blank=True)
    escalation_level = models.IntegerField(default=3)

    revealed_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='revealed_shifts'
    )
    interested_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='interested_shifts'
    )
    single_user_only = models.BooleanField(
        default=False,
        help_text="If true, only one user may take the entire shift (all slots)."
    )
    share_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, null=True)

    description = models.TextField(
        blank=True,
        null=True,
        help_text="A plain English description of the shift."
    )


    def clean(self):
        # Validate JSON lists are lists of strings
        for field in ['workload_tags', 'must_have', 'nice_to_have']:
            val = getattr(self, field)
            if not isinstance(val, list) or not all(isinstance(x, str) for x in val):
                raise ValidationError({field: 'Must be a list of strings.'})

        # Validate rate fields ONLY for PHARMACIST
        if self.role_needed == 'PHARMACIST':
            if self.rate_type == 'FIXED' and self.fixed_rate is None:
                raise ValidationError({'fixed_rate': 'fixed_rate required when rate_type=FIXED.'})
        else:
            if self.rate_type or self.fixed_rate is not None:
                raise ValidationError('Rate fields are only allowed for Pharmacist shifts.')


    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.pk and self.role_needed == 'PHARMACIST':
            self.rate_type = self.rate_type or self.pharmacy.default_rate_type
            self.fixed_rate = self.fixed_rate or self.pharmacy.default_fixed_rate
        super().save(*args, **kwargs)
   
    class Meta:
        indexes = [
            models.Index(fields=['pharmacy']),
            models.Index(fields=['created_by']),
        ]


class ShiftSlot(models.Model):
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name='slots'
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_recurring = models.BooleanField(default=False)
    recurring_days = models.JSONField(default=list, blank=True)
    recurring_end_date = models.DateField(null=True, blank=True)

    def clean(self):
        """
        Validates a ShiftSlot, ensuring recurring slot definitions are correct.

        - recurring_days: List of integers 0 (Monday) to 6 (Sunday) - consistent with Python's datetime.weekday().
        - recurring_end_date: Required for recurring slots, must be after start date.
        - For non-recurring, recurring_days must be empty.
        """
        if self.is_recurring:
            if not self.recurring_days:
                raise ValidationError({'recurring_days': 'This field is required for recurring slots.'})
            if not isinstance(self.recurring_days, list):
                raise ValidationError({'recurring_days': 'Must be a list of integers (0=Monday, 6=Sunday).'})
            for d in self.recurring_days:
                if not isinstance(d, int) or not (0 <= d <= 6):
                    raise ValidationError({'recurring_days': 'Each entry must be an integer between 0 (Monday) and 6 (Sunday).'})

            if self.recurring_end_date is None:
                raise ValidationError({'recurring_end_date': 'This field is required for recurring slots.'})
            if self.recurring_end_date <= self.date:
                raise ValidationError({'recurring_end_date': 'End date must be after start date for recurring slots.'})
        else:
            if self.recurring_days:
                raise ValidationError({'recurring_days': 'Should be empty for non-recurring slots.'})
            if self.recurring_end_date:
                raise ValidationError({'recurring_end_date': 'Should be empty for non-recurring slots.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.shift} slot on {self.date}"

class ShiftInterest(models.Model):
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name='interests'
    )
    slot = models.ForeignKey(
        ShiftSlot,
        on_delete=models.CASCADE,
        related_name='slot_interests',
        null=True, blank=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shift_interests'
    )

    revealed = models.BooleanField(default=False)

    expressed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        slot_info = f' (slot {self.slot.id})' if self.slot else ''
        return f"{self.user.get_full_name()} interested in {self.shift.pharmacy.name}{slot_info}"

class ShiftSlotAssignment(models.Model):
    # link back to the parent Shift for easy filtering
    shift = models.ForeignKey(
        'Shift',
        on_delete=models.CASCADE,
        related_name='slot_assignments'
    )
    slot = models.ForeignKey(
        'ShiftSlot',
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    slot_date = models.DateField(
        null=True,  # ✅ TEMPORARY — allow nulls just for migration
        blank=True,
        help_text="Specific date instance if this slot recurs"
    )
    # who is doing that slot
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='slot_assignments'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    unit_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Locked-in rate at time of assignment"
    )

    rate_reason = models.JSONField(
        default=dict,
        blank=True,
        help_text="Details explaining how the rate was calculated"
    )
    class Meta:
        unique_together = ('slot', 'slot_date')
        indexes = [
            models.Index(fields=['slot', 'slot_date']),      # Fast lookup by slot and date
            models.Index(fields=['user', 'slot_date']),      # Fast lookup for all slots by user for a day
        ]

    is_rostered = models.BooleanField(default=False) 

    def __str__(self):
        return f"{self.user.get_full_name()} assigned to slot {self.slot.id}"

class ShiftRejection(models.Model):
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name='rejections'
    )
    slot = models.ForeignKey(
        ShiftSlot,
        on_delete=models.CASCADE,
        related_name='slot_rejections',
        null=True, blank=True
    )
    slot_date = models.DateField(
        null=True, blank=True,
        help_text="Specific date instance if this slot recurs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='slot_rejections'
    )
    rejected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('slot', 'slot_date', 'user')
        indexes = [
            models.Index(fields=['slot', 'slot_date']),
            models.Index(fields=['user', 'slot_date']),
        ]

    def __str__(self):
        # FIX: Check if self.slot is not None before accessing its attributes
        slotinfo = f' (slot {self.slot.id})' if self.slot else ''
        # You can add slot_date for more detail if slot is present and has a date
        if self.slot and self.slot_date: # Only add slot_date if slot is not None and slot_date exists
            slotinfo = f" (slot {self.slot.id} on {self.slot_date})"
        elif self.slot_date: # If slot is None but slot_date exists (though unlikely for a full rejection)
            slotinfo = f" (on {self.slot_date})"
        # If both slot and slot_date are None, slotinfo remains an empty string.

        return f"{self.user.get_full_name()} rejected shift at {self.shift.pharmacy.name}{slotinfo}"

class LeaveRequest(models.Model):
    LEAVE_TYPE_CHOICES = [
        ('SICK', 'Sick Leave'),
        ('ANNUAL', 'Annual Leave'),
        ('COMPASSIONATE', 'Compassionate Leave'),
        ('STUDY', 'Study Leave'),
        ('CARER', 'Carer\'s Leave'),
        ('UNPAID', 'Unpaid Leave'),
        ('OTHER', 'Other'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    slot_assignment = models.ForeignKey(
        'ShiftSlotAssignment', 
        on_delete=models.CASCADE, 
        related_name='leave_requests'
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='PENDING')
    date_applied = models.DateTimeField(auto_now_add=True)
    date_resolved = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('slot_assignment', 'user', 'leave_type', 'status')  # Prevent duplicate pending leaves

    def __str__(self):
        return f"{self.user} requests {self.leave_type} for {self.slot_assignment} ({self.status})"

class WorkerShiftRequest(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("AUTO_PUBLISHED", "Auto Published"),
    ]

    pharmacy = models.ForeignKey(
        "client_profile.Pharmacy",
        on_delete=models.CASCADE,
        related_name="worker_shift_requests",
    )
    # Match your codebase convention: use AUTH_USER_MODEL (resolves to users.User in your setup)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="worker_shift_requests",
    )
    # Optional link for true “swap” (when requesting on an already-defined/assigned slot)
    shift = models.ForeignKey(
        "client_profile.ShiftSlotAssignment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="swap_requests",
    )

    role = models.CharField(max_length=100)
    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    note = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.requested_by} → {self.pharmacy} ({self.slot_date})"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Worker Shift Request"
        verbose_name_plural = "Worker Shift Requests"

# Rating model
class Rating(models.Model):
    """
    Global, relationship-level rating (not per shift/slot).
    - OWNER_TO_WORKER: owner/org admin/pharmacy admin rates a worker (pharmacist/other staff)
    - WORKER_TO_PHARMACY: worker rates a pharmacy
    Exactly one rating per relationship per direction; editable later.
    """

    class Direction(models.TextChoices):
        OWNER_TO_WORKER = "OWNER_TO_WORKER", "Owner/Org/PharmacyAdmin → Worker"
        WORKER_TO_PHARMACY = "WORKER_TO_PHARMACY", "Worker → Pharmacy"

    # Who is submitting the rating
    rater_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings_given",
        db_index=True,
    )

    # Target (exactly one of these will be set depending on direction)
    ratee_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings_received_as_worker",
        null=True, blank=True,
        db_index=True,
    )
    ratee_pharmacy = models.ForeignKey(
        "Pharmacy",
        on_delete=models.CASCADE,
        related_name="ratings_received",
        null=True, blank=True,
        db_index=True,
    )

    direction = models.CharField(max_length=32, choices=Direction.choices, db_index=True)

    # The rating itself
    stars = models.PositiveSmallIntegerField()  # enforce 1..5 in clean()
    comment = models.TextField(blank=True, null=True, max_length=1000)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # One rating per relationship, per direction
        constraints = [
            # OWNER_TO_WORKER uniqueness
            models.UniqueConstraint(
                fields=["rater_user", "ratee_user", "direction"],
                name="uniq_owner_to_worker_per_pair",
                condition=models.Q(direction="OWNER_TO_WORKER"),
            ),
            # WORKER_TO_PHARMACY uniqueness
            models.UniqueConstraint(
                fields=["rater_user", "ratee_pharmacy", "direction"],
                name="uniq_worker_to_pharmacy_per_pair",
                condition=models.Q(direction="WORKER_TO_PHARMACY"),
            ),
        ]
        indexes = [
            models.Index(fields=["direction", "rater_user"]),
            models.Index(fields=["direction", "ratee_user"]),
            models.Index(fields=["direction", "ratee_pharmacy"]),
        ]

    def clean(self):
        # stars must be 1..5
        if not (1 <= int(self.stars) <= 5):
            raise ValidationError({"stars": "Stars must be between 1 and 5."})

        if self.direction == self.Direction.OWNER_TO_WORKER:
            # must target a user; must NOT target a pharmacy
            if not self.rater_user_id or not self.ratee_user_id:
                raise ValidationError("OWNER_TO_WORKER requires rater_user and ratee_user.")
            if self.ratee_pharmacy_id is not None:
                raise ValidationError("OWNER_TO_WORKER must not set ratee_pharmacy.")
        elif self.direction == self.Direction.WORKER_TO_PHARMACY:
            # must target a pharmacy; must NOT target a user
            if not self.rater_user_id or not self.ratee_pharmacy_id:
                raise ValidationError("WORKER_TO_PHARMACY requires rater_user and ratee_pharmacy.")
            if self.ratee_user_id is not None:
                raise ValidationError("WORKER_TO_PHARMACY must not set ratee_user.")
        else:
            raise ValidationError({"direction": "Unknown direction."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        target = self.ratee_user_id or self.ratee_pharmacy_id
        return f"{self.direction} by {self.rater_user_id} → {target}: {self.stars}★"

## Invoice model
class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent',  'Sent'),
        ('paid',  'Paid'),
    ]

    # Who issues the invoice
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='invoices'
    )

    # Optional link to a ChemistTasker pharmacy
    pharmacy = models.ForeignKey(
        'client_profile.Pharmacy',
        on_delete=models.CASCADE,
        related_name='invoices',
        null=True,
        blank=True
    )
    pharmacy_name_snapshot    = models.CharField(max_length=255, blank=True, default="")
    pharmacy_address_snapshot = models.TextField(blank=True, default="")
    pharmacy_abn_snapshot     = models.CharField(max_length=20, blank=True, default="")

    # External-invoice fields
    external                = models.BooleanField(default=False)
    custom_bill_to_name     = models.CharField(max_length=255, blank=True)
    custom_bill_to_address  = models.TextField(blank=True)

    # —────────── Issuer snapshot (the one creating the invoice) ──────────—
    issuer_first_name        = models.CharField(max_length=150, blank=True, default="")
    issuer_last_name         = models.CharField(max_length=150, blank=True, default="")
    issuer_abn           = models.CharField(max_length=20, blank=True, default="")
    issuer_email = models.EmailField(blank=True, default="")
    gst_registered       = models.BooleanField(default=False)
    super_rate_snapshot  = models.DecimalField(max_digits=5, decimal_places=2, default=11.5)

    # —────────── Recipient snapshot (who’s billed) ──────────—
    bill_to_first_name       = models.CharField(max_length=150, blank=True, default="")
    bill_to_last_name        = models.CharField(max_length=150, blank=True, default="")
    bill_to_abn              = models.CharField(max_length=20,  blank=True, default="")

    bank_account_name    = models.CharField(max_length=255, blank=True, default="")
    bsb                  = models.CharField(max_length=6,   blank=True, default="")
    account_number       = models.CharField(max_length=20,  blank=True, default="")

    super_fund_name      = models.CharField(max_length=255, blank=True, default="")
    super_usi            = models.CharField(max_length=50,  blank=True, default="")
    super_member_number  = models.CharField(max_length=50,  blank=True, default="")

    bill_to_email        = models.EmailField(blank=True, default="")
    cc_emails            = models.TextField(blank=True, default="", help_text="Comma-separated emails for CC")

    invoice_date = models.DateField(default=date.today)

    due_date     = models.DateField(null=True, blank=True)

    subtotal   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    super_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total      = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['pharmacy']),
        ]

    def __str__(self):
        client = self.custom_bill_to_name if self.external else self.pharmacy_name_snapshot
        return f"Invoice {self.id} to {client}"

class InvoiceLineItem(models.Model):
    CATEGORY_CHOICES = [
        ('ProfessionalServices', 'Professional services'),
        ('Superannuation', 'Superannuation'),
        ('Transportation', 'Travel expenses'),
        ('Accommodation', 'Accommodation'),
        ('Miscellaneous', 'Miscellaneous reimbursements'),
    ]
    UNIT_CHOICES = [
        ('Hours', 'Hours'),
        ('Lump Sum', 'Lump Sum'),
    ]

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='line_items'
    )
    description      = models.CharField(max_length=255)
    category_code    = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='ProfessionalServices',
        help_text='ATO category code'
    )
    unit             = models.CharField(
        max_length=50,
        choices=UNIT_CHOICES,
        default='Hours',
        help_text='Unit of measure'
    )
    quantity         = models.DecimalField(max_digits=6, decimal_places=2)
    unit_price       = models.DecimalField(max_digits=10, decimal_places=2)
    discount         = models.DecimalField(
        max_digits=5, decimal_places=2,
        default=0,
        help_text='Discount percentage'
    )
    total            = models.DecimalField(max_digits=10, decimal_places=2)

    gst_applicable   = models.BooleanField(default=True)
    super_applicable = models.BooleanField(default=True)
    is_manual        = models.BooleanField(default=False)
    was_modified     = models.BooleanField(default=False)  # ✅ New field

    shift = models.ForeignKey(
        'client_profile.Shift',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice_items'
    )
    class Meta:
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['shift']),
        ]

    def __str__(self):
        return f"{self.description} – {self.quantity} {self.unit} @ {self.unit_price}"



# ExplorerPost Model
def explorer_post_upload_path(instance, filename):
    # Keep it flat & CDN-friendly (works with local MEDIA or Azure in prod)
    # e.g. explorer_posts/<post_id>/<filename>
    return f"explorer_posts/{instance.post_id}/{filename}"

class ExplorerPost(models.Model):
    explorer_profile = models.ForeignKey(
        'ExplorerOnboarding',
        on_delete=models.CASCADE,
        related_name='posts'
    )
    headline    = models.CharField(max_length=255)
    body        = models.TextField(blank=True)
    # Denormalized counters (kept in sync in views)
    view_count  = models.PositiveIntegerField(default=0)
    like_count  = models.PositiveIntegerField(default=0)
    reply_count = models.PositiveIntegerField(default=0)  # future-ready (comments)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['explorer_profile', '-created_at']),
        ]

    def __str__(self):
        return f"{self.headline} - {self.explorer_profile.user.get_full_name()}"

class ExplorerPostAttachment(models.Model):
    """
    Supports multiple attachments per post (image/video/pdf/etc.).
    Stored via your MEDIA backend (local dev) or Azure (prod), per settings.
    """
    IMAGE = 'IMAGE'
    VIDEO = 'VIDEO'
    FILE  = 'FILE'
    KIND_CHOICES = [(IMAGE, 'Image'), (VIDEO, 'Video'), (FILE, 'File')]

    post      = models.ForeignKey(ExplorerPost, on_delete=models.CASCADE, related_name='attachments')
    file      = models.FileField(upload_to=explorer_post_upload_path)
    kind      = models.CharField(max_length=10, choices=KIND_CHOICES, default=FILE)
    caption   = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['post'])]

    @property
    def post_id(self):
        return self.post_id  # used by upload path

class ExplorerPostReaction(models.Model):
    """
    Simple 'like' for now (one per user per post).
    Extend later for emojis by adding a 'type' field.
    """
    post   = models.ForeignKey(ExplorerPost, on_delete=models.CASCADE, related_name='reactions')
    user   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='explorer_post_reactions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('post', 'user')]
        indexes = [
            models.Index(fields=['post']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"❤️ u#{self.user_id} → p#{self.post_id}"






class UserAvailability(models.Model):
    """
    Timeslot model representing when a user is available to work.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_availabilities'
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_all_day = models.BooleanField(default=False)
    is_recurring = models.BooleanField(default=False)
    recurring_days = models.JSONField(default=list, blank=True)  # list of ints [0=Sun..6=Sat]
    recurring_end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        times = "All Day" if self.is_all_day else f"{self.start_time}-{self.end_time}"
        return f"{self.user.username} available {times} on {self.date}"



# --- Realtime Chat Models ----------------------------------------------------

class Conversation(models.Model):
    class Type(models.TextChoices):
        GROUP = "GROUP", "Group"
        DM = "DM", "Direct"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_conversations'
    )
    type = models.CharField(max_length=8, choices=Type.choices, default=Type.GROUP)
    title = models.CharField(max_length=255, blank=True)
    dm_key = models.CharField(max_length=63, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    pinned_message = models.ForeignKey(
        'Message',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+' # No reverse relation needed
    )

    # 👇 THIS IS THE MISSING FIELD TO ADD
    # This links a conversation to a pharmacy, identifying it as a "community" chat.
    pharmacy = models.ForeignKey(
        'client_profile.Pharmacy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='group_conversations'
    )

    class Meta:
        indexes = [
            models.Index(fields=['created_by', 'updated_at']),
            models.Index(fields=['pharmacy']),
            models.Index(fields=['dm_key']),
        ]
        constraints = [
            # This rule prevents duplicate community chats for the same pharmacy.
            models.UniqueConstraint(
                fields=['pharmacy'],
                name='uniq_community_chat_per_pharmacy',
                condition=models.Q(pharmacy__isnull=False)
            ),
            models.UniqueConstraint(fields=['dm_key'],
                                    name='uniq_dm_per_user_pair',
                                    condition=~models.Q(dm_key="")),
        ]

    def __str__(self):
        return self.title or f"Conversation {self.id}"

class Participant(models.Model):
    conversation = models.ForeignKey('client_profile.Conversation',
                                     on_delete=models.CASCADE,
                                     related_name='participants')
    membership = models.ForeignKey('client_profile.Membership',
                                   on_delete=models.PROTECT,
                                   related_name='chat_participations')
    is_admin = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    # FIX: Add is_pinned field to track pinning on a per-user basis.
    is_pinned = models.BooleanField(default=False)

    class Meta:
        unique_together = [('conversation', 'membership')]
        indexes = [
            models.Index(fields=['conversation']),
            models.Index(fields=['membership']),
        ]

    def __str__(self):
        return f"Participant m#{self.membership_id} in c#{self.conversation_id}"



def chat_upload_path(instance, filename):
    return f"chat/{instance.conversation_id}/{filename}"


class Message(models.Model):
    """
    A message in a conversation.
    Attachments use your existing MEDIA storage config.
    """
    conversation = models.ForeignKey('client_profile.Conversation',
                                     on_delete=models.CASCADE,
                                     related_name='messages')
    sender = models.ForeignKey('client_profile.Membership',
                               on_delete=models.CASCADE,
                               related_name='sent_messages')
    body = models.TextField(blank=True)
    attachment = models.FileField(upload_to=chat_upload_path, null=True, blank=True)
    attachment_filename = models.CharField(max_length=255, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    is_deleted = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    original_body = models.TextField(blank=True, null=True, help_text="Stores the original message body before an edit.")

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['sender']),
        ]

    def __str__(self):
        return f"Msg#{self.id} by m#{self.sender_id} in c#{self.conversation_id}"

class MessageReaction(models.Model):
    REACTION_CHOICES = [
        ('👍', 'Thumbs Up'),
        ('❤️', 'Heart'),
        ('🔥', 'Fire'),
        ('💩', 'Poop'),
    ]

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reactions')
    reaction = models.CharField(max_length=4, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures a user can only give one type of reaction per message
        unique_together = ('message', 'user', 'reaction')
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user} reacted with {self.reaction} to message {self.message.id}"

# --- Helper for DM key -------------------------------------------------------
def make_dm_key(user_id_a: int, user_id_b: int) -> str:
    """
    Deterministic pair key so the same two users map to the same DM room.
    e.g., make_dm_key(45, 12) -> '12:45'
    """
    a, b = sorted([int(user_id_a), int(user_id_b)])
    return f"{a}:{b}"


class NotificationQuerySet(models.QuerySet):
    def unread(self):
        return self.filter(read_at__isnull=True)


class Notification(models.Model):
    class Type(models.TextChoices):
        TASK = "task", "Task"
        MESSAGE = "message", "Message"
        ALERT = "alert", "Alert"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=32, choices=Type.choices, default=Type.TASK)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    action_url = models.CharField(max_length=512, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = NotificationQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "read_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def mark_read(self, commit: bool = True):
        if self.read_at:
            return False
        self.read_at = timezone.now()
        if commit:
            self.save(update_fields=["read_at"])
        return True

    def __str__(self):
        return f"Notification #{self.pk} to user {self.user_id} ({self.type})"


# PharmacyHub
class PharmacyCommunityGroup(models.Model):
    pharmacy = models.ForeignKey(
        "client_profile.Pharmacy",
        on_delete=models.CASCADE,
        related_name="community_groups",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_community_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["pharmacy", "name"],
                name="uniq_group_name_per_pharmacy",
            )
        ]
        indexes = [
            models.Index(fields=["pharmacy", "name"]),
            models.Index(fields=["pharmacy", "created_at"]),
        ]

    def __str__(self):
        return f"CommunityGroup#{self.pk} pharmacy={self.pharmacy_id} name={self.name}"


class PharmacyCommunityGroupMembership(models.Model):
    group = models.ForeignKey(
        PharmacyCommunityGroup,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    membership = models.ForeignKey(
        "client_profile.Membership",
        on_delete=models.CASCADE,
        related_name="community_group_memberships",
    )
    is_admin = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "membership")
        indexes = [
            models.Index(fields=["group"]),
            models.Index(fields=["membership"]),
        ]

    def clean(self):
        super().clean()
        if (
            self.membership
            and self.membership.pharmacy_id
            and self.group
            and self.group.pharmacy_id
            and self.membership.pharmacy_id != self.group.pharmacy_id
        ):
            raise ValidationError(
                "Membership must belong to the same pharmacy as the community group."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"CommunityGroupMembership#{self.pk} group={self.group_id} membership={self.membership_id}"


class PharmacyHubPost(models.Model):
    class Visibility(models.TextChoices):
        NORMAL = "NORMAL", "Normal"
        ANNOUNCEMENT = "ANNOUNCEMENT", "Announcement"

    pharmacy = models.ForeignKey(
        "client_profile.Pharmacy",
        on_delete=models.CASCADE,
        related_name="hub_posts",
    )
    author_membership = models.ForeignKey(
        "client_profile.Membership",
        on_delete=models.PROTECT,
        related_name="hub_posts",
    )
    body = models.TextField()
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.NORMAL,
    )
    allow_comments = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    organization = models.ForeignKey(
        "client_profile.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="hub_posts",
    )
    is_pinned = models.BooleanField(default=False)
    pinned_at = models.DateTimeField(null=True, blank=True)
    pinned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pinned_pharmacy_hub_posts",
    )
    community_group = models.ForeignKey(
        PharmacyCommunityGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="posts",
    )

    comment_count = models.PositiveIntegerField(default=0)
    reaction_summary = models.JSONField(default=dict, blank=True)
    original_body = models.TextField(blank=True, default="")
    is_edited = models.BooleanField(default=False)
    last_edited_at = models.DateTimeField(null=True, blank=True)
    last_edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="edited_pharmacy_hub_posts",
    )

    class Meta:
        ordering = ["-is_pinned", "-pinned_at", "-created_at"]
        indexes = [
            models.Index(fields=["pharmacy", "created_at"]),
            models.Index(fields=["author_membership"]),
            models.Index(fields=["is_pinned", "pinned_at"]),
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["community_group", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(pharmacy__isnull=False, organization__isnull=True)
                | Q(pharmacy__isnull=True, organization__isnull=False),
                name="pharmacy_hub_post_scope_check",
            )
        ]

    def save(self, *args, **kwargs):
        if self.community_group_id:
            group_pharmacy_id = self.community_group.pharmacy_id
            if not group_pharmacy_id:
                raise ValidationError("Community group must be linked to a pharmacy.")
            self.pharmacy_id = group_pharmacy_id
            self.organization_id = None
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                fields = set(update_fields)
                fields.update({"pharmacy", "organization"})
                kwargs["update_fields"] = list(fields)
        super().save(*args, **kwargs)

    def recompute_comment_count(self):
        from django.db.models import Count

        count = (
            self.comments.filter(deleted_at__isnull=True)
            .aggregate(total=Count("id"))
            .get("total", 0)
        )
        if count != self.comment_count:
            self.comment_count = count
            self.save(update_fields=["comment_count"])

    def recompute_reaction_summary(self):
        from django.db.models import Count

        summary = {
            row["reaction_type"]: row["total"]
            for row in self.reactions.values("reaction_type")
            .order_by()
            .annotate(total=Count("id"))
        }
        if summary != self.reaction_summary:
            self.reaction_summary = summary
            self.save(update_fields=["reaction_summary"])

    def soft_delete(self):
        if not self.deleted_at:
            self.deleted_at = timezone.now()
            self.is_pinned = False
            self.pinned_at = None
            self.pinned_by = None
            self.save(update_fields=["deleted_at", "is_pinned", "pinned_at", "pinned_by"])

    def __str__(self):
        target = (
            f"group={self.community_group_id}"
            if self.community_group_id
            else f"pharmacy={self.pharmacy_id}"
        )
        return f"HubPost#{self.pk} {target}"


class PharmacyHubComment(models.Model):
    post = models.ForeignKey(
        PharmacyHubPost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author_membership = models.ForeignKey(
        "client_profile.Membership",
        on_delete=models.PROTECT,
        related_name="hub_comments",
    )
    body = models.TextField()
    parent_comment = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    original_body = models.TextField(blank=True, default="")
    is_edited = models.BooleanField(default=False)
    last_edited_at = models.DateTimeField(null=True, blank=True)
    last_edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="edited_pharmacy_hub_comments",
    )

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["post", "created_at"]),
            models.Index(fields=["author_membership"]),
        ]

    def soft_delete(self):
        if not self.deleted_at:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at"])

    def __str__(self):
        return f"HubComment#{self.pk} post={self.post_id}"


class PharmacyHubReaction(models.Model):
    class ReactionType(models.TextChoices):
        LIKE = "LIKE", "Like"
        CELEBRATE = "CELEBRATE", "Celebrate"
        SUPPORT = "SUPPORT", "Support"
        INSIGHTFUL = "INSIGHTFUL", "Insightful"
        LOVE = "LOVE", "Love"

    post = models.ForeignKey(
        PharmacyHubPost,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    member = models.ForeignKey(
        "client_profile.Membership",
        on_delete=models.CASCADE,
        related_name="hub_reactions",
    )
    reaction_type = models.CharField(
        max_length=16,
        choices=ReactionType.choices,
        default=ReactionType.LIKE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("post", "member")
        indexes = [
            models.Index(fields=["post"]),
            models.Index(fields=["member"]),
        ]

    def __str__(self):
        return f"HubReaction#{self.pk} post={self.post_id} member={self.member_id}"


class PharmacyHubAttachment(models.Model):
    class Kind(models.TextChoices):
        IMAGE = "IMAGE", "Image"
        GIF = "GIF", "GIF"
        FILE = "FILE", "File"

    post = models.ForeignKey(
        PharmacyHubPost,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="pharmacy_hub/attachments/")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.FILE)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["post"]),
            models.Index(fields=["kind"]),
        ]

    def __str__(self):
        return f"Attachment#{self.pk} for post={self.post_id}"
