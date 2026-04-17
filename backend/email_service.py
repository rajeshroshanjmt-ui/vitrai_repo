"""Email service for sending invitations and password reset emails."""
import os
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Email configuration from environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USER", "noreply@vetrai.ai"))
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Vetrai")
VETRAI_BASE_URL = os.getenv("VETRAI_BASE_URL", "http://localhost:3000")


def is_email_configured() -> bool:
    """Check if email service is properly configured."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """Send email via SMTP.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email body
        text_content: Plain text fallback

    Returns:
        True if successful, False otherwise
    """
    if not is_email_configured():
        print(f"[EMAIL DISABLED] Would send email to {to_email}: {subject}")
        return False

    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        # Attach parts
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Send via SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False


def send_invitation_email(recipient_email: str, recipient_name: str, setup_url: str) -> bool:
    """Send user invitation email with a pre-built password setup link.

    Args:
        recipient_email: Recipient email address
        recipient_name: Recipient display name
        setup_url: Full URL for password setup (pre-built by caller)

    Returns:
        True if successful, False otherwise
    """
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Welcome to Vetrai!</h2>
            <p>Hi {recipient_name},</p>
            <p>You have been invited to join a Vetrai workspace.</p>
            <p>Click the link below to set your password and get started:</p>
            <p><a href="{setup_url}" style="background-color: #42a5f5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Your Password</a></p>
            <p>Or copy and paste this link in your browser:</p>
            <p><code>{setup_url}</code></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't expect this invitation, you can ignore this email.</p>
        </body>
    </html>
    """

    text_content = f"""
Welcome to Vetrai!

Hi {recipient_name},

You have been invited to join a Vetrai workspace.

Set your password here:
{setup_url}

This link will expire in 1 hour.

If you didn't expect this invitation, you can ignore this email.
    """

    return send_email(
        to_email=recipient_email,
        subject="Welcome to Vetrai - Set Your Password",
        html_content=html_content,
        text_content=text_content
    )


def send_password_reset_email(recipient_email: str, reset_url: str) -> bool:
    """Send password reset email.

    Args:
        recipient_email: User email address
        reset_url: Full URL for password reset (pre-built by caller)

    Returns:
        True if successful, False otherwise
    """
    reset_link = reset_url

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the link below to set a new password:</p>
            <p><a href="{reset_link}" style="background-color: #42a5f5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
            <p>Or copy and paste this link in your browser:</p>
            <p><code>{reset_link}</code></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can ignore this email and your password will remain unchanged.</p>
        </body>
    </html>
    """

    text_content = f"""
Password Reset Request

We received a request to reset your password. Click the link below to set a new password:

{reset_link}

This link will expire in 1 hour.

If you didn't request a password reset, you can ignore this email and your password will remain unchanged.
    """

    return send_email(
        to_email=recipient_email,
        subject="Vetrai - Password Reset",
        html_content=html_content,
        text_content=text_content
    )
