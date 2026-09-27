from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Card


User = get_user_model()


class CardManagementTests(APITestCase):
	def setUp(self):
		self.owner = User(email='owner@example.com', name='Card Owner')
		self.owner.set_password('Strong-test-password-123')
		self.owner.save()
		self.other_user = User(email='other@example.com', name='Other User')
		self.other_user.set_password('Strong-test-password-456')
		self.other_user.save()
		self.cards_url = reverse('card-list-create')
		access_token = str(RefreshToken.for_user(self.owner).access_token)
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

	def valid_card_payload(self, **overrides):
		payload = {
			'card_type': 'CREDIT',
			'card_holder_name': 'Card Owner',
			'card_number': '4242424242424242',
			'expiry_month': 12,
			'expiry_year': date.today().year + 1,
		}
		payload.update(overrides)
		return payload

	def test_card_endpoints_require_jwt(self):
		self.client.credentials()

		list_response = self.client.get(self.cards_url)
		create_response = self.client.post(
			self.cards_url,
			self.valid_card_payload(),
			format='json',
		)

		self.assertEqual(list_response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(create_response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(Card.objects.count(), 0)

	def test_expired_access_token_is_rejected(self):
		expired_token = RefreshToken.for_user(self.owner).access_token
		expired_token.set_exp(lifetime=timedelta(seconds=-1))
		self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {expired_token}')

		response = self.client.get(self.cards_url)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_create_stores_only_masked_number_and_last_four(self):
		response = self.client.post(
			self.cards_url,
			self.valid_card_payload(),
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertNotIn('card_number', response.data)
		self.assertNotIn('cvv', response.data)

		card = Card.objects.get(pk=response.data['id'])
		self.assertEqual(card.user_id, self.owner.pk)
		self.assertEqual(card.masked_card_number, '************4242')
		self.assertEqual(card.last_four_digits, '4242')
		self.assertFalse(hasattr(card, 'card_number'))
		self.assertFalse(hasattr(card, 'cvv'))

	def test_rejects_invalid_card_data_and_sensitive_extras(self):
		invalid_payloads = [
			{'card_number': '1234567890123456'},
			{'card_number': '4242424242424242', 'expiry_month': 0},
			{'card_number': '4242424242424242', 'expiry_year': 2000},
			{'card_number': '4242424242424242', 'cvv': '123'},
			{'card_number': '4242424242424242', 'user_id': self.other_user.pk},
		]

		for override in invalid_payloads:
			with self.subTest(override=override):
				response = self.client.post(
					self.cards_url,
					self.valid_card_payload(**override),
					format='json',
				)
				self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

		self.assertEqual(Card.objects.count(), 0)

	def test_list_and_delete_are_scoped_to_authenticated_user(self):
		own_card_response = self.client.post(
			self.cards_url,
			self.valid_card_payload(),
			format='json',
		)
		other_card = Card.objects.create(
			user_id=self.other_user.pk,
			card_type='DEBIT',
			card_holder_name='Other User',
			masked_card_number='************1111',
			last_four_digits='1111',
			expiry_month=12,
			expiry_year=date.today().year + 1,
		)

		list_response = self.client.get(self.cards_url)
		self.assertEqual(list_response.status_code, status.HTTP_200_OK)
		self.assertEqual([item['id'] for item in list_response.data], [own_card_response.data['id']])

		foreign_delete_response = self.client.delete(
			reverse('card-delete', args=[other_card.pk])
		)
		self.assertEqual(foreign_delete_response.status_code, status.HTTP_404_NOT_FOUND)
		self.assertTrue(Card.objects.filter(pk=other_card.pk).exists())

		own_delete_response = self.client.delete(
			reverse('card-delete', args=[own_card_response.data['id']])
		)
		self.assertEqual(own_delete_response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Card.objects.filter(pk=own_card_response.data['id']).exists())


class CardAdminTests(APITestCase):
	def setUp(self):
		self.admin_user = User(
			email='card-admin@example.com',
			name='Card Admin',
			is_staff=True,
			is_superuser=True,
		)
		self.admin_user.set_password('Strong-card-admin-password-1!')
		self.admin_user.save()
		self.client.force_login(self.admin_user)

	def test_admin_can_view_masked_cards_but_cannot_add_them(self):
		card = Card.objects.create(
			user_id=self.admin_user.pk,
			card_type='CREDIT',
			card_holder_name='Card Admin',
			masked_card_number='************4242',
			last_four_digits='4242',
			expiry_month=12,
			expiry_year=2099,
		)

		list_response = self.client.get(reverse('admin:cards_card_changelist'))
		detail_response = self.client.get(
			reverse('admin:cards_card_change', args=[card.pk])
		)
		add_response = self.client.get(reverse('admin:cards_card_add'))

		self.assertEqual(list_response.status_code, 200)
		self.assertContains(list_response, '************4242')
		self.assertEqual(detail_response.status_code, 200)
		self.assertContains(detail_response, '************4242')
		self.assertEqual(add_response.status_code, 403)
