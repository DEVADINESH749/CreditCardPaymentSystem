from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.contrib.admin.models import ADDITION, LogEntry
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from cards.models import Card
from transactions.models import Transaction


User = get_user_model()


class TTYStringIO(StringIO):
	def isatty(self):
		return True


class UserManagerTests(TestCase):
	def test_create_user_uses_email_and_hashes_password(self):
		password = 'Distinct-manager-user-password-624!'
		user = User.objects.create_user(
			email='manager-user@example.com',
			name='Manager User',
			password=password,
		)

		self.assertEqual(user.email, 'manager-user@example.com')
		self.assertFalse(user.is_staff)
		self.assertFalse(user.is_superuser)
		self.assertTrue(user.check_password(password))

	def test_create_superuser_uses_email_without_username(self):
		password = 'Distinct-manager-admin-password-735!'
		user = User.objects.create_superuser(
			email='manager-admin@example.com',
			name='Manager Admin',
			password=password,
		)

		self.assertEqual(user.email, 'manager-admin@example.com')
		self.assertTrue(user.is_staff)
		self.assertTrue(user.is_superuser)
		self.assertTrue(user.check_password(password))

	def test_create_superuser_rejects_disabled_privileges(self):
		with self.assertRaises(ValueError):
			User.objects.create_superuser(
				email='invalid-admin@example.com',
				name='Invalid Admin',
				password='Distinct-manager-admin-password-846!',
				is_staff=False,
			)

	def test_createsuperuser_prompts_for_email_name_and_password_confirmation(self):
		with patch(
			'builtins.input',
			side_effect=['command-admin@example.com', 'Command Admin'],
		) as input_mock, patch(
			'django.contrib.auth.management.commands.createsuperuser.getpass.getpass',
			side_effect=['Test-only-password-value-815!', KeyboardInterrupt],
		) as password_mock:
			with self.assertRaises(SystemExit):
				call_command(
					'createsuperuser',
					stdin=TTYStringIO(),
					stdout=StringIO(),
					stderr=StringIO(),
					verbosity=0,
				)

		self.assertEqual(len(input_mock.call_args_list), 2)
		self.assertTrue(input_mock.call_args_list[0].args[0].startswith('Email'))
		self.assertTrue(input_mock.call_args_list[1].args[0].startswith('Name'))
		self.assertEqual(len(password_mock.call_args_list), 2)
		self.assertEqual(password_mock.call_args_list[1].args[0], 'Password (again): ')
		self.assertFalse(User.objects.filter(email='command-admin@example.com').exists())


