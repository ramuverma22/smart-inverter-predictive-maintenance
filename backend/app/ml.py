from __future__ import annotations

from typing import Iterable

import numpy as np
from sklearn.ensemble import IsolationForest

FEATURES = ["voltage", "current", "temperature", "battery", "frequency", "power"]
MIN_SAMPLES = 25


def _rows(history: Iterable):
    return np.asarray([[float(getattr(x, f)) for f in FEATURES] for x in history], dtype=float)


def _health_from_latest(x) -> float:
    score = 100.0
    score -= min(abs(x.voltage - 230) / 50 * 20, 20)
    score -= min(abs(x.frequency - 50) / 3 * 15, 15)
    score -= max(0.0, x.temperature - 45) * 1.2
    score -= max(0.0, 30 - x.battery) * 0.8
    return round(max(0.0, min(100.0, score)), 1)


def predict_health(history: Iterable):
    """Return an explainable health score plus unsupervised anomaly detection."""
    history = list(history)
    if not history:
        return {"health_score": 100.0, "is_anomaly": False, "anomaly_score": 0.0,
                "model": "no-data", "samples": 0, "status": "Unknown"}

    latest = history[0]
    health = _health_from_latest(latest)
    is_anomaly = False
    anomaly_score = 0.0
    model_name = "health-score-baseline"

    if len(history) >= MIN_SAMPLES:
        x = _rows(history)
        model = IsolationForest(n_estimators=150, contamination=0.08, random_state=42)
        model.fit(x)
        label = int(model.predict(x[:1])[0])
        raw = float(model.decision_function(x[:1])[0])
        anomaly_score = float(np.clip(0.5 - raw, 0, 1))
        is_anomaly = label == -1
        model_name = "IsolationForest"
        if is_anomaly:
            health = round(max(0.0, health - anomaly_score * 30), 1)

    if health >= 80:
        status = "Healthy"
    elif health >= 60:
        status = "Warning"
    else:
        status = "Critical"

    return {
        "health_score": health,
        "is_anomaly": is_anomaly,
        "anomaly_score": round(anomaly_score, 3),
        "model": model_name,
        "samples": len(history),
        "status": status,
    }
