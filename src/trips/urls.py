from django.urls import path

from .views import ApiRootView, HealthCheckView, TripPlanView

urlpatterns = [
    path("", ApiRootView.as_view(), name="api-root"),
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("trips/plan/", TripPlanView.as_view(), name="trip-plan"),
]
