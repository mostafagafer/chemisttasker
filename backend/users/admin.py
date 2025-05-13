from django.contrib import admin
from .models import User, OrganizationMembership

admin.site.register(User)

@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display  = ['user', 'organization', 'role', 'region']
    list_filter   = ['role', 'organization']
    search_fields = ['user__email', 'organization__name']


