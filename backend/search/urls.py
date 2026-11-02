from django.urls import path

from .views import (
    ContributorsView,
    RepositoryMetricsView,
    RepositoryView,
    SearchView,
)

urlpatterns = [
    path("search/", SearchView.as_view(), name="search"),
    path(
        "repos/<str:owner>/<str:name>/",
        RepositoryView.as_view(),
        name="repository",
    ),
    path(
        "repos/<str:owner>/<str:name>/contributors/",
        ContributorsView.as_view(),
        name="repository-contributors",
    ),
    path(
        "repos/<str:owner>/<str:name>/metrics/",
        RepositoryMetricsView.as_view(),
        name="repository-metrics",
    ),
]
