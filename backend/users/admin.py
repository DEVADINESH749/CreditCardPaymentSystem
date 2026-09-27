from django.contrib import admin
from django import forms
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, ReadOnlyPasswordHashField

from .models import User


class AdminUserCreationForm(BaseUserCreationForm):
	class Meta(BaseUserCreationForm.Meta):
		model = User
		fields = ('email', 'name')


class AdminUserChangeForm(forms.ModelForm):
	password = ReadOnlyPasswordHashField()

	class Meta:
		model = User
		fields = (
			'email',
			'name',
			'password',
			'is_active',
			'is_admin',
			'is_staff',
			'is_superuser',
			'groups',
			'user_permissions',
			'last_login',
			'date_joined',
		)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
	form = AdminUserChangeForm
	add_form = AdminUserCreationForm
	fieldsets = (
		(None, {'fields': ('email', 'password')}),
		('Personal information', {'fields': ('name',)}),
		('Permissions', {
			'fields': (
				'is_active',
				'is_admin',
				'is_staff',
				'is_superuser',
				'groups',
				'user_permissions',
			),
		}),
		('Important dates', {'fields': ('last_login', 'date_joined')}),
	)
	add_fieldsets = (
		(None, {
			'classes': ('wide',),
			'fields': ('email', 'name', 'password1', 'password2'),
		}),
	)
	list_display = ('email', 'name', 'is_active', 'is_admin', 'is_staff')
	list_filter = ('is_active', 'is_admin', 'is_staff', 'is_superuser')
	search_fields = ('email', 'name')
	ordering = ('email',)
	filter_horizontal = ('groups', 'user_permissions')
	readonly_fields = ('last_login', 'date_joined')
