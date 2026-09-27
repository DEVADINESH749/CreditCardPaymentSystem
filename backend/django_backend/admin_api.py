from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.models import Card
from transactions.models import Transaction
from transactions.serializers import TransactionSerializer


User = get_user_model()


class IsStaffOrSuperuser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or user.is_superuser)
        )


class AdminPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'name', 'email', 'is_active', 'is_staff', 'is_superuser', 'date_joined')
        read_only_fields = fields


class AdminCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = (
            'id',
            'user_id',
            'card_type',
            'card_holder_name',
            'masked_card_number',
            'last_four_digits',
            'expiry_month',
            'expiry_year',
            'created_at',
        )
        read_only_fields = fields


class AdminSummaryView(APIView):
    permission_classes = [IsStaffOrSuperuser]

    def get(self, request):
        today = timezone.localdate()
        todays_transactions = Transaction.objects.filter(transaction_date__date=today)
        successful_amount = todays_transactions.filter(status='SUCCESS').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        return Response({
            'total_users': User.objects.count(),
            'total_cards': Card.objects.count(),
            'total_transactions': Transaction.objects.count(),
            'today': {
                'date': today.isoformat(),
                'payment_count': todays_transactions.count(),
                'successful_count': todays_transactions.filter(status='SUCCESS').count(),
                'failed_count': todays_transactions.filter(status='FAILED').count(),
                'successful_amount': format(successful_amount, '.2f'),
            },
            'recent_transactions': TransactionSerializer(
                Transaction.objects.order_by('-transaction_date')[:10],
                many=True,
            ).data,
        })


class AdminUserListView(generics.ListAPIView):
    permission_classes = [IsStaffOrSuperuser]
    serializer_class = AdminUserSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        return User.objects.order_by('id')


class AdminCardListView(generics.ListAPIView):
    permission_classes = [IsStaffOrSuperuser]
    serializer_class = AdminCardSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        return Card.objects.order_by('-created_at')


class AdminTransactionListView(generics.ListAPIView):
    permission_classes = [IsStaffOrSuperuser]
    serializer_class = TransactionSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        return Transaction.objects.order_by('-transaction_date')