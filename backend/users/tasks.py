from django.conf import settings
import traceback
import logging
logger = logging.getLogger(__name__)

def send_async_email(subject, recipient_list, template_name, context, from_email=None, text_template=None):
    from django.core.mail import EmailMultiAlternatives
    from django.template.loader import render_to_string

    logger = logging.getLogger("users.tasks")
    logger.info("=== EMAIL TASK ENTRY ===")
    logger.info("Subject: %s", subject)
    logger.info("Recipient List: %s", recipient_list)
    logger.info("Template Name: %s", template_name)
    logger.info("Text Template: %s", text_template)
    logger.info("Context: %s", context)

    from_email = from_email or settings.DEFAULT_FROM_EMAIL

    # Defensive clean for email addresses
    safe_recipient_list = [e.strip().replace('\u200f','').replace('\u200e','') for e in recipient_list]
    logger.info("Safe Recipient List: %s", safe_recipient_list)

    try:
        html_content = render_to_string(template_name, context)
        text_content = render_to_string(text_template, context) if text_template else html_content

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=safe_recipient_list,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()

        logger.info("Email sent successfully.")
    except Exception as e:
        logger.error("Failed to send email: %s", str(e))
        traceback.print_exc()
