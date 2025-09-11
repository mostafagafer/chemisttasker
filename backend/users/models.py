# users/models.py

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from client_profile.models import Organization

class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self._create_user(email, password, **extra_fields)

class User(AbstractUser):
    # make username truly optional
    username = models.CharField(max_length=150, unique=False, blank=True, null=True)
    # enforce unique email and use it as the login field
    email = models.EmailField('email address', unique=True)

    ROLE_CHOICES = (
        ('OWNER',       'Pharmacy Owner'),
        ('PHARMACIST',  'Pharmacist'),
        ('OTHER_STAFF', 'Other Staff'),
        ('EXPLORER',    'Explorer'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    USERNAME_FIELD = 'email'       # log in with email
    REQUIRED_FIELDS = []           # no other fields required on create

    objects = CustomUserManager()

    def is_owner(self):
        return self.role == 'OWNER'
    def is_pharmacist(self):
        return self.role == 'PHARMACIST'
    def is_otherstaff(self):
        return self.role == 'OTHER_STAFF'
    def is_explorer(self):
        return self.role == 'EXPLORER'
    
    otp_code = models.CharField(max_length=8, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)
    is_otp_verified = models.BooleanField(default=False)
    accepted_terms = models.BooleanField(default=False)
    accepted_terms_at = models.DateTimeField(null=True, blank=True)

    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    mobile_otp_code = models.CharField(max_length=6, blank=True, null=True)
    mobile_otp_created_at = models.DateTimeField(blank=True, null=True)
    is_mobile_verified = models.BooleanField(default=False)


class OrganizationMembership(models.Model):
    """
    Assigns users to an Organization with one of three roles.
    """
    ROLE_CHOICES = (
        ('ORG_ADMIN',    'Organization Admin'),   # can claim, create pharmacies, invite users
        ('REGION_ADMIN', 'Region Admin'),         # can manage pharmacies in their region
        ('SHIFT_MANAGER','Shift Manager'),        # can post & accept shifts
    )

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organization_memberships')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    role         = models.CharField(max_length=30, choices=ROLE_CHOICES)
    region       = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ('user','organization')

    def __str__(self):
        return f"{self.user.email} – {self.role} @ {self.organization.name}"
