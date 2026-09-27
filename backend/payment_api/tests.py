from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from cards.models import Card
from payment_api.main import (
    PaymentRequest,
    app,
    get_authenticated_user,
    make_payment,
)
from transactions.models import Transaction


class PaymentRequestTests(SimpleTestCase):
    def test_amount_must_be_positive_and_fit_transaction_precision(self):
        for amount in ('0', '-1.00', '1.234', '100000000.00'):
            with self.subTest(amount=amount):
                with self.assertRaises(ValidationError):
                    PaymentRequest.model_validate({'card_id': 1, 'amount': amount})

        payment = PaymentRequest.model_validate({'card_id': 1, 'amount': '12.50'})
        self.assertEqual(payment.amount, Decimal('12.50'))


class PaymentOpenAPITests(SimpleTestCase):
    def test_payment_documents_request_response_errors_and_bearer_auth(self):
        operation = app.openapi()['paths']['/payment']['post']

        request_schema = operation['requestBody']['content']['application/json']['schema']
        self.assertEqual(request_schema['$ref'], '#/components/schemas/PaymentRequest')
        response_schema = operation['responses']['201']['content']['application/json']['schema']
        self.assertEqual(response_schema['$ref'], '#/components/schemas/PaymentResponse')
        self.assertTrue({401, 404, 422, 503}.issubset(
            {int(code) for code in operation['responses']}
        ))
        self.assertTrue(operation['security'])

    def test_request_rejects_invalid_card_id_and_cvv(self):
        invalid_payloads = (
            {'card_id': 0, 'amount': '12.50'},
            {'card_id': 1, 'amount': '12.50', 'cvv': '123'},
            {'card_id': 1, 'amount': '12.50', 'user_id': 99},
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValidationError):
                    PaymentRequest.model_validate(payload)

    def test_missing_or_invalid_access_token_is_rejected(self):
        with self.assertRaises(HTTPException) as missing_token:
            get_authenticated_user(None)
        self.assertEqual(missing_token.exception.status_code, 401)

        credentials = HTTPAuthorizationCredentials(
            scheme='Bearer',
            credentials='invalid-token',
        )
        with self.assertRaises(HTTPException) as invalid_token:
            get_authenticated_user(credentials)
        self.assertEqual(invalid_token.exception.status_code, 401)

    def test_expired_access_token_is_rejected(self):
        user = SimpleNamespace(id=14, is_active=True)
        expired_token = RefreshToken.for_user(user).access_token
        expired_token.set_exp(lifetime=timedelta(seconds=-1))
        credentials = HTTPAuthorizationCredentials(
            scheme='Bearer',
            credentials=str(expired_token),
        )

        with self.assertRaises(HTTPException) as response:
            get_authenticated_user(credentials)

        self.assertEqual(response.exception.status_code, 401)

    def test_authentication_uses_django_simplejwt(self):
        user = SimpleNamespace(pk=14)
        credentials = HTTPAuthorizationCredentials(
            scheme='Bearer',
            credentials='access-token',
        )
        with patch('payment_api.main.JWTAuthentication') as authentication_class:
            authentication = authentication_class.return_value
            authentication.get_validated_token.return_value = 'validated-token'
            authentication.get_user.return_value = user

            result = get_authenticated_user(credentials)

        self.assertIs(result, user)
        authentication.get_validated_token.assert_called_once_with('access-token')
        authentication.get_user.assert_called_once_with('validated-token')


class MakePaymentTests(SimpleTestCase):
    def setUp(self):
        self.user = SimpleNamespace(pk=14)
        self.payment = PaymentRequest(card_id=8, amount='12.50')

    def test_card_must_belong_to_authenticated_user(self):
        with patch.object(
            Card.objects,
            'filter',
            return_value=SimpleNamespace(first=lambda: None),
        ) as card_filter, patch.object(Transaction.objects, 'create') as create_transaction:
            with self.assertRaises(HTTPException) as response:
                make_payment(self.payment, self.user)

        self.assertEqual(response.exception.status_code, 404)
        card_filter.assert_called_once_with(pk=8, user_id=14)
        create_transaction.assert_not_called()

    def test_creates_pending_transaction_and_finalizes_both_outcomes(self):
        card = SimpleNamespace(pk=8)
        for final_status in ('SUCCESS', 'FAILED'):
            with self.subTest(final_status=final_status):
                transaction = SimpleNamespace(
                    pk=31,
                    user_id=14,
                    card_id=8,
                    amount=Decimal('12.50'),
                    transaction_reference='reference-31',
                    status='PENDING',
                    transaction_date=datetime.now(timezone.utc),
                    save=Mock(),
                )
                with patch.object(
                    Card.objects,
                    'filter',
                    return_value=SimpleNamespace(first=lambda: card),
                ), patch.object(
                    Transaction.objects,
                    'create',
                    return_value=transaction,
                ) as create_transaction, patch(
                    'payment_api.main.simulate_payment_result',
                    return_value=final_status,
                ):
                    response = make_payment(self.payment, self.user)

                self.assertEqual(create_transaction.call_args.kwargs['status'], 'PENDING')
                self.assertEqual(transaction.status, final_status)
                transaction.save.assert_called_once_with(update_fields=['status'])
                self.assertEqual(response['status'], final_status)
                self.assertEqual(response['amount'], '12.50')
                self.assertNotIn('card_number', response)
                self.assertNotIn('cvv', response)

    def test_database_error_is_returned_as_service_unavailable(self):
        with patch.object(Card.objects, 'filter', side_effect=DatabaseError):
            with self.assertRaises(HTTPException) as response:
                make_payment(self.payment, self.user)

        self.assertEqual(response.exception.status_code, 503)


class PaymentPersistenceTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model(email='payment-owner@example.com', name='Payment Owner')
        self.user.set_password('Strong-test-password-789')
        self.user.save()
        self.card = Card.objects.create(
            user_id=self.user.pk,
            card_type='CREDIT',
            card_holder_name='Payment Owner',
            masked_card_number='************4242',
            last_four_digits='4242',
            expiry_month=12,
            expiry_year=2099,
        )
        access_token = str(RefreshToken.for_user(self.user).access_token)
        self.authenticated_user = get_authenticated_user(
            HTTPAuthorizationCredentials(
                scheme='Bearer',
                credentials=access_token,
            )
        )

    def test_jwt_payment_persists_pending_then_final_status_in_database(self):
        payment = PaymentRequest(card_id=self.card.pk, amount='25.75')
        pending_statuses = []

        def simulate_and_observe_pending():
            latest_transaction = Transaction.objects.filter(
                user_id=self.user.pk,
                card_id=self.card.pk,
            ).latest('pk')
            pending_statuses.append(latest_transaction.status)
            return 'SUCCESS' if len(pending_statuses) == 1 else 'FAILED'

        with patch(
            'payment_api.main.simulate_payment_result',
            side_effect=simulate_and_observe_pending,
        ):
            results = [
                make_payment(payment, self.authenticated_user),
                make_payment(payment, self.authenticated_user),
            ]

        self.assertEqual(pending_statuses, ['PENDING', 'PENDING'])
        self.assertEqual([result['status'] for result in results], ['SUCCESS', 'FAILED'])
        for result in results:
            transaction = Transaction.objects.get(pk=result['transaction_id'])
            self.assertEqual(transaction.user_id, self.user.pk)
            self.assertEqual(transaction.card_id, self.card.pk)
            self.assertEqual(transaction.amount, Decimal('25.75'))
            self.assertEqual(result['amount'], '25.75')