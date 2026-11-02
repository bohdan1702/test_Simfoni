from rest_framework import serializers


class SearchSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, max_length=256)
    per_page = serializers.IntegerField(min_value=1, max_value=100, default=10)