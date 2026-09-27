from decimal import Decimal

from rest_framework import serializers
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Transaction
        fields = [
            'id',
            'user_id',
            'card_id',
            'amount',
            'transaction_reference',
            'status',
            'transaction_date',
        ]


class TransactionFilterSerializer(serializers.Serializer):
    date = serializers.DateField(required=False, input_formats=['%Y-%m-%d'])
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=False,
    )
    status = serializers.ChoiceField(
        choices=Transaction.STATUS_CHOICES,
        required=False,
    )

    def to_internal_value(self, data):
        if hasattr(data, 'keys'):
            unexpected_fields = set(data.keys()) - set(self.fields)
            if unexpected_fields:
                raise serializers.ValidationError({
                    field: 'Unsupported transaction filter.'
                    for field in unexpected_fields
                })
        return super().to_internal_value(data)