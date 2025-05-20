# client_profile/models.py
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import date
# from django.utils import timezone


class Organization(models.Model):
    """
    Corporate entity that claims pharmacies and manages org users.
    """
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class OwnerOnboarding(models.Model):
    ROLE_CHOICES = [
        ("MANAGER", "Pharmacy Manager"),
        ("PHARMACIST", "Pharmacist"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    # Basic Info
    username        = models.CharField(max_length=150)
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

    def __str__(self):
        # Always show the user’s login email
        return self.user.email


class PharmacistOnboarding(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    username = models.CharField(max_length=150)

    government_id = models.FileField(upload_to='gov_ids/')
    ahpra_number = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20)
    short_bio = models.TextField(blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)

    skills = models.JSONField(default=list, blank=True)
    software_experience = models.JSONField(default=list, blank=True)

    payment_preference = models.CharField(max_length=10)

    abn = models.CharField(max_length=20, blank=True, null=True)
    gst_registered = models.BooleanField(default=False)
    gst_file = models.FileField(upload_to='gst_docs/', blank=True, null=True)

    tfn_declaration = models.FileField(upload_to='tfn_docs/', blank=True, null=True)
    super_fund_name = models.CharField(max_length=255, blank=True, null=True)
    super_usi = models.CharField(max_length=50, blank=True, null=True)
    super_member_number = models.CharField(max_length=100, blank=True, null=True)

    referee1_email = models.EmailField()
    referee2_email = models.EmailField()

    # ✅ Embedded as JSONField
    rate_preference = models.JSONField(blank=True, null=True)

    verified = models.BooleanField(default=False)
    member_of_chain = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.get_full_name()} - Onboarding"


class OtherStaffOnboarding(models.Model):
    ROLE_CHOICES = [
        ("INTERN", "Intern Pharmacist"),
        ("TECHNICIAN", "Dispensary Technician"),
        ("ASSISTANT", "Assistant"),
        ("STUDENT", "Pharmacy Student"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    government_id = models.FileField(upload_to='gov_ids/')
    role_type = models.CharField(max_length=50, choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=20)
    skills = models.JSONField(default=list, blank=True)
    years_experience = models.CharField(max_length=20)
    payment_preference = models.CharField(max_length=10)

    # Role-specific docs
    ahpra_proof = models.FileField(upload_to='role_docs/', blank=True, null=True)
    hours_proof = models.FileField(upload_to='role_docs/', blank=True, null=True)
    certificate = models.FileField(upload_to='role_docs/', blank=True, null=True)
    university_id = models.FileField(upload_to='role_docs/', blank=True, null=True)
    cpr_certificate = models.FileField(upload_to='role_docs/', blank=True, null=True)
    s8_certificate = models.FileField(upload_to='role_docs/', blank=True, null=True)

    # Payment details
    abn = models.CharField(max_length=20, blank=True, null=True)
    gst_registered = models.BooleanField(default=False)
    gst_file = models.FileField(upload_to='gst_docs/', blank=True, null=True)
    tfn_declaration = models.FileField(upload_to='tfn_docs/', blank=True, null=True)
    super_fund_name = models.CharField(max_length=255, blank=True, null=True)
    super_usi = models.CharField(max_length=50, blank=True, null=True)
    super_member_number = models.CharField(max_length=100, blank=True, null=True)

    # References
    referee1_email = models.EmailField()
    referee2_email = models.EmailField()

    # Additional info
    short_bio = models.TextField(blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)

    verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.role_type} Onboarding"


class ExplorerOnboarding(models.Model):
    ROLE_CHOICES = [
        ("STUDENT", "Student"),
        ("JUNIOR", "Junior"),
        ("CAREER_SWITCHER", "Career Switcher"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    government_id = models.FileField(upload_to='gov_ids/')
    role_type = models.CharField(max_length=50, choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=20)

    interests = models.JSONField(default=list, blank=True)
    # e.g. ['Shadowing','Volunteering','Placement','Junior Assistant Role']

    referee1_email = models.EmailField()
    referee2_email = models.EmailField()
    short_bio = models.TextField(blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)

    verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.get_full_name()} - Explorer Onboarding"


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
    address                = models.CharField(max_length=255)

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
    asic_number            = models.CharField(max_length=50, blank=True, null=True)
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

    def __str__(self):
        return self.name

# Membership Model - Manages the user roles within each pharmacy
class Membership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    pharmacy = models.ForeignKey(
        'client_profile.Pharmacy',
        on_delete=models.CASCADE,
        related_name='memberships',
        null=True,
        blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'pharmacy')
        ordering = ['-created_at']

    def __str__(self):
        if self.pharmacy:
            return f"{self.user.get_full_name()} in {self.pharmacy.name}"
        return self.user.get_full_name()

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

    def __str__(self):
        return self.name


# Shift Model - Represents an available shift in a pharmacy
class Shift(models.Model):
    ROLE_CHOICES = [
        ('PHARMACIST', 'Pharmacist'),
        ('TECHNICIAN', 'Technician'),
        ('ASSISTANT', 'Assistant'),
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

    visibility = models.CharField(
        max_length=20,
        choices=[
            ('PHARMACY', 'Pharmacy Level'),
            ('OWNER_CHAIN', 'Owner Chain'),
            ('ORG_CHAIN', 'Organization Chain'),
            ('PLATFORM', 'Platform (Public)'),
        ],
        default='PLATFORM'
    )

    accepted_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='accepted_shift'
    )
    reveal_count = models.IntegerField(default=0)
    reveal_quota = models.IntegerField(null=True, blank=True)

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
    def clean(self):
        # Validate JSON lists are lists of strings
        for field in ['workload_tags', 'must_have', 'nice_to_have']:
            val = getattr(self, field)
            if not isinstance(val, list) or not all(isinstance(x, str) for x in val):
                raise ValidationError({field: 'Must be a list of strings.'})

        # Rate fields logic
        if self.role_needed != 'PHARMACIST' and (self.rate_type or self.fixed_rate is not None):
            raise ValidationError('Rate fields only allowed for Pharmacist shifts.')
        if self.rate_type == 'FIXED' and self.fixed_rate is None:
            raise ValidationError({'fixed_rate': 'fixed_rate required when rate_type=FIXED.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.pk and self.role_needed == 'PHARMACIST':
            self.rate_type = self.rate_type or self.pharmacy.default_rate_type
            self.fixed_rate = self.fixed_rate or self.pharmacy.default_fixed_rate
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Shift at {self.pharmacy.name}"


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
        if self.is_recurring:
            if not self.recurring_days:
                raise ValidationError('recurring_days required for recurring slots.')
            if self.recurring_end_date is None:
                raise ValidationError('recurring_end_date required for recurring slots.')
            if self.recurring_end_date < self.date:
                raise ValidationError('recurring_end_date must be after start date.')
        if not isinstance(self.recurring_days, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in self.recurring_days):
            raise ValidationError({'recurring_days': 'List of integers 0(Monday)-6(Sunday).'})

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
    # one slot — one assignment
    slot = models.OneToOneField(
        'ShiftSlot',
        on_delete=models.CASCADE,
        related_name='assignment'
    )
    # who is doing that slot
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='slot_assignments'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.get_full_name()} assigned to slot {self.slot.id}"


# ExplorerPost Model - Represents a post made by an explorer (student, junior, career switcher)
class ExplorerPost(models.Model):
    explorer_profile = models.ForeignKey('ExplorerOnboarding', on_delete=models.CASCADE)  # The explorer posting the interest
    headline = models.CharField(max_length=255)  # Title of the post
    body = models.TextField()  # Detailed description of the explorer's interests or background
    view_count = models.IntegerField(default=0)  # Number of views the post has received
    created_at = models.DateTimeField(auto_now_add=True)  # Timestamp when the post was created
    updated_at = models.DateTimeField(auto_now=True)  # Timestamp when the post was last updated

    def __str__(self):
        return f"{self.headline} - {self.explorer_profile.user.get_full_name()}"


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

    def __str__(self):
        times = "All Day" if self.is_all_day else f"{self.start_time}-{self.end_time}"
        return f"{self.user.username} available {times} on {self.date}"



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

    def __str__(self):
        client = self.custom_bill_to_name if self.external else self.pharmacy_name_snapshot
        return f"Invoice {self.id} to {client}"


class InvoiceLineItem(models.Model):
    CATEGORY_CHOICES = [
        ('4-1300', 'Professional services'),
        ('6-4200', 'Superannuation'),
        ('2-1500', 'Travel expenses'),
        ('2-1800', 'Miscellaneous reimbursements'),
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
        default='4-1300',
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

    shift = models.ForeignKey(
        'client_profile.Shift',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice_items'
    )

    def __str__(self):
        return f"{self.description} – {self.quantity} {self.unit} @ {self.unit_price}"
