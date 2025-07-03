from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import traceback

def send_async_email(subject, recipient_list, template_name, context, from_email=None, text_template=None):

    print("=== EMAIL TASK ENTRY ===")
    print("Subject:", subject)
    print("Recipient List:", recipient_list)
    print("Template Name:", template_name)
    print("Text Template:", text_template)
    print("Context:", context)

    from_email = from_email or settings.DEFAULT_FROM_EMAIL

    # Extra: Defensive strip and clean for recipient email
    safe_recipient_list = [e.strip().replace('\u200f','').replace('\u200e','') for e in recipient_list]
    print("Safe Recipient List:", safe_recipient_list)

    html_content = render_to_string(template_name, context)
    text_content = render_to_string(text_template, context) if text_template else html_content

    msg = EmailMultiAlternatives(subject, text_content, from_email, safe_recipient_list)
    msg.attach_alternative(html_content, "text/html")
    try:
        msg.send()
        print("Email sent successfully.")
    except Exception as e:
        print("EMAIL SEND ERROR:", e)
        traceback.print_exc()
        raise  