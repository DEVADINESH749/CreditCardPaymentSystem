import csv
from decimal import Decimal

from django.contrib import admin
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
	list_display = (
		'id',
		'transaction_reference',
		'user_id',
		'card_id',
		'amount',
		'status',
		'transaction_date',
	)
	list_filter = ('status', 'transaction_date')
	search_fields = ('transaction_reference',)
	actions = ('export_selected_as_csv',)
	change_list_template = 'admin/transactions/transaction/change_list.html'
	readonly_fields = tuple(field.name for field in Transaction._meta.fields)

	def has_add_permission(self, request):
		return False

	def has_change_permission(self, request, obj=None):
		return False

	def has_delete_permission(self, request, obj=None):
		return False

	def changelist_view(self, request, extra_context=None):
		today = timezone.localdate()
		summary = Transaction.objects.filter(
			transaction_date__date=today
		).aggregate(
			total_count=Count('pk'),
			success_count=Count('pk', filter=Q(status='SUCCESS')),
			failed_count=Count('pk', filter=Q(status='FAILED')),
			pending_count=Count('pk', filter=Q(status='PENDING')),
			success_amount=Sum('amount', filter=Q(status='SUCCESS')),
		)
		extra_context = extra_context or {}
		extra_context['daily_payment_summary'] = {
			'date': today,
			'total_count': summary['total_count'],
			'success_count': summary['success_count'],
			'failed_count': summary['failed_count'],
			'pending_count': summary['pending_count'],
			'success_amount': summary['success_amount'] or Decimal('0.00'),
		}
		return super().changelist_view(request, extra_context=extra_context)

	@admin.action(description='Export selected transactions as CSV', permissions=['view'])
	def export_selected_as_csv(self, request, queryset):
		response = HttpResponse(content_type='text/csv')
		response['Content-Disposition'] = 'attachment; filename="transactions.csv"'
		writer = csv.writer(response)
		writer.writerow((
			'id',
			'user_id',
			'card_id',
			'amount',
			'transaction_reference',
			'status',
			'transaction_date',
		))

		for transaction in queryset.iterator():
			writer.writerow((
				transaction.pk,
				transaction.user_id,
				transaction.card_id,
				transaction.amount,
				transaction.transaction_reference,
				transaction.status,
				transaction.transaction_date.isoformat(),
			))

		return response
