from django.db import migrations


def align_admin_log_user_foreign_key(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'mysql':
        return

    log_entry_model = apps.get_model('admin', 'LogEntry')
    user_model = apps.get_model('users', 'User')
    table_name = log_entry_model._meta.db_table
    user_table = user_model._meta.db_table
    user_field = log_entry_model._meta.get_field('user')
    user_column = user_field.column

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table_name)

    user_foreign_keys = [
        (name, details['foreign_key'])
        for name, details in constraints.items()
        if details.get('columns') == [user_column] and details.get('foreign_key')
    ]

    if any(target == (user_table, 'id') for _, target in user_foreign_keys):
        return

    if any(target != ('auth_user', 'id') for _, target in user_foreign_keys):
        raise RuntimeError('Admin log user foreign key targets an unexpected table.')

    existing_user_ids = user_model.objects.using(connection.alias).values_list('pk', flat=True)
    if log_entry_model.objects.using(connection.alias).exclude(
        user_id__in=existing_user_ids
    ).exists():
        raise RuntimeError('Admin log rows reference users absent from the configured user table.')

    quote_name = connection.ops.quote_name
    for constraint_name, _ in user_foreign_keys:
        schema_editor.execute(
            f'ALTER TABLE {quote_name(table_name)} '
            f'DROP FOREIGN KEY {quote_name(constraint_name)}'
        )

    target_id_type = user_model._meta.pk.rel_db_type(connection)
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS '
            'WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s',
            [connection.settings_dict['NAME'], table_name, user_column],
        )
        current_id_type = cursor.fetchone()

    if current_id_type is None or target_id_type is None:
        raise RuntimeError('Could not determine admin-log and user ID column types.')
    if current_id_type[0] != target_id_type:
        schema_editor.execute(
            f'ALTER TABLE {quote_name(table_name)} '
            f'MODIFY COLUMN {quote_name(user_column)} {target_id_type} NOT NULL'
        )

    new_constraint_name = 'django_admin_log_user_users_user_fk'
    schema_editor.execute(
        f'ALTER TABLE {quote_name(table_name)} '
        f'ADD CONSTRAINT {quote_name(new_constraint_name)} '
        f'FOREIGN KEY ({quote_name(user_column)}) '
        f'REFERENCES {quote_name(user_table)} ({quote_name("id")})'
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('admin', '0003_logentry_add_action_flag_choices'),
        ('users', '0002_alter_user_options_alter_user_managers_and_more'),
    ]

    operations = [
        migrations.RunPython(
            align_admin_log_user_foreign_key,
            migrations.RunPython.noop,
        ),
    ]