class TokenRefreshTests(APITestCase):
	def setUp(self):
		self.user = User(email='refresh-user@example.com', name='Refresh User')
		self.user.set_password('Strong-refresh-password-123')
		self.user.save()
		self.refresh_token = str(RefreshToken.for_user(self.user))
		self.refresh_url = reverse('token-refresh')

	def test_valid_refresh_token_returns_new_access_token(self):
		response = self.client.post(
			self.refresh_url,
			{'refresh': self.refresh_token},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(response.data['access'])

	def test_invalid_refresh_token_is_rejected(self):
		response = self.client.post(
			self.refresh_url,
			{'refresh': 'invalid-refresh-token'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_expired_refresh_token_is_rejected(self):
		expired_token = RefreshToken.for_user(self.user)
		expired_token.set_exp(lifetime=timedelta(seconds=-1))
		response = self.client.post(
			self.refresh_url,
			{'refresh': str(expired_token)},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class RegistrationSecurityTests(APITestCase):
	def test_registration_hashes_password_and_does_not_return_it(self):
		password = 'Distinct-registration-password-481!'
		response = self.client.post(reverse('register'), {
			'name': 'Registration User',
			'email': 'registration-user@example.com',
			'password': password,
		}, format='json')

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertNotIn('password', response.data)
		user = User.objects.get(email='registration-user@example.com')
		self.assertTrue(user.check_password(password))
		self.assertNotEqual(user.password, password)

	def test_registration_rejects_weak_password(self):
		weak_password = 'tiny123'
		response = self.client.post(reverse('register'), {
			'name': 'Weak Password User',
			'email': 'weak-password-user@example.com',
			'password': weak_password,
		}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertNotIn(weak_password, response.content.decode())
		self.assertFalse(User.objects.filter(email='weak-password-user@example.com').exists())


class LoginSecurityTests(APITestCase):
	def setUp(self):
		self.password = 'Distinct-login-password-615!'
		self.user = User(email='login-user@example.com', name='Login User')
		self.user.set_password(self.password)
		self.user.save()

	def test_valid_login_returns_jwt_pair_without_password(self):
		response = self.client.post(reverse('login'), {
			'email': self.user.email,
			'password': self.password,
		}, format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)
		self.assertNotIn(self.password, response.content.decode())

	def test_invalid_password_is_rejected(self):
		response = self.client.post(reverse('login'), {
			'email': self.user.email,
			'password': 'invalid-login-password',
		}, format='json')

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AdminApiTests(APITestCase):
	def setUp(self):
		self.customer = User(
			email='admin-api-customer@example.com',
			name='Admin API Customer',
		)
		self.customer.set_password('Strong-customer-password-724!')
		self.customer.save()
		self.staff = User(
			email='admin-api-staff@example.com',
			name='Admin API Staff',
			is_staff=True,
		)
		self.staff.set_password('Strong-staff-password-835!')
		self.staff.save()
		self.card = Card.objects.create(
			user_id=self.customer.pk,
			card_type='CREDIT',
			card_holder_name='Admin API Customer',
			masked_card_number='************1234',
			last_four_digits='1234',
			expiry_month=12,
			expiry_year=2099,
		)
		self.transaction = Transaction.objects.create(
			user_id=self.customer.pk,
			card_id=self.card.pk,
			amount='25.50',
			transaction_reference='admin-api-reference',
			status='SUCCESS',
		)
		self.summary_url = reverse('admin-api-summary')

	def authenticate_as(self, user):
		token = str(RefreshToken.for_user(user).access_token)
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

	def test_current_user_endpoint_returns_only_safe_identity_and_role(self):
		self.authenticate_as(self.customer)
		response = self.client.get(reverse('current-user'))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertFalse(response.data['is_staff'])
		self.assertFalse(response.data['is_superuser'])
		self.assertNotIn('password', response.data)

	def test_admin_api_rejects_unauthenticated_and_customer_requests(self):
		unauthenticated = self.client.get(self.summary_url)
		self.assertEqual(unauthenticated.status_code, status.HTTP_401_UNAUTHORIZED)

		self.authenticate_as(self.customer)
		for url_name in (
			'admin-api-summary',
			'admin-api-users',
			'admin-api-cards',
			'admin-api-transactions',
		):
			with self.subTest(url_name=url_name):
				response = self.client.get(reverse(url_name))
				self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_staff_can_read_summary_and_sensitive_data_is_excluded(self):
		self.authenticate_as(self.staff)
		summary = self.client.get(self.summary_url)

		self.assertEqual(summary.status_code, status.HTTP_200_OK)
		self.assertEqual(summary.data['total_users'], 2)
		self.assertEqual(summary.data['total_cards'], 1)
		self.assertEqual(summary.data['total_transactions'], 1)
		self.assertEqual(summary.data['today']['payment_count'], 1)
		self.assertEqual(summary.data['today']['successful_amount'], '25.50')
		self.assertEqual(summary.data['recent_transactions'][0]['id'], self.transaction.pk)

		users = self.client.get(reverse('admin-api-users'))
		cards = self.client.get(reverse('admin-api-cards'))
		transactions = self.client.get(reverse('admin-api-transactions'))
		self.assertEqual(users.status_code, status.HTTP_200_OK)
		self.assertEqual(cards.status_code, status.HTTP_200_OK)
		self.assertEqual(transactions.status_code, status.HTTP_200_OK)
		self.assertNotIn('password', users.data['results'][0])
		self.assertEqual(cards.data['results'][0]['masked_card_number'], '************1234')
		self.assertNotIn('card_number', cards.data['results'][0])
		self.assertNotIn('cvv', cards.data['results'][0])
		self.assertNotIn('card_number', transactions.data['results'][0])
		self.assertNotIn('cvv', transactions.data['results'][0])

	def test_superuser_without_staff_flag_can_access_admin_api(self):
		superuser = User(
			email='admin-api-superuser@example.com',
			name='Admin API Superuser',
			is_superuser=True,
		)
		superuser.set_password('Strong-superuser-password-946!')
		superuser.save()
		self.authenticate_as(superuser)

		response = self.client.get(self.summary_url)

		self.assertEqual(response.status_code, status.HTTP_200_OK)


class UserAdminTests(TestCase):
	def setUp(self):
		self.admin_user = User(
			email='admin@example.com',
			name='Site Admin',
			is_staff=True,
			is_superuser=True,
		)
		self.admin_user.set_password('Strong-admin-password-789!')
		self.admin_user.save()
		self.client.force_login(self.admin_user)

	def test_admin_creates_email_user_with_hashed_password(self):
		add_url = reverse('admin:users_user_add')
		page = self.client.get(add_url)
		self.assertEqual(page.status_code, 200)
		self.assertContains(page, 'name="email"')
		self.assertNotContains(page, 'name="username"')

		response = self.client.post(add_url, {
			'email': 'new-user@example.com',
			'name': 'New User',
			'password1': 'Distinct-new-password-481!',
			'password2': 'Distinct-new-password-481!',
			'_save': 'Save',
		})

		self.assertEqual(response.status_code, 302)
		created_user = User.objects.get(email='new-user@example.com')
		self.assertTrue(created_user.check_password('Distinct-new-password-481!'))
		self.assertNotEqual(created_user.password, 'Distinct-new-password-481!')
		log_entry = LogEntry.objects.get(
			user=self.admin_user,
			object_id=str(created_user.pk),
			action_flag=ADDITION,
		)
		self.assertEqual(log_entry.object_repr, str(created_user))
