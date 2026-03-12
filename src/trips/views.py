from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import TripPlanRequestSerializer
from .services import ExternalRoutingError, build_trip_plan


class ProjectHomeView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "name": "Spotter Backend",
                "status": "ok",
                "api": "/api/",
                "endpoints": {
                    "health": "/api/health/",
                    "trip_plan": "/api/trips/plan/",
                },
            }
        )


class ApiRootView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "message": "Spotter trip planning API",
                "endpoints": {
                    "health": "/api/health/",
                    "trip_plan": "/api/trips/plan/",
                },
            }
        )


class FaviconView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"})


class TripPlanView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            plan = build_trip_plan(serializer.validated_data)
        except ExternalRoutingError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(plan, status=status.HTTP_200_OK)
