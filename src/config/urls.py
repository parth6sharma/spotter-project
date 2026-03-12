from django.contrib import admin
from django.urls import include, path

from trips.views import FaviconView, ProjectHomeView

urlpatterns = [
    path("", ProjectHomeView.as_view(), name="project-home"),
    path("admin/", admin.site.urls),
    path("api/", include("trips.urls")),
    path("favicon.ico", FaviconView.as_view(), name="favicon"),
]
