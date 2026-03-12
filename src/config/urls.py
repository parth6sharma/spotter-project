from django.contrib import admin
from django.urls import include, path, re_path

from trips.views import FaviconView, HealthCheckView, ProjectHomeView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="project-health"),
    path("admin/", admin.site.urls),
    path("api/", include("trips.urls")),
    path("favicon.ico", FaviconView.as_view(), name="favicon"),
    path("", ProjectHomeView.as_view(), name="project-home"),
    re_path(
        r"^(?!api/|admin/|health/|favicon\.ico$).*$",
        ProjectHomeView.as_view(),
        name="frontend-app",
    ),
]
