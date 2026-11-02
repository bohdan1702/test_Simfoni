from django.urls import path
from . import views

urlpatterns = [
    path('',views.SearchRepo.as_view(),)
]
