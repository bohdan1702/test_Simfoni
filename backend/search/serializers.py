from rest_framework import serializers


class SearchSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, max_length=256)
    per_page = serializers.IntegerField(min_value=1, max_value=30, default=10)


class RepositoryMetricsSerializer(serializers.Serializer):
    owner = serializers.RegexField(r"^[A-Za-z0-9-]{1,39}$")
    name = serializers.RegexField(r"^[A-Za-z0-9._-]{1,100}$")