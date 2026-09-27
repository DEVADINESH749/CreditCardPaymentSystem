import csv
from datetime import datetime, time, timedelta
from io import StringIO

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .admin import TransactionAdmin
from .models import Transaction


User = get_user_model()


class TransactionHistoryTests(APITestCase):
	def setUp(self):
		self.owner = User(email='history-owner@example.com', name='History Owner')
		self.owner.set_password('Strong-test-password-123')
		self.owner.save()
		self.other_user = User(email='history-other@example.com', name='Other User')
		self.other_user.set_password('Strong-test-password-456')
		self.other_user.save()
		token = str(RefreshToken.for_user(self.owner).access_token)
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
		self.history_url = reverse('transaction-list')

	def create_transaction(self, user, amount, transaction_status, transaction_date=None):
		transaction = Transaction.objects.create(
			user_id=user.pk,
			card_id=1,
			amount=amount,
			transaction_reference=f'ref-{user.pk}-{amount}-{transaction_status}',
			status=transaction_status,
		)
		if transaction_date is not None:
			Transaction.objects.filter(pk=transaction.pk).update(
				transaction_date=transaction_date
			)
			transaction.refresh_from_db()
		return transaction

	def test_history_requires_jwt_and_is_read_only(self):
		self.client.credentials()
		response = self.client.get(self.history_url)
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

		token = str(RefreshToken.for_user(self.owner).access_token)
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
		create_response = self.client.post(self.history_url, {}, format='json')
		self.assertEqual(create_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

	def test_history_only_returns_the_authenticated_users_transactions(self):
		own_transaction = self.create_transaction(self.owner, '10.00', 'SUCCESS')
		self.create_transaction(self.other_user, '20.00', 'SUCCESS')

		response = self.client.get(self.history_url)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual([row['id'] for row in response.data], [own_transaction.pk])

	def test_filters_by_status_amount_and_date(self):
		today = timezone.localdate()
		today_datetime = timezone.make_aware(datetime.combine(today, time(12)))
		yesterday_datetime = today_datetime - timedelta(days=1)
		matching = self.create_transaction(
			self.owner,
			'25.50',
			'SUCCESS',
			transaction_date=today_datetime,
		)
		self.create_transaction(
			self.owner,
			'25.50',
			'FAILED',
			transaction_date=today_datetime,
		)
		self.create_transaction(
			self.owner,
			'30.00',
			'SUCCESS',
			transaction_date=yesterday_datetime,
		)

		response = self.client.get(
			self.history_url,
			{'status': 'success', 'amount': '25.50', 'date': today.isoformat()},
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual([row['id'] for row in response.data], [matching.pk])

	def test_invalid_filters_return_bad_request(self):
		invalid_filters = (
			{'status': 'REFUNDED'},
			{'amount': '-1.00'},
			{'amount': '1.234'},
			{'date': 'not-a-date'},
			{'owner': 'other-user'},
		)

		for filters in invalid_filters:
			with self.subTest(filters=filters):
				response = self.client.get(self.history_url, filters)
				self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_detail_is_owner_scoped_and_read_only(self):
		own_transaction = self.create_transaction(self.owner, '10.00', 'SUCCESS')
		foreign_transaction = self.create_transaction(self.other_user, '20.00', 'FAILED')

		own_response = self.client.get(
			reverse('transaction-detail', args=[own_transaction.pk])
		)
		foreign_response = self.client.get(
			reverse('transaction-detail', args=[foreign_transaction.pk])
		)
		delete_response = self.client.delete(
			reverse('transaction-detail', args=[own_transaction.pk])
		)

		self.assertEqual(own_response.status_code, status.HTTP_200_OK)
		self.assertEqual(foreign_response.status_code, status.HTTP_404_NOT_FOUND)
		self.assertEqual(delete_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class TransactionAdminExportTests(APITestCase):
	def test_admin_action_exports_csv(self):
		user = User(email='csv-owner@example.com', name='CSV Owner')
		user.set_password('Strong-test-password-789')
		user.save()
		transaction = Transaction.objects.create(
			user_id=user.pk,
			card_id=3,
			amount='42.75',
			transaction_reference='csv-reference',
			status='SUCCESS',
		)
		model_admin = TransactionAdmin(Transaction, AdminSite())
		request = RequestFactory().get('/admin/transactions/transaction/')

		response = model_admin.export_selected_as_csv(
			request,
			Transaction.objects.filter(pk=transaction.pk),
		)

		rows = list(csv.reader(StringIO(response.content.decode('utf-8'))))
		self.assertEqual(response['Content-Type'], 'text/csv')
		self.assertEqual(response['Content-Disposition'], 'attachment; filename="transactions.csv"')
		self.assertEqual(rows[0], [
			'id', 'user_id', 'card_id', 'amount', 'transaction_reference',
			'status', 'transaction_date',
		])
		self.assertEqual(rows[1][4], transaction.transaction_reference)


class TransactionAdminSummaryTests(APITestCase):
	def test_admin_sees_daily_summary(self):
		admin_user = User(
			email='transaction-admin@example.com',
			name='Transaction Admin',
			is_staff=True,
			is_superuser=True,
		)
		admin_user.set_password('Strong-transaction-admin-password-1!')
		admin_user.save()
		self.client.force_login(admin_user)
		today = timezone.localdate()
		Transaction.objects.create(
			user_id=admin_user.pk,
			card_id=1,
			amount='42.75',
			transaction_reference='summary-success',
			status='SUCCESS',
		)
		Transaction.objects.create(
			user_id=admin_user.pk,
			card_id=1,
			amount='5.00',
			transaction_reference='summary-failed',
			status='FAILED',
		)

		response = self.client.get(reverse('admin:transactions_transaction_changelist'))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, f'Daily payment summary for {today:%Y-%m-%d}')
		self.assertContains(response, 'Successful amount')
		self.assertContains(response, '42.75')
