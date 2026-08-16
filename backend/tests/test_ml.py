from types import SimpleNamespace
from app.ml import predict_health


def reading(voltage=230, current=4, temperature=40, battery=80, frequency=50, power=0.92):
    return SimpleNamespace(voltage=voltage, current=current, temperature=temperature, battery=battery, frequency=frequency, power=power)


def test_empty_history_is_safe():
    result = predict_health([])
    assert result["health_score"] == 100.0
    assert result["status"] == "Unknown"


def test_healthy_reading_gets_high_score():
    result = predict_health([reading()])
    assert result["health_score"] >= 90
    assert result["status"] == "Healthy"


def test_bad_temperature_reduces_score():
    result = predict_health([reading(temperature=80, battery=10)])
    assert result["health_score"] < 60
    assert result["status"] == "Critical"


def test_model_starts_after_minimum_history():
    history = [reading() for _ in range(30)]
    result = predict_health(history)
    assert result["model"] == "IsolationForest"
    assert result["samples"] == 30
