from django.conf import settings
from django.shortcuts import redirect
from django_otp import devices_for_user
from two_factor.views.core import LoginView, OTPRequiredMixin


class AdminAwareLoginView(LoginView):
    def done(self, form_list, **kwargs):
        redirect_to = self.get_success_url()
        response = super().done(form_list, **kwargs)

        next_url = self.request.GET.get("next") or ""
        admin_url = f"/{settings.ADMIN_URL.strip('/')}/"
        has_confirmed_device = any(device.confirmed for device in devices_for_user(self.get_user()))

        if self.get_user().is_staff and next_url.startswith(admin_url) and not has_confirmed_device:
            self.request.session["next"] = redirect_to
            return redirect("two_factor:setup")

        if OTPRequiredMixin.is_otp_view(next_url):
            self.request.session["next"] = self.get_success_url()
            return redirect("two_factor:setup")

        return response
