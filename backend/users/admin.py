from django.contrib import admin
from .models import User, OrganizationMembership, ContactMessage


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


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'email', 'name', 'source', 'created_at')
    search_fields = ('subject', 'email', 'name', 'message')
    list_filter = ('source', 'created_at')
    readonly_fields = ('created_at',)


