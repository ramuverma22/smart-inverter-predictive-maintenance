"""Small telemetry simulator for demos. Run while the API is running."""
import os
import random
import time
import requests

API = os.getenv("API_URL", "http://localhost:8000")
EMAIL = os.getenv("DEMO_EMAIL", "demo@example.com")
PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")


def login():
    r = requests.post(f"{API}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=5)
    r.raise_for_status()
    return r.json()["access_token"]


def run(device_id=1, interval=2):
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    print("Sending demo telemetry. Press Ctrl+C to stop.")
    while True:
        hot = random.random() < 0.08
        data = {
            "device_id": device_id,
            "voltage": round(random.gauss(230, 3 if not hot else 30), 2),
            "current": round(random.gauss(4.0, 0.25), 2),
            "temperature": round(random.gauss(40, 2 if not hot else 12), 2),
            "battery": round(max(5, min(100, random.gauss(78, 3))), 2),
            "frequency": round(random.gauss(50, 0.25 if not hot else 2), 2),
        }
        r = requests.post(f"{API}/api/telemetry", json=data, headers=headers, timeout=5)
        print(r.status_code, data)
        time.sleep(interval)


if __name__ == "__main__":
    run()
