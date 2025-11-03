from django.contrib import admin
from .models import User, OrganizationMembership


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'username', 'role', 'is_active')
    list_filter = ('role', 'is_active')
    search_fields = ('email', 'username')
    ordering = ('-date_joined',)


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role', 'region']
    list_filter = ['role', 'organization']
    search_fields = ['user__email', 'organization__name']


