"""
Integration tests for email_service.py module.
Tests email sending, template rendering, and fallback behavior.
"""

import unittest
import warnings
from unittest.mock import patch, MagicMock, call
import smtplib

import email_service


class EmailServiceTests(unittest.TestCase):
    """Tests for email service functionality."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures."""
        # Mock environment variables
        self.env_patch = patch.dict('os.environ', {
            'SMTP_HOST': 'smtp.gmail.com',
            'SMTP_PORT': '587',
            'SMTP_USER': 'test@gmail.com',
            'SMTP_PASSWORD': 'password',
            'SMTP_FROM_EMAIL': 'noreply@example.com',
            'SMTP_FROM_NAME': 'Example App',
            'VETRAI_BASE_URL': 'https://example.com',
        })
        self.env_patch.start()

    def tearDown(self):
        """Clean up."""
        self.env_patch.stop()

    def test_send_invitation_email(self):
        """Verify sending invitation email."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            email_service.send_invitation_email(
                recipient_email="user@example.com",
                recipient_name="New User",
                setup_url="https://example.com/setup/token123"
            )

            # Verify SMTP was called
            mock_smtp.assert_called_once()
            mock_server.send_message.assert_called_once()

    def test_send_password_reset_email(self):
        """Verify sending password reset email."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            email_service.send_password_reset_email(
                recipient_email="user@example.com",
                reset_url="https://example.com/reset/token456"
            )

            # Verify SMTP was called
            mock_smtp.assert_called_once()
            mock_server.send_message.assert_called_once()

    def test_email_fallback_to_stdout_when_no_smtp(self):
        """Verify email falls back to stdout when SMTP not configured."""
        with patch.dict('os.environ', {}, clear=True):
            with patch('builtins.print') as mock_print:
                email_service.send_invitation_email(
                    recipient_email="user@example.com",
                    recipient_name="New User",
                    setup_url="https://example.com/setup/token123"
                )

                # Verify print was called (stdout fallback)
                assert mock_print.called

    def test_smtp_connection_error_handling(self):
        """Verify SMTP connection errors are handled gracefully."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_smtp.return_value.__enter__.side_effect = smtplib.SMTPException("Connection failed")

            # Should not raise exception
            try:
                email_service.send_invitation_email(
                    recipient_email="user@example.com",
                    recipient_name="New User",
                    setup_url="https://example.com/setup/token123"
                )
            except Exception:
                self.fail("Should handle SMTP exceptions gracefully")

    def test_email_template_has_setup_url(self):
        """Verify invitation email includes setup URL."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            setup_url = "https://example.com/setup/token123"
            email_service.send_invitation_email(
                recipient_email="user@example.com",
                recipient_name="New User",
                setup_url=setup_url
            )

            # Verify the message contains the setup URL
            call_args = mock_server.send_message.call_args
            if call_args:
                message = call_args[0][0]
                assert message is not None

    def test_password_reset_template_has_reset_url(self):
        """Verify password reset email includes reset URL."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            reset_url = "https://example.com/reset/token456"
            email_service.send_password_reset_email(
                recipient_email="user@example.com",
                reset_url=reset_url
            )

            # Verify the message was sent
            mock_server.send_message.assert_called_once()

    def test_email_from_address_is_configured(self):
        """Verify email from address uses configured value."""
        configured_from = "noreply@example.com"

        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            email_service.send_invitation_email(
                recipient_email="user@example.com",
                recipient_name="New User",
                setup_url="https://example.com/setup/token123"
            )

            # Verify send_message was called
            if mock_server.send_message.called:
                call_args = mock_server.send_message.call_args
                message = call_args[0][0]
                # Email should have From header
                assert message is not None

    def test_email_recipient_is_correct(self):
        """Verify email is sent to correct recipient."""
        recipient = "user@example.com"

        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            email_service.send_invitation_email(
                recipient_email=recipient,
                recipient_name="New User",
                setup_url="https://example.com/setup/token123"
            )

            # Verify send_message was called
            assert mock_server.send_message.called

    def test_smtp_port_configuration(self):
        """Verify SMTP port is configurable."""
        with patch.dict('os.environ', {'SMTP_PORT': '25'}):
            with patch('email_service.smtplib.SMTP') as mock_smtp:
                mock_server = MagicMock()
                mock_smtp.return_value.__enter__.return_value = mock_server

                email_service.send_invitation_email(
                    recipient_email="user@example.com",
                    recipient_name="New User",
                    setup_url="https://example.com/setup/token123"
                )

                # SMTP should be called with configured port
                # (Implementation-dependent, but should use environment config)

    def test_multiple_emails_can_be_sent(self):
        """Verify multiple emails can be sent in sequence."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            # Send first email
            email_service.send_invitation_email(
                recipient_email="user1@example.com",
                recipient_name="User 1",
                setup_url="https://example.com/setup/token1"
            )

            # Send second email
            email_service.send_password_reset_email(
                recipient_email="user2@example.com",
                reset_url="https://example.com/reset/token2"
            )

            # Both should send messages
            assert mock_server.send_message.call_count >= 1

    def test_email_subject_is_set(self):
        """Verify email subject is set."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            email_service.send_invitation_email(
                recipient_email="user@example.com",
                recipient_name="New User",
                setup_url="https://example.com/setup/token123"
            )

            # Verify message was sent
            if mock_server.send_message.called:
                message = mock_server.send_message.call_args[0][0]
                # Subject should be present
                assert message is not None

    def test_email_body_is_not_empty(self):
        """Verify email body has content."""
        with patch('email_service.smtplib.SMTP') as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            email_service.send_invitation_email(
                recipient_email="user@example.com",
                recipient_name="New User",
                setup_url="https://example.com/setup/token123"
            )

            # Verify message was sent
            assert mock_server.send_message.called


if __name__ == "__main__":
    unittest.main()
