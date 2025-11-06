from __future__ import annotations

from typing import Iterable

from django.conf import settings

from users.models import OrganizationMembership
from users.org_roles import (
    OrgCapability,
    get_admin_level_definition,
    get_role_definition,
    role_capabilities,
)

CAPABILITY_DESCRIPTIONS: dict[str, str] = {
    OrgCapability.MANAGE_ADMINS: "Assign and manage pharmacy administrators",
    OrgCapability.MANAGE_STAFF: "Invite staff and update their memberships",
    OrgCapability.MANAGE_ROSTER: "Create shifts and coordinate roster coverage",
    OrgCapability.MANAGE_COMMS: "Use organization chats, announcements, and hub tools",
    OrgCapability.INVITE_STAFF: "Send invitations to new organization members",
    OrgCapability.CLAIM_PHARMACY: "Claim or onboard pharmacies into the organization",
    OrgCapability.VIEW_ALL_PHARMACIES: "View every pharmacy linked to the organization",
    OrgCapability.ASSIGN_PHARMACIES: "Assign pharmacies to region administrators",
}


def _label_for_role(role: str | None) -> str:
    if not role:
        return "Organization Member"
    return role.replace("_", " ").title()


def _label_for_admin_level(level: str | None) -> str:
    if not level:
        return "Manager"
    return level.replace("_", " ").title()


def get_frontend_onboarding_url(user):
    if user.role == 'OTHER_STAFF':
        role_slug = 'otherstaff'
    elif user.role == 'ORG_STAFF':
        role_slug = 'organization'
    else:
        role_slug = (user.role or 'owner').lower()
    return f"{settings.FRONTEND_BASE_URL}/onboarding/{role_slug}/"


def build_org_invite_context(
    *,
    membership: OrganizationMembership | None,
    inviter,
    magic_link: str,
    dashboard_link: str,
    temp_password: str | None = None,
) -> dict:
    """
    Construct the email context for an organisation invitation.
    Handles scoped chief/region admins as well as full org admins.
    """
    inviter_name = getattr(inviter, "get_full_name", None)
    if callable(inviter_name):
        inviter_name = inviter.get_full_name()
    if not inviter_name:
        inviter_name = getattr(inviter, "email", None) or "A ChemistTasker admin"

    if not membership:
        return {
            "org_name": "",
            "role_label": "Organization Member",
            "magic_link": magic_link,
            "dashboard_link": dashboard_link,
            "inviter": inviter_name,
            "capability_descriptions": [],
            "admin_level_label": "Manager",
            "admin_level_description": "",
            "scope_message": "",
            "pharmacies": [],
            "has_pharmacies": False,
            "role_description": "",
            "job_title": "",
            "region": "",
            "temporary_password": temp_password,
        }

    organization = membership.organization
    org_name = organization.name if organization else ""

    role_definition = get_role_definition(membership.role)
    admin_definition = get_admin_level_definition(membership.admin_level)

    role_label = getattr(role_definition, "label", _label_for_role(membership.role))
    role_description = getattr(role_definition, "description", "")

    admin_level_label = getattr(
        admin_definition, "label", _label_for_admin_level(membership.admin_level)
    )
    admin_level_description = getattr(admin_definition, "description", "")

    pharmacies_qs = membership.pharmacies.all().order_by("name")
    pharmacy_names = [
        pharmacy.name for pharmacy in pharmacies_qs if getattr(pharmacy, "name", None)
    ]

    scope_message = ""
    if membership.role == "REGION_ADMIN":
        if pharmacy_names:
            scope_message = (
                "You'll oversee operations for the following pharmacies: "
                + ", ".join(pharmacy_names)
                + "."
            )
        else:
            scope_message = (
                "You'll be able to assign pharmacies to your region once you sign in."
            )
    elif membership.role == "CHIEF_ADMIN":
        if pharmacy_names:
            scope_message = (
                "You'll manage onboarding and day-to-day activity for: "
                + ", ".join(pharmacy_names)
                + "."
            )
        else:
            scope_message = (
                "You'll help manage the organization's pharmacies and support each location."
            )
    elif membership.role == "ORG_ADMIN":
        scope_message = (
            "You'll have full visibility across the organization and all pharmacies linked to it."
        )

    capability_keys: Iterable[str] = role_capabilities(
        membership.role, membership.admin_level
    )
    capability_descriptions = [
        CAPABILITY_DESCRIPTIONS.get(key, key.replace("_", " ").title())
        for key in sorted(capability_keys)
    ]

    context = {
        "org_name": org_name,
        "role_label": role_label,
        "role_description": role_description,
        "magic_link": magic_link,
        "dashboard_link": dashboard_link,
        "inviter": inviter_name,
        "admin_level_label": admin_level_label,
        "admin_level_description": admin_level_description,
        "capability_descriptions": capability_descriptions,
        "job_title": membership.job_title or "",
        "region": membership.region or "",
        "scope_message": scope_message,
        "pharmacies": pharmacy_names,
        "has_pharmacies": bool(pharmacy_names),
        "temporary_password": temp_password,
    }

    return context
