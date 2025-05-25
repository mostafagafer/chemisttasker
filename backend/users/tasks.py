from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from procrastinate.contrib.django import app

@app.task
def send_async_email(subject, recipient_list, template_name, context, from_email=None, text_template=None):
    from_email = from_email or settings.DEFAULT_FROM_EMAIL

    html_content = render_to_string(template_name, context)
    text_content = render_to_string(text_template, context) if text_template else html_content

    msg = EmailMultiAlternatives(subject, text_content, from_email, recipient_list)
    msg.attach_alternative(html_content, "text/html")
    try:
        msg.send()
        print("Email sent successfully.")
    except Exception as e:
        print("EMAIL SEND ERROR:", e)
        raise  # Still let the exception propagate
