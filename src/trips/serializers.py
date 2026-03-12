from rest_framework import serializers


class LocationInputSerializer(serializers.Serializer):
    label = serializers.CharField(required=False, allow_blank=True, max_length=120)
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)

    def validate(self, attrs):
        has_coordinates = attrs.get('latitude') is not None or attrs.get('longitude') is not None
        has_both_coordinates = attrs.get('latitude') is not None and attrs.get('longitude') is not None
        has_address = bool(attrs.get('address'))

        if has_coordinates and not has_both_coordinates:
            raise serializers.ValidationError('Both latitude and longitude are required when using coordinates.')

        if not has_both_coordinates and not has_address:
            raise serializers.ValidationError('Provide either an address or latitude/longitude coordinates.')

        return attrs


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = LocationInputSerializer()
    pickup_location = LocationInputSerializer()
    dropoff_location = LocationInputSerializer()
    current_cycle_used_hours = serializers.FloatField(min_value=0, max_value=70)
    trip_start_datetime = serializers.DateTimeField(required=False)
