from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Transaction
from .serializers import TransactionFilterSerializer, TransactionSerializer


class TransactionListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        query_params = self.request.query_params.copy()
        requested_status = query_params.get('status')
        if requested_status:
            query_params['status'] = requested_status.upper()

        filters = TransactionFilterSerializer(data=query_params)
        filters.is_valid(raise_exception=True)
        validated = filters.validated_data

        queryset = Transaction.objects.filter(
            user_id=self.request.user.pk
        ).order_by('-transaction_date')

        if 'status' in validated:
            queryset = queryset.filter(status=validated['status'])

        if 'amount' in validated:
            queryset = queryset.filter(amount=validated['amount'])

        if 'date' in validated:
            queryset = queryset.filter(transaction_date__date=validated['date'])

        return queryset


class TransactionDetailView(generics.RetrieveAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user_id=self.request.user.pk)