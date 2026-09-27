from django.contrib import admin

from .models import Card


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
	list_display = (
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
	list_filter = ('card_type',)
	search_fields = ('card_holder_name', 'last_four_digits')
	readonly_fields = tuple(field.name for field in Card._meta.fields)

	def has_add_permission(self, request):
		return False

	def has_change_permission(self, request, obj=None):
		return False

	def has_delete_permission(self, request, obj=None):
		return False
