from django.utils import timezone
from rest_framework import serializers
from .models import Card


class CardSerializer(serializers.ModelSerializer):

    card_number = serializers.CharField(
        write_only=True,
        max_length=23,
        trim_whitespace=True,
    )

    class Meta:
        model = Card
        fields = [
            'id',
            'user_id',
            'card_type',
            'card_holder_name',
            'card_number',
            'masked_card_number',
            'last_four_digits',
            'expiry_month',
            'expiry_year',
            'created_at',
        ]

        read_only_fields = [
            'id',
            'user_id',
            'masked_card_number',
            'last_four_digits',
            'created_at',
        ]

    def to_internal_value(self, data):
        if hasattr(data, 'keys'):
            submitted_fields = set(data.keys())
            if 'user_id' in submitted_fields:
                raise serializers.ValidationError({
                    'user_id': 'User ownership is determined by the access token.'
                })

            sensitive_fields = {
                field for field in submitted_fields
                if field.lower() in {'cvv', 'cvc', 'security_code'}
            }
            if sensitive_fields:
                raise serializers.ValidationError({
                    field: 'Security codes are not accepted or stored.'
                    for field in sensitive_fields
                })

            unexpected_fields = submitted_fields - set(self.fields)
            if unexpected_fields:
                raise serializers.ValidationError({
                    field: 'Unexpected field.' for field in unexpected_fields
                })

        return super().to_internal_value(data)

    def validate_card_number(self, value):
        card_number = value.replace(' ', '').replace('-', '')
        if not card_number.isascii() or not card_number.isdigit():
            raise serializers.ValidationError('Enter digits only.')
        if not 13 <= len(card_number) <= 19:
            raise serializers.ValidationError('Enter a card number with 13 to 19 digits.')

        checksum = 0
        for index, character in enumerate(reversed(card_number)):
            digit = int(character)
            if index % 2:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        if checksum % 10:
            raise serializers.ValidationError('Enter a valid card number.')

        return card_number

    def validate_card_holder_name(self, value):
        card_holder_name = value.strip()
        if not card_holder_name:
            raise serializers.ValidationError('Cardholder name cannot be blank.')
        return card_holder_name

    def validate(self, attrs):
        expiry_month = attrs['expiry_month']
        expiry_year = attrs['expiry_year']
        today = timezone.localdate()

        if not 1 <= expiry_month <= 12:
            raise serializers.ValidationError({
                'expiry_month': 'Enter a month from 1 to 12.'
            })
        if (expiry_year, expiry_month) < (today.year, today.month):
            raise serializers.ValidationError({
                'expiry_year': 'The card has expired.'
            })

        return attrs

    def create(self, validated_data):
        card_number = validated_data.pop('card_number')
        validated_data['last_four_digits'] = card_number[-4:]
        validated_data['masked_card_number'] = (
            '*' * (len(card_number) - 4) + card_number[-4:]
        )
        validated_data['user_id'] = self.context['request'].user.pk

        return Card.objects.create(**validated_data)