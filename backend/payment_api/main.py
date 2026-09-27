from decimal import Decimal
from typing import Literal
import random
import uuid
import os
import sys

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

# Add Django backend path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_backend.settings")

import django
django.setup()

from django.db import DatabaseError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from cards.models import Card
from transactions.models import Transaction
from users.models import User


app = FastAPI(title="Credit Card Payment API")
payment_cors_origins = os.environ.get('PAYMENT_CORS_ALLOWED_ORIGINS')
if not payment_cors_origins or not payment_cors_origins.strip():
    is_development = os.environ.get('DJANGO_DEBUG', 'True').strip().lower() in {
        '1', 'true', 'yes', 'on',
    }
    payment_cors_origins = ','.join((
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
    )) if is_development else ''

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in payment_cors_origins.split(',') if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
bearer_scheme = HTTPBearer(auto_error=False)


class PaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card_id: int = Field(gt=0)
    amount: Decimal = Field(gt=Decimal("0"), max_digits=10, decimal_places=2)


class PaymentResponse(BaseModel):
    transaction_id: int
    user_id: int
    card_id: int
    amount: str
    transaction_reference: str
    status: Literal["SUCCESS", "FAILED"]
    transaction_date: str


def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A Bearer access token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    authentication = JWTAuthentication()
    try:
        validated_token = authentication.get_validated_token(credentials.credentials)
        return authentication.get_user(validated_token)
    except (AuthenticationFailed, InvalidToken) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def simulate_payment_result() -> Literal["SUCCESS", "FAILED"]:
    return random.choice(["SUCCESS", "FAILED"])


@app.get("/")
def home():
    return {
        "message": "Credit Card Payment API is running"
    }


@app.post(
    "/payment",
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Missing or invalid access token"},
        status.HTTP_404_NOT_FOUND: {"description": "Card not found for the authenticated user"},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Payment could not be recorded"},
    },
)
def make_payment(
    payment: PaymentRequest,
    authenticated_user: User = Depends(get_authenticated_user),
) -> PaymentResponse:
    try:
        card = Card.objects.filter(
            pk=payment.card_id,
            user_id=authenticated_user.pk,
        ).first()
        if card is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Card not found for the authenticated user",
            )

        transaction = Transaction.objects.create(
            user_id=authenticated_user.pk,
            card_id=card.pk,
            amount=payment.amount,
            transaction_reference=str(uuid.uuid4()),
            status="PENDING",
        )

        transaction.status = simulate_payment_result()
        transaction.save(update_fields=["status"])
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment could not be recorded; please try again",
        ) from exc

    return {
        "transaction_id": transaction.pk,
        "user_id": transaction.user_id,
        "card_id": transaction.card_id,
        "amount": format(transaction.amount, ".2f"),
        "transaction_reference": transaction.transaction_reference,
        "status": transaction.status,
        "transaction_date": transaction.transaction_date.isoformat(),
    